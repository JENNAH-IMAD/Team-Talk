using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TeamTalk.Application.DTOs.Chat;
using TeamTalk.Application.Interfaces;

namespace TeamTalk.WebAPI.Hubs;

public class UserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
        => connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
}

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;

    // In-memory voice channel presence: channelId -> set of userIds
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<
        string, System.Collections.Concurrent.ConcurrentDictionary<string, byte>> _voicePresence = new();

    // Bug 3: debounce disconnect — cancel if user reconnects within 3 seconds
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<
        string, CancellationTokenSource> _disconnectTimers = new();

    public ChatHub(IChatService chatService) { _chatService = chatService; }

    private Guid GetUserId() => Guid.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        // Send current voice presence snapshot to the newly connected client
        foreach (var (cid, set) in _voicePresence)
        {
            await Clients.Caller.SendAsync("VoiceParticipants", new { ChannelId = cid, UserIds = set.Keys.ToList() });
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId().ToString();

        // Bug 3: cancel any existing timer for this user (handles rapid reconnects)
        if (_disconnectTimers.TryRemove(userId, out var oldCts))
            oldCts.Cancel();

        // Bug 3: defer the leave broadcast — only fires if user does NOT reconnect within 3 s
        var cts = new CancellationTokenSource();
        _disconnectTimers[userId] = cts;
        var token = cts.Token;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(3000, token);
                _disconnectTimers.TryRemove(userId, out _);
                foreach (var (cid, s) in _voicePresence)
                {
                    if (s.TryRemove(userId, out _))
                    {
                        // Bug 6: broadcast to all so every connected client sees the leave
                        await Clients.All.SendAsync("UserLeftVoice", new { ChannelId = cid, UserId = userId });
                        await Clients.All.SendAsync("VoiceParticipants", new { ChannelId = cid, UserIds = s.Keys.ToList() });
                    }
                }
            }
            catch (OperationCanceledException) { /* user reconnected within 3 s — skip leave */ }
        });

        await base.OnDisconnectedAsync(exception);
    }

    // ── Text Channels ─────────────────────────────────────
    public async Task JoinChannel(string channelId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, channelId);

    public async Task LeaveChannel(string channelId)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, channelId);

    public async Task SendTyping(string channelId, bool isTyping)
    {
        var userId = GetUserId();
        await Clients.OthersInGroup(channelId).SendAsync("UserTyping", new
        {
            ChannelId = channelId,
            UserId = userId.ToString(),
            IsTyping = isTyping
        });
    }

    // ── Voice Channels ────────────────────────────────────
    public async Task JoinVoiceChannel(string channelId)
    {
        var userId = GetUserId().ToString();

        // Bug 3: cancel any pending disconnect timer so the leave event is suppressed
        if (_disconnectTimers.TryRemove(userId, out var cts))
            cts.Cancel();

        // Bug 2: remove user from ALL other voice channels first (one channel at a time)
        foreach (var (cid, s) in _voicePresence)
        {
            if (cid != channelId && s.TryRemove(userId, out _))
            {
                // Bug 6: broadcast to all so every client sees the cross-channel leave
                await Clients.All.SendAsync("UserLeftVoice", new { ChannelId = cid, UserId = userId });
            }
        }

        var set = _voicePresence.GetOrAdd(channelId, _ => new System.Collections.Concurrent.ConcurrentDictionary<string, byte>());

        // Bug 2: only broadcast join if the user wasn't already in this channel (avoids duplicate join events on reconnect)
        bool isNew = set.TryAdd(userId, 0);

        await Groups.AddToGroupAsync(Context.ConnectionId, $"voice_{channelId}");

        if (isNew)
        {
            // Bug 6: broadcast to ALL connected clients, not just the channel group —
            // users viewing other channels need to see voice presence updates in the sidebar
            await Clients.All.SendAsync("UserJoinedVoice", new { ChannelId = channelId, UserId = userId });
        }

        // Send the participant list only to the new joiner — they initiate WebRTC to existing peers.
        // Existing users learn about the join via UserJoinedVoice and respond to incoming offers.
        // Sending to All caused offer collisions: both sides sent offers simultaneously → connections failed.
        await Clients.Caller.SendAsync("VoiceParticipants", new { ChannelId = channelId, UserIds = set.Keys.ToList() });
    }

    public async Task LeaveVoiceChannel(string channelId)
    {
        var userId = GetUserId().ToString();
        var wasPresent = _voicePresence.TryGetValue(channelId, out var set) && set.TryRemove(userId, out _);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"voice_{channelId}");
        // Only broadcast if the user was actually in the channel — prevents duplicate leave events
        // when LeaveVoiceChannel is called more than once (navigation, React StrictMode, etc.)
        if (wasPresent)
            await Clients.All.SendAsync("UserLeftVoice", new { ChannelId = channelId, UserId = userId });

        // Broadcast updated participants list so all clients re-sync
        if (_voicePresence.TryGetValue(channelId, out var updatedSet))
            await Clients.All.SendAsync("VoiceParticipants", new { ChannelId = channelId, UserIds = updatedSet.Keys.ToList() });
    }

    // Bug 6: state sync — mute, camera, quality changes are broadcast to all in channel
    public async Task UpdateParticipantState(string channelId, object stateUpdate)
    {
        var userId = GetUserId().ToString();
        await Clients.All.SendAsync("ParticipantStateChanged", new
        {
            ChannelId = channelId,
            UserId = userId,
            State = stateUpdate,
        });
    }

    // ── 1-to-1 Voice Calls (WebRTC Signaling) ────────
    public async Task CallUser(string targetUserId, string offer)
    {
        var callerId = GetUserId().ToString();
        await Clients.User(targetUserId).SendAsync("IncomingCall", new { CallerId = callerId, Offer = offer });
    }

    public async Task AcceptCall(string callerId, string answer)
    {
        await Clients.User(callerId).SendAsync("CallAccepted", new { Answer = answer });
    }

    public async Task RejectCall(string callerId)
    {
        var userId = GetUserId().ToString();
        await Clients.User(callerId).SendAsync("CallRejected", new { UserId = userId });
    }

    public async Task EndCall(string targetUserId)
    {
        await Clients.User(targetUserId).SendAsync("CallEnded");
    }

    public async Task SendIceCandidate(string targetUserId, string candidate)
    {
        await Clients.User(targetUserId).SendAsync("IceCandidate", new { Candidate = candidate });
    }

    // ── Screen Sharing (WebRTC signaling) ─────────────────
    public async Task SendScreenOffer(string targetUserId, string offer)
    {
        var senderId = GetUserId().ToString();
        await Clients.User(targetUserId).SendAsync("ScreenOfferReceived", new { SenderId = senderId, Offer = offer });
    }

    public async Task AcceptScreenShare(string senderId, string answer)
        => await Clients.User(senderId).SendAsync("ScreenShareAccepted", new { Answer = answer });

    public async Task StopScreenShare(string targetUserId)
        => await Clients.User(targetUserId).SendAsync("ScreenShareStopped");

    public async Task SendScreenIce(string targetUserId, string candidate)
        => await Clients.User(targetUserId).SendAsync("ScreenIceCandidate", new { Candidate = candidate });

    // ── Call Event Notifications (broadcast to channel) ───
    public async Task SendCallEvent(string channelId, string type, string text)
        => await Clients.Group(channelId).SendAsync("CallEventReceived", new { ChannelId = channelId, Type = type, Text = text });

    // ── Group Voice WebRTC Signaling ──────────────────────────
    public async Task SendGroupVoiceOffer(string channelId, string targetUserId, string offer)
    {
        var senderId = GetUserId().ToString();
        await Clients.User(targetUserId).SendAsync("GroupVoiceOffer", new { ChannelId = channelId, SenderId = senderId, Offer = offer });
    }

    public async Task SendGroupVoiceAnswer(string channelId, string targetUserId, string answer)
    {
        var senderId = GetUserId().ToString();
        await Clients.User(targetUserId).SendAsync("GroupVoiceAnswer", new { ChannelId = channelId, SenderId = senderId, Answer = answer });
    }

    public async Task SendGroupVoiceIce(string channelId, string targetUserId, string candidate)
    {
        var senderId = GetUserId().ToString();
        await Clients.User(targetUserId).SendAsync("GroupVoiceIce", new { ChannelId = channelId, SenderId = senderId, Candidate = candidate });
    }
}
