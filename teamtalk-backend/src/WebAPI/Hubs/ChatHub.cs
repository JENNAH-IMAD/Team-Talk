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
    // In-memory voice channel presence: channelId -> set of userIds (using ConcurrentDictionary as a set)
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, System.Collections.Concurrent.ConcurrentDictionary<string, byte>> _voicePresence = new();

    public ChatHub(IChatService chatService) { _chatService = chatService; }

    private Guid GetUserId() => Guid.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    public override Task OnConnectedAsync() => base.OnConnectedAsync();

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId().ToString();
        // Remove from all voice channels on disconnect
        foreach (var (channelId, set) in _voicePresence)
        {
            if (set.TryRemove(userId, out _))
            {
                await Clients.Group(channelId).SendAsync("UserLeftVoice", new { ChannelId = channelId, UserId = userId });
            }
        }
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
        var set = _voicePresence.GetOrAdd(channelId, _ => new System.Collections.Concurrent.ConcurrentDictionary<string, byte>());
        set.TryAdd(userId, 0);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"voice_{channelId}");
        // Broadcast to text channel group so all members (including non-voice) receive the event
        await Clients.Group(channelId).SendAsync("UserJoinedVoice", new { ChannelId = channelId, UserId = userId });
        // Send current participants list to the newcomer
        await Clients.Caller.SendAsync("VoiceParticipants", new { ChannelId = channelId, UserIds = set.Keys.ToList() });
    }

    public async Task LeaveVoiceChannel(string channelId)
    {
        var userId = GetUserId().ToString();
        if (_voicePresence.TryGetValue(channelId, out var set)) set.TryRemove(userId, out _);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"voice_{channelId}");
        await Clients.Group(channelId).SendAsync("UserLeftVoice", new { ChannelId = channelId, UserId = userId });
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
    // Used to show in-chat notifications: call started, ended, joined, etc.
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
