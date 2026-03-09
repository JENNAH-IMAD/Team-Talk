using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NexusPlatform.Application.DTOs.Chat;
using NexusPlatform.Application.Interfaces;

namespace NexusPlatform.WebAPI.Hubs;

/// <summary>Uses the NameIdentifier claim (user's Guid) as the SignalR user ID
/// so Clients.User(userId) routes to the right connection(s).</summary>
public class UserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
        => connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
}

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;

    public ChatHub(IChatService chatService) { _chatService = chatService; }

    private Guid GetUserId() => Guid.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    public override Task OnConnectedAsync() => base.OnConnectedAsync();
    public override Task OnDisconnectedAsync(Exception? exception) => base.OnDisconnectedAsync(exception);

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
}
