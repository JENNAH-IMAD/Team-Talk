using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TeamTalk.Application.DTOs.Auth;
using TeamTalk.Application.DTOs.Team;
using TeamTalk.Application.DTOs.Channel;
using TeamTalk.Application.DTOs.Chat;
using TeamTalk.Application.DTOs.Notification;
using TeamTalk.Application.Interfaces;
using TeamTalk.Domain.Interfaces;
using TeamTalk.WebAPI.Hubs;

namespace TeamTalk.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class BaseController : ControllerBase
{
    protected Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    protected string GetUserRole() => User.FindFirst(ClaimTypes.Role)!.Value;
}

// ═══════════════════════════════════════════════════════════
// AUTH CONTROLLER
// ═══════════════════════════════════════════════════════════
[Route("api/auth")]
public class AuthController : BaseController
{
    private readonly IAuthService _authService;
    public AuthController(IAuthService authService) { _authService = authService; }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var response = await _authService.LoginAsync(request);
        return Ok(response);
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var response = await _authService.RegisterAsync(request);
        return CreatedAtAction(nameof(GetMe), response);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var response = await _authService.RefreshTokenAsync(request.RefreshToken);
        return Ok(response);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var user = await _authService.GetCurrentUserAsync(GetUserId());
        return Ok(user);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _authService.LogoutAsync(GetUserId());
        return NoContent();
    }
}

// ═══════════════════════════════════════════════════════════
// USERS CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/users")]
public class UsersController : BaseController
{
    private readonly IUserService _userService;
    public UsersController(IUserService userService) { _userService = userService; }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAll()
    {
        return Ok(await _userService.GetAllUsersAsync());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> GetById(Guid id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        return user == null ? NotFound() : Ok(user);
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<UserDto>>> Search([FromQuery] string q, [FromQuery] int page = 1)
    {
        return Ok(await _userService.SearchUsersAsync(q, page));
    }

    [HttpPut("status")]
    public async Task<IActionResult> UpdateStatus([FromBody] UpdateStatusRequest request)
    {
        await _userService.UpdateUserStatusAsync(GetUserId(), request.Status);
        return NoContent();
    }

    [HttpPut("{id:guid}/role")]
    [Authorize(Roles = "Admin,Director")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleRequest request)
    {
        await _userService.UpdateUserRoleAsync(id, request.Roles, request.Role, request.SecondaryRole);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Director")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        await _userService.DeactivateUserAsync(id);
        return NoContent();
    }

    [HttpPut("me/profile")]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var updated = await _userService.UpdateProfileAsync(GetUserId(), request);
        return Ok(updated);
    }

    [HttpPut("me/password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        try
        {
            await _userService.ChangePasswordAsync(GetUserId(), request.CurrentPassword, request.NewPassword);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("me/avatar")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<UserDto>> UploadAvatar([FromForm] UploadAvatarRequest request, [FromServices] IFileService fileService)
    {
        var file = request.File;
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file provided" });
        var (filePath, _, _) = await fileService.UploadFileAsync(file.OpenReadStream(), file.FileName);
        var updated = await _userService.UpdateAvatarAsync(GetUserId(), $"/uploads/{filePath}");
        return Ok(updated);
    }
}

public class UpdateStatusRequest { public string Status { get; set; } = string.Empty; }
public class UploadAvatarRequest
{
    public IFormFile File { get; set; } = null!;
}
public class UpdateRoleRequest
{
    public string Role { get; set; } = string.Empty;
    public string? SecondaryRole { get; set; }
    public List<string>? Roles { get; set; }
}

// ═══════════════════════════════════════════════════════════
// TEAMS CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/teams")]
public class TeamsController : BaseController
{
    private readonly ITeamService _teamService;
    public TeamsController(ITeamService teamService) { _teamService = teamService; }

    private bool IsDirectorOrAdmin() => User.IsInRole("Admin") || User.IsInRole("Director");

    private bool CanManageTeam(TeamDto team, Guid userId)
    {
        if (IsDirectorOrAdmin()) return true;
        return team.OwnerId == userId;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeamDto>>> GetMyTeams()
    {
        return Ok(await _teamService.GetUserTeamsAsync(GetUserId()));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TeamDto>> GetById(Guid id)
    {
        var team = await _teamService.GetTeamByIdAsync(id);
        return team == null ? NotFound() : Ok(team);
    }

    [HttpPost]
    public async Task<ActionResult<TeamDto>> Create([FromBody] CreateTeamRequest request)
    {
        var team = await _teamService.CreateTeamAsync(request, GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = team.Id }, team);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TeamDto>> Update(Guid id, [FromBody] UpdateTeamRequest request)
    {
        var team = await _teamService.GetTeamByIdAsync(id);
        if (team == null) return NotFound();
        if (!CanManageTeam(team, GetUserId())) return Forbid();
        return Ok(await _teamService.UpdateTeamAsync(id, request));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var team = await _teamService.GetTeamByIdAsync(id);
        if (team == null) return NotFound();
        if (!CanManageTeam(team, GetUserId())) return Forbid();
        await _teamService.DeleteTeamAsync(id);
        return NoContent();
    }

    [HttpPost("{teamId:guid}/members")]
    public async Task<IActionResult> AddMember(Guid teamId, [FromBody] AddTeamMemberRequest request)
    {
        var team = await _teamService.GetTeamByIdAsync(teamId);
        if (team == null) return NotFound();
        if (!CanManageTeam(team, GetUserId())) return Forbid();
        await _teamService.AddMemberAsync(teamId, request.UserId);
        return NoContent();
    }

    [HttpDelete("{teamId:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid teamId, Guid userId)
    {
        var team = await _teamService.GetTeamByIdAsync(teamId);
        if (team == null) return NotFound();
        if (!CanManageTeam(team, GetUserId())) return Forbid();
        await _teamService.RemoveMemberAsync(teamId, userId);
        return NoContent();
    }
}

// ═══════════════════════════════════════════════════════════
// CHANNELS CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/teams/{teamId:guid}/channels")]
public class ChannelsController : BaseController
{
    private readonly IChannelService _channelService;
    private readonly ITeamService _teamService;
    public ChannelsController(IChannelService channelService, ITeamService teamService)
    {
        _channelService = channelService;
        _teamService = teamService;
    }

    private bool IsDirectorOrAdmin() => User.IsInRole("Admin") || User.IsInRole("Director");

    private bool CanManageTeam(TeamDto team, Guid userId)
    {
        if (IsDirectorOrAdmin()) return true;
        return team.OwnerId == userId;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ChannelDto>>> GetTeamChannels(Guid teamId)
    {
        return Ok(await _channelService.GetTeamChannelsAsync(teamId));
    }

    [HttpPost]
    public async Task<ActionResult<ChannelDto>> Create(Guid teamId, [FromBody] CreateChannelRequest request)
    {
        var team = await _teamService.GetTeamByIdAsync(teamId);
        if (team == null) return NotFound();
        if (!CanManageTeam(team, GetUserId())) return Forbid();
        var channel = await _channelService.CreateChannelAsync(teamId, request);
        return Created($"/api/channels/{channel.Id}", channel);
    }

    [HttpDelete("{channelId:guid}")]
    public async Task<IActionResult> Delete(Guid channelId)
    {
        var channel = await _channelService.GetChannelByIdAsync(channelId);
        if (channel == null) return NotFound();
        if (channel.TeamId.HasValue)
        {
            var team = await _teamService.GetTeamByIdAsync(channel.TeamId.Value);
            if (team == null) return NotFound();
            if (!CanManageTeam(team, GetUserId())) return Forbid();
        }
        await _channelService.DeleteChannelAsync(channelId);
        return NoContent();
    }
}

// ═══════════════════════════════════════════════════════════
// MESSAGES CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/channels/{channelId:guid}/messages")]
public class MessagesController : BaseController
{
    private readonly IChatService _chatService;
    private readonly IDmService _dmService;
    private readonly INotificationService _notificationService;
    private readonly IChannelService _channelService;
    private readonly IUserService _userService;
    private readonly IUnitOfWork _uow;
    private readonly IHubContext<ChatHub> _hub;

    public MessagesController(
        IChatService chatService,
        IDmService dmService,
        INotificationService notificationService,
        IChannelService channelService,
        IUserService userService,
        IUnitOfWork uow,
        IHubContext<ChatHub> hub)
    {
        _chatService = chatService;
        _dmService = dmService;
        _notificationService = notificationService;
        _channelService = channelService;
        _userService = userService;
        _uow = uow;
        _hub = hub;
    }

    private async Task PushNotification(Guid userId, string type, string content, Guid channelId)
    {
        await _notificationService.CreateNotificationAsync(userId, type, content, channelId);
        var notifications = await _notificationService.GetNotificationsAsync(userId, 1, 1);
        var latest = notifications.FirstOrDefault();
        if (latest != null)
            await _hub.Clients.User(userId.ToString()).SendAsync("ReceiveNotification", latest);
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<MessageDto>>> GetMessages(Guid channelId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        return Ok(await _chatService.GetMessagesAsync(channelId, page, pageSize));
    }

    [HttpPost]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid channelId, [FromBody] SendMessageRequest request)
    {
        var senderId = GetUserId();
        var message = await _chatService.SendMessageAsync(channelId, senderId, request);
        var senderName = message.UserName;
        var preview = message.Content.Length > 80 ? message.Content[..80] + "…" : message.Content;

        // Broadcast to all members of the channel group
        await _hub.Clients.Group(channelId.ToString()).SendAsync("ReceiveMessage", message);

        // ── DM channel ────────────────────────────────────────
        var peer = await _dmService.GetDmPeerAsync(channelId, senderId);
        if (peer.HasValue)
        {
            await PushNotification(peer.Value, "NewMessage",
                $"New message from {senderName}: {preview}", channelId);
            await _hub.Clients.User(peer.Value.ToString()).SendAsync("DmReceived", message);
            return Created($"/api/channels/{channelId}/messages/{message.Id}", message);
        }

        // ── Regular channel: notify members + detect @mentions ─
        var channel = await _channelService.GetChannelByIdAsync(channelId);
        var channelName = channel?.Name ?? "channel";

        // Get all team members to notify
        HashSet<Guid> mentionedIds = new();
        var mentionMatches = System.Text.RegularExpressions.Regex
            .Matches(message.Content, @"@([\w][^\s@#]{0,30})");

        if (mentionMatches.Count > 0)
        {
            var allUsers = await _userService.GetAllUsersAsync();
            foreach (System.Text.RegularExpressions.Match match in mentionMatches)
            {
                var mentionedName = match.Groups[1].Value.Trim().ToLower();
                var mentionedUser = allUsers.FirstOrDefault(u =>
                    u.Name.ToLower() == mentionedName ||
                    u.Name.ToLower().Replace(" ", "") == mentionedName.Replace(" ", ""));

                if (mentionedUser != null && mentionedUser.Id != senderId)
                {
                    mentionedIds.Add(mentionedUser.Id);
                    await PushNotification(mentionedUser.Id, "Mention",
                        $"@{senderName} mentioned you in #{channelName}: {preview}", channelId);
                }
            }
        }

        // Notify all other channel/team members about new message (excluding sender & already-mentioned)
        if (channel?.TeamId.HasValue == true)
        {
            var team = await _uow.Teams.GetTeamWithMembersAsync(channel.TeamId.Value);
            if (team != null)
            {
                foreach (var member in team.Members)
                {
                    if (member.UserId != senderId && !mentionedIds.Contains(member.UserId))
                    {
                        await PushNotification(member.UserId, "NewMessage",
                            $"New message in #{channelName} from {senderName}: {preview}", channelId);
                    }
                }
            }
        }

        return Created($"/api/channels/{channelId}/messages/{message.Id}", message);
    }

    [HttpPut("{messageId:guid}")]
    public async Task<ActionResult<MessageDto>> EditMessage(Guid channelId, Guid messageId, [FromBody] EditMessageRequest request)
    {
        var message = await _chatService.EditMessageAsync(messageId, GetUserId(), request);
        await _hub.Clients.Group(channelId.ToString()).SendAsync("MessageEdited", message);
        return Ok(message);
    }

    [HttpDelete("{messageId:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid channelId, Guid messageId)
    {
        await _chatService.DeleteMessageAsync(messageId, GetUserId());
        await _hub.Clients.Group(channelId.ToString()).SendAsync("MessageDeleted", messageId.ToString(), channelId.ToString());
        return NoContent();
    }

    [HttpPost("{messageId:guid}/reactions")]
    public async Task<IActionResult> ToggleReaction(Guid channelId, Guid messageId, [FromBody] ToggleReactionRequest request)
    {
        var userId = GetUserId().ToString();
        var message = await _uow.Messages.GetByIdAsync(messageId);
        if (message == null) return NotFound();

        var reactions = JsonSerializer.Deserialize<List<ReactionItem>>(message.ReactionsJson ?? "[]") ?? new();
        var existing = reactions.FirstOrDefault(r => r.Emoji == request.Emoji);
        if (existing == null)
        {
            reactions.Add(new ReactionItem { Emoji = request.Emoji, Users = new List<string> { userId } });
        }
        else if (existing.Users.Contains(userId))
        {
            existing.Users.Remove(userId);
            if (existing.Users.Count == 0) reactions.Remove(existing);
        }
        else
        {
            existing.Users.Add(userId);
        }

        message.ReactionsJson = JsonSerializer.Serialize(reactions);
        await _uow.Messages.UpdateAsync(message);
        await _uow.SaveChangesAsync();

        var dto = new { id = messageId, channelId, reactions = reactions.Select(r => new { emoji = r.Emoji, users = r.Users }) };
        await _hub.Clients.Group(channelId.ToString()).SendAsync("MessageReacted", dto);
        return Ok(dto);
    }
}

public class ReactionItem { public string Emoji { get; set; } = ""; public List<string> Users { get; set; } = new(); }

// ═══════════════════════════════════════════════════════════
// DIRECT MESSAGES CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/dm")]
public class DmController : BaseController
{
    private readonly IDmService _dmService;
    public DmController(IDmService dmService) { _dmService = dmService; }

    /// <summary>Returns (or creates) the DM channel between current user and peerId.</summary>
    [HttpGet("{peerId:guid}")]
    public async Task<ActionResult<DmChannelDto>> GetOrCreate(Guid peerId)
    {
        var result = await _dmService.GetOrCreateDmChannelAsync(GetUserId(), peerId);
        return Ok(result);
    }

    /// <summary>Resolve a DM channel to the peer user id for the current user.</summary>
    [HttpGet("channel/{channelId:guid}")]
    public async Task<ActionResult<object>> GetPeerByChannel(Guid channelId)
    {
        var peerId = await _dmService.GetDmPeerAsync(channelId, GetUserId());
        if (!peerId.HasValue) return NotFound();
        return Ok(new { peerId = peerId.Value });
    }
}

// ═══════════════════════════════════════════════════════════
// GROUPS CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/groups")]
public class GroupsController : BaseController
{
    private readonly IChatService _chatService;
    public GroupsController(IChatService chatService) { _chatService = chatService; }

    [HttpPost]
    public async Task<ActionResult<GroupDmDto>> CreateGroup([FromBody] CreateGroupDmRequest request)
    {
        var result = await _chatService.CreateGroupDmAsync(GetUserId(), request.UserIds, request.Name);
        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<List<GroupDmDto>>> GetGroups()
    {
        var result = await _chatService.GetUserGroupDmsAsync(GetUserId());
        return Ok(result);
    }
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/notifications")]
public class NotificationsController : BaseController
{
    private readonly INotificationService _notificationService;
    public NotificationsController(INotificationService notificationService) { _notificationService = notificationService; }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NotificationDto>>> Get([FromQuery] int page = 1)
    {
        return Ok(await _notificationService.GetNotificationsAsync(GetUserId(), page));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetUnreadCount()
    {
        return Ok(await _notificationService.GetUnreadCountAsync(GetUserId()));
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        await _notificationService.MarkAsReadAsync(id, GetUserId());
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        await _notificationService.MarkAllAsReadAsync(GetUserId());
        return NoContent();
    }
}

// ═══════════════════════════════════════════════════════════
// ADMIN STATS CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize(Roles = "Admin,Director,Manager")]
[Route("api/admin")]
public class AdminController : BaseController
{
    private readonly IUnitOfWork _uow;
    public AdminController(IUnitOfWork uow) { _uow = uow; }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var now = DateTime.UtcNow;
        var today = DateTime.SpecifyKind(now.Date, DateTimeKind.Utc);
        var tomorrow = today.AddDays(1);
        var weekStart = today.AddDays(-6);
        var sixMonthsAgo = DateTime.SpecifyKind(new DateTime(today.Year, today.Month, 1), DateTimeKind.Utc).AddMonths(-5);

        // Messages today
        var messagesToday = await _uow.Messages.Query()
            .CountAsync(m => m.CreatedAt >= today && m.CreatedAt < tomorrow && !m.IsDeleted && m.ParentId == null);

        // Fetch last 7 days of messages (minimal data for grouping)
        var recentDates = await _uow.Messages.Query()
            .Where(m => m.CreatedAt >= weekStart && m.CreatedAt < tomorrow && !m.IsDeleted && m.ParentId == null)
            .Select(m => m.CreatedAt)
            .ToListAsync();

        var weeklyActivity = Enumerable.Range(0, 7).Select(i =>
        {
            var date = weekStart.AddDays(i);
            var nextDate = date.AddDays(1);
            return new { day = date.ToString("ddd"), messages = recentDates.Count(d => d >= date && d < nextDate) };
        });

        // Fetch last 6 months of messages for monthly chart
        var monthlyDates = await _uow.Messages.Query()
            .Where(m => m.CreatedAt >= sixMonthsAgo && !m.IsDeleted && m.ParentId == null)
            .Select(m => m.CreatedAt)
            .ToListAsync();

        var monthlyActivity = Enumerable.Range(0, 6).Select(i =>
        {
            var monthStart = sixMonthsAgo.AddMonths(i);
            var monthEnd = monthStart.AddMonths(1);
            return new { month = monthStart.ToString("MMM"), messages = monthlyDates.Count(d => d >= monthStart && d < monthEnd) };
        });

        var teamCount = await _uow.Teams.Query().CountAsync();

        return Ok(new { messagesToday, teamCount, weeklyActivity, monthlyActivity });
    }
}

// ═══════════════════════════════════════════════════════════
// USER STATS CONTROLLER (home page)
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/stats")]
public class UserStatsController : BaseController
{
    private readonly IUnitOfWork _uow;
    public UserStatsController(IUnitOfWork uow) { _uow = uow; }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyStats()
    {
        var userId = GetUserId();
        var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
        var weekStart = today.AddDays(-6);
        var monthStart = DateTime.SpecifyKind(new DateTime(today.Year, today.Month, 1), DateTimeKind.Utc);

        var weekDates = await _uow.Messages.Query()
            .Where(m => m.UserId == userId && m.CreatedAt >= weekStart && !m.IsDeleted)
            .Select(m => m.CreatedAt)
            .ToListAsync();

        var messagesThisMonth = await _uow.Messages.Query()
            .CountAsync(m => m.UserId == userId && m.CreatedAt >= monthStart && !m.IsDeleted);

        var weeklyActivity = Enumerable.Range(0, 7).Select(i =>
        {
            var date = weekStart.AddDays(i);
            var nextDate = date.AddDays(1);
            return new { day = date.ToString("ddd"), messages = weekDates.Count(d => d >= date && d < nextDate) };
        });

        return Ok(new
        {
            messagesThisWeek = weekDates.Count,
            messagesThisMonth,
            weeklyActivity,
        });
    }
}

// ═══════════════════════════════════════════════════════════
// FILE UPLOAD CONTROLLER
// ═══════════════════════════════════════════════════════════
[Authorize]
[Route("api/upload")]
public class UploadController : BaseController
{
    private readonly IWebHostEnvironment _env;
    public UploadController(IWebHostEnvironment env) { _env = env; }

    [HttpPost]
    [RequestSizeLimit(20 * 1024 * 1024)] // 20 MB
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file provided.");

        var allowed = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "application/pdf", "audio/webm", "audio/ogg", "audio/mpeg", "audio/wav" };
        if (!allowed.Contains(file.ContentType.ToLower()))
            return BadRequest("File type not allowed.");

        var uploadsDir = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);

        using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream);

        var url = $"/uploads/{fileName}";
        return Ok(new { url, fileName = file.FileName, contentType = file.ContentType, size = file.Length });
    }
}
