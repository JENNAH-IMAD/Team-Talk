using System.Text.Json;
using AutoMapper;
using Microsoft.AspNetCore.Identity;
using TeamTalk.Application.DTOs.Auth;
using TeamTalk.Application.DTOs.Team;
using TeamTalk.Application.DTOs.Channel;
using TeamTalk.Application.DTOs.Chat;
using TeamTalk.Application.DTOs.Notification;
using TeamTalk.Application.Interfaces;
using TeamTalk.Domain.Entities;
using TeamTalk.Domain.Enums;
using TeamTalk.Domain.Interfaces;
namespace TeamTalk.Application.Services;

// ═══════════════════════════════════════════════════════════
// USER SERVICE
// ═══════════════════════════════════════════════════════════
public class UserService : IUserService
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;
    private static readonly UserRole[] RolePriority = { UserRole.Director, UserRole.Admin, UserRole.Manager, UserRole.Employee };

    public UserService(IUnitOfWork uow, IMapper mapper) { _uow = uow; _mapper = mapper; }

    public async Task<IEnumerable<UserDto>> GetAllUsersAsync()
    {
        var users = await _uow.Users.GetAllAsync();
        return _mapper.Map<IEnumerable<UserDto>>(users);
    }

    public async Task<UserDto?> GetUserByIdAsync(Guid id)
    {
        var user = await _uow.Users.GetByIdAsync(id);
        return user == null ? null : _mapper.Map<UserDto>(user);
    }

    public async Task<IEnumerable<UserDto>> SearchUsersAsync(string searchTerm, int page = 1, int pageSize = 20)
    {
        var users = await _uow.Users.SearchUsersAsync(searchTerm, page, pageSize);
        return _mapper.Map<IEnumerable<UserDto>>(users);
    }

    public async Task UpdateUserStatusAsync(Guid userId, string status)
    {
        var user = await _uow.Users.GetByIdAsync(userId) ?? throw new KeyNotFoundException("User not found");
        user.Status = Enum.Parse<UserStatus>(status, true);
        user.LastActiveAt = DateTime.UtcNow;
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();
    }

    public async Task UpdateUserRoleAsync(Guid userId, List<string>? roles, string role, string? secondaryRole = null)
    {
        var user = await _uow.Users.GetByIdAsync(userId) ?? throw new KeyNotFoundException("User not found");
        var normalized = NormalizeRoles(roles, role, secondaryRole);
        user.Role = normalized[0];
        user.SecondaryRole = normalized.Count > 1 ? normalized[1] : (UserRole?)null;
        user.RolesJson = JsonSerializer.Serialize(normalized.Select(r => r.ToString().ToLower()));
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();
    }

    public async Task DeactivateUserAsync(Guid userId)
    {
        var user = await _uow.Users.GetByIdAsync(userId) ?? throw new KeyNotFoundException("User not found");
        user.IsActive = false;
        user.Status = UserStatus.Offline;
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var user = await _uow.Users.GetByIdAsync(userId) ?? throw new KeyNotFoundException("User not found");
        if (!string.IsNullOrWhiteSpace(request.FirstName)) user.FirstName = request.FirstName.Trim();
        if (!string.IsNullOrWhiteSpace(request.LastName)) user.LastName = request.LastName.Trim();
        user.Title = request.Title?.Trim();
        user.Bio = request.Bio?.Trim();
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();
        return _mapper.Map<UserDto>(user);
    }

    public async Task ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)
    {
        var user = await _uow.Users.GetByIdAsync(userId) ?? throw new KeyNotFoundException("User not found");
        var hasher = new PasswordHasher<User>();
        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword);
        if (result == PasswordVerificationResult.Failed)
            throw new UnauthorizedAccessException("Current password is incorrect");
        user.PasswordHash = hasher.HashPassword(user, newPassword);
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();
    }

    public async Task<UserDto> UpdateAvatarAsync(Guid userId, string avatarUrl)
    {
        var user = await _uow.Users.GetByIdAsync(userId) ?? throw new KeyNotFoundException("User not found");
        user.AvatarUrl = avatarUrl;
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();
        return _mapper.Map<UserDto>(user);
    }

    private static List<UserRole> NormalizeRoles(IEnumerable<string>? roles, string? role, string? secondaryRole)
    {
        var set = new HashSet<UserRole>();
        if (roles != null)
        {
            foreach (var r in roles)
            {
                if (Enum.TryParse<UserRole>(r, true, out var parsed))
                    set.Add(parsed);
            }
        }

        if (set.Count == 0 && !string.IsNullOrWhiteSpace(role) &&
            Enum.TryParse<UserRole>(role, true, out var parsedRole))
            set.Add(parsedRole);

        if (set.Count == 0 && !string.IsNullOrWhiteSpace(secondaryRole) &&
            Enum.TryParse<UserRole>(secondaryRole, true, out var parsedSecondary))
            set.Add(parsedSecondary);

        if (set.Count == 0)
            set.Add(UserRole.Employee);

        return RolePriority.Where(set.Contains).ToList();
    }
}

// ═══════════════════════════════════════════════════════════
// DM SERVICE
// ═══════════════════════════════════════════════════════════
public class DmService : IDmService
{
    private readonly IUnitOfWork _uow;

    public DmService(IUnitOfWork uow) { _uow = uow; }

    public async Task<DmChannelDto> GetOrCreateDmChannelAsync(Guid currentUserId, Guid peerId)
    {
        // Normalize order so (A,B) and (B,A) map to same row
        var user1Id = currentUserId < peerId ? currentUserId : peerId;
        var user2Id = currentUserId < peerId ? peerId : currentUserId;

        var existing = await _uow.DirectConversations.GetByUsersAsync(user1Id, user2Id);
        if (existing != null) return new DmChannelDto { ChannelId = existing.ChannelId };

        // Create a channel for this DM (no team)
        var channel = new Channel
        {
            Name = $"dm-{user1Id}-{user2Id}",
            Description = "Direct Message",
            IsDm = true,
            IsPrivate = true,
        };
        await _uow.Channels.AddAsync(channel);

        var dm = new DirectConversation
        {
            User1Id = user1Id,
            User2Id = user2Id,
            ChannelId = channel.Id,
        };
        await _uow.DirectConversations.AddAsync(dm);
        await _uow.SaveChangesAsync();

        return new DmChannelDto { ChannelId = channel.Id };
    }

    public async Task<Guid?> GetDmPeerAsync(Guid channelId, Guid currentUserId)
    {
        var dm = await _uow.DirectConversations.GetByChannelAsync(channelId);
        if (dm == null) return null;
        return dm.User1Id == currentUserId ? dm.User2Id : dm.User1Id;
    }
}

// ═══════════════════════════════════════════════════════════
// TEAM SERVICE
// ═══════════════════════════════════════════════════════════
public class TeamService : ITeamService
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public TeamService(IUnitOfWork uow, IMapper mapper) { _uow = uow; _mapper = mapper; }

    public async Task<IEnumerable<TeamDto>> GetUserTeamsAsync(Guid userId)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        var isDirectorOrAdmin = user?.Role == UserRole.Admin || user?.Role == UserRole.Director ||
                                user?.SecondaryRole == UserRole.Admin || user?.SecondaryRole == UserRole.Director;

        IEnumerable<Team> teams;
        if (isDirectorOrAdmin)
        {
            teams = await _uow.Teams.GetActiveTeamsWithMembersAsync();
        }
        else
        {
            teams = await _uow.Teams.GetUserTeamsAsync(userId);
        }
        return _mapper.Map<IEnumerable<TeamDto>>(teams);
    }

    public async Task<TeamDto?> GetTeamByIdAsync(Guid teamId)
    {
        var team = await _uow.Teams.GetTeamWithMembersAsync(teamId);
        return team == null ? null : _mapper.Map<TeamDto>(team);
    }

    public async Task<TeamDto> CreateTeamAsync(CreateTeamRequest request, Guid ownerId)
    {
        var team = new Team
        {
            Name = request.Name,
            Description = request.Description,
            Icon = request.Icon ?? "⚡",
            Color = request.Color ?? "#6247ea",
            OwnerId = ownerId
        };

        await _uow.Teams.AddAsync(team);

        // Add owner as a member
        var membership = new TeamMember { TeamId = team.Id, UserId = ownerId, Role = TeamMemberRole.Owner };
        await _uow.TeamMembers.AddAsync(membership);
        await _uow.SaveChangesAsync();

        // Create default #general channel
        var channel = new Channel { Name = "general", Description = "General discussion", TeamId = team.Id };
        await _uow.Channels.AddAsync(channel);
        await _uow.SaveChangesAsync();

        return _mapper.Map<TeamDto>(await _uow.Teams.GetTeamWithMembersAsync(team.Id));
    }

    public async Task<TeamDto> UpdateTeamAsync(Guid teamId, UpdateTeamRequest request)
    {
        var team = await _uow.Teams.GetByIdAsync(teamId) ?? throw new KeyNotFoundException("Team not found");
        if (request.Name != null) team.Name = request.Name;
        if (request.Description != null) team.Description = request.Description;
        if (request.Icon != null) team.Icon = request.Icon;
        if (request.Color != null) team.Color = request.Color;
        team.UpdatedAt = DateTime.UtcNow;
        await _uow.Teams.UpdateAsync(team);
        await _uow.SaveChangesAsync();
        return _mapper.Map<TeamDto>(await _uow.Teams.GetTeamWithMembersAsync(team.Id));
    }

    public async Task DeleteTeamAsync(Guid teamId)
    {
        await _uow.Teams.DeleteAsync(teamId);
        await _uow.SaveChangesAsync();
    }

    public async Task AddMemberAsync(Guid teamId, Guid userId)
    {
        var existing = await _uow.TeamMembers.GetMembershipAsync(teamId, userId);
        if (existing != null) throw new InvalidOperationException("User is already a member");

        var membership = new TeamMember { TeamId = teamId, UserId = userId };
        await _uow.TeamMembers.AddAsync(membership);
        await _uow.SaveChangesAsync();
    }

    public async Task RemoveMemberAsync(Guid teamId, Guid userId)
    {
        var membership = await _uow.TeamMembers.GetMembershipAsync(teamId, userId)
            ?? throw new KeyNotFoundException("Membership not found");
        await _uow.TeamMembers.DeleteAsync(membership.Id);
        await _uow.SaveChangesAsync();
    }
}

// ═══════════════════════════════════════════════════════════
// CHANNEL SERVICE
// ═══════════════════════════════════════════════════════════
public class ChannelService : IChannelService
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public ChannelService(IUnitOfWork uow, IMapper mapper) { _uow = uow; _mapper = mapper; }

    public async Task<IEnumerable<ChannelDto>> GetTeamChannelsAsync(Guid teamId)
    {
        var channels = await _uow.Channels.GetTeamChannelsAsync(teamId);
        return _mapper.Map<IEnumerable<ChannelDto>>(channels);
    }

    public async Task<ChannelDto?> GetChannelByIdAsync(Guid channelId)
    {
        var channel = await _uow.Channels.GetByIdAsync(channelId);
        return channel == null ? null : _mapper.Map<ChannelDto>(channel);
    }

    public async Task<ChannelDto> CreateChannelAsync(Guid teamId, CreateChannelRequest request)
    {
        var channel = new Channel
        {
            Name = request.Name.ToLower(),
            Description = request.Description,
            TeamId = teamId,
            IsPrivate = request.IsPrivate,
            IsVoice = request.IsVoice
        };
        await _uow.Channels.AddAsync(channel);
        await _uow.SaveChangesAsync();
        return _mapper.Map<ChannelDto>(channel);
    }

    public async Task DeleteChannelAsync(Guid channelId)
    {
        await _uow.Channels.DeleteAsync(channelId);
        await _uow.SaveChangesAsync();
    }
}

// ═══════════════════════════════════════════════════════════
// CHAT SERVICE
// ═══════════════════════════════════════════════════════════
public class ChatService : IChatService
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public ChatService(IUnitOfWork uow, IMapper mapper) { _uow = uow; _mapper = mapper; }

    public async Task<PaginatedResponse<MessageDto>> GetMessagesAsync(Guid channelId, int page = 1, int pageSize = 50)
    {
        var messages = await _uow.Messages.GetChannelMessagesAsync(channelId, page, pageSize);
        var total = await _uow.Messages.GetChannelMessageCountAsync(channelId);

        return new PaginatedResponse<MessageDto>
        {
            Data = _mapper.Map<List<MessageDto>>(messages),
            Total = total,
            Page = page,
            PageSize = pageSize,
            HasMore = page * pageSize < total
        };
    }

    public async Task<MessageDto> SendMessageAsync(Guid channelId, Guid userId, SendMessageRequest request)
    {
        var message = new Message
        {
            Content = request.Content,
            ChannelId = channelId,
            UserId = userId,
            ParentId = request.ParentId
        };

        await _uow.Messages.AddAsync(message);

        // Update channel last message time
        var channel = await _uow.Channels.GetByIdAsync(channelId);
        if (channel != null)
        {
            channel.LastMessageAt = DateTime.UtcNow;
            await _uow.Channels.UpdateAsync(channel);
        }

        await _uow.SaveChangesAsync();

        // Re-fetch with navigation properties
        var saved = await _uow.Messages.GetByIdAsync(message.Id);
        return _mapper.Map<MessageDto>(saved);
    }

    public async Task<MessageDto> EditMessageAsync(Guid messageId, Guid userId, EditMessageRequest request)
    {
        var message = await _uow.Messages.GetByIdAsync(messageId)
            ?? throw new KeyNotFoundException("Message not found");
        if (message.UserId != userId)
            throw new UnauthorizedAccessException("You can only edit your own messages");

        message.Content = request.Content;
        message.IsEdited = true;
        message.UpdatedAt = DateTime.UtcNow;
        await _uow.Messages.UpdateAsync(message);
        await _uow.SaveChangesAsync();

        return _mapper.Map<MessageDto>(message);
    }

    public async Task DeleteMessageAsync(Guid messageId, Guid userId)
    {
        var message = await _uow.Messages.GetByIdAsync(messageId)
            ?? throw new KeyNotFoundException("Message not found");
        if (message.UserId != userId)
            throw new UnauthorizedAccessException("You can only delete your own messages");

        message.IsDeleted = true;
        message.Content = "[Message deleted]";
        await _uow.Messages.UpdateAsync(message);
        await _uow.SaveChangesAsync();
    }

    public async Task<GroupDmDto> CreateGroupDmAsync(Guid creatorId, List<Guid> userIds, string name)
    {
        var allIds = userIds.Concat(new[] { creatorId }).Distinct().ToList();
        var channel = new Channel
        {
            Name = name,
            Description = string.Empty,
            IsDm = true,
            IsGroup = true,
            GroupName = name,
        };
        await _uow.Channels.AddAsync(channel);
        await _uow.SaveChangesAsync();
        foreach (var uid in allIds)
        {
            var gp = new GroupParticipant { ChannelId = channel.Id, UserId = uid };
            await _uow.GroupParticipants.AddAsync(gp);
        }
        await _uow.SaveChangesAsync();
        var users = await _uow.Users.GetAllAsync();
        var participants = users.Where(u => allIds.Contains(u.Id)).Select(u => _mapper.Map<UserDto>(u)).ToList();
        return new GroupDmDto { ChannelId = channel.Id, Name = name, Participants = participants };
    }

    public async Task<List<GroupDmDto>> GetUserGroupDmsAsync(Guid userId)
    {
        var gps = await _uow.GroupParticipants.GetByUserIdAsync(userId);
        var filtered = gps.Where(gp => gp.Channel.IsGroup).ToList();
        var result = new List<GroupDmDto>();
        foreach (var gp in filtered)
        {
            var channelParticipants = await _uow.GroupParticipants.GetByChannelIdAsync(gp.ChannelId);
            var participants = channelParticipants.Select(p => _mapper.Map<UserDto>(p.User)).ToList();
            result.Add(new GroupDmDto { ChannelId = gp.ChannelId, Name = gp.Channel.GroupName ?? gp.Channel.Name, Participants = participants });
        }
        return result;
    }
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATION SERVICE
// ═══════════════════════════════════════════════════════════
public class NotificationService : INotificationService
{
    private readonly IUnitOfWork _uow;
    private readonly IMapper _mapper;

    public NotificationService(IUnitOfWork uow, IMapper mapper) { _uow = uow; _mapper = mapper; }

    public async Task<IEnumerable<NotificationDto>> GetNotificationsAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        var notifs = await _uow.Notifications.GetUserNotificationsAsync(userId, page, pageSize);
        return _mapper.Map<IEnumerable<NotificationDto>>(notifs);
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _uow.Notifications.GetUnreadCountAsync(userId);
    }

    public async Task MarkAsReadAsync(Guid notificationId, Guid userId)
    {
        var notif = await _uow.Notifications.GetByIdAsync(notificationId);
        if (notif != null && notif.UserId == userId)
        {
            notif.IsRead = true;
            await _uow.Notifications.UpdateAsync(notif);
            await _uow.SaveChangesAsync();
        }
    }

    public async Task MarkAllAsReadAsync(Guid userId)
    {
        await _uow.Notifications.MarkAllAsReadAsync(userId);
        await _uow.SaveChangesAsync();
    }

    public async Task CreateNotificationAsync(Guid userId, string type, string content, Guid? channelId = null)
    {
        var notif = new Notification
        {
            UserId = userId,
            Type = Enum.Parse<NotificationType>(type, true),
            Content = content,
            ChannelId = channelId
        };
        await _uow.Notifications.AddAsync(notif);
        await _uow.SaveChangesAsync();
    }
}
