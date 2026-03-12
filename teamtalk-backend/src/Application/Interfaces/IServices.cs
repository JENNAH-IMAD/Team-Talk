using TeamTalk.Application.DTOs.Auth;
using TeamTalk.Application.DTOs.Team;
using TeamTalk.Application.DTOs.Channel;
using TeamTalk.Application.DTOs.Chat;
using TeamTalk.Application.DTOs.Notification;

namespace TeamTalk.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken);
    Task<UserDto> GetCurrentUserAsync(Guid userId);
    Task LogoutAsync(Guid userId);
}

public interface IUserService
{
    Task<IEnumerable<UserDto>> GetAllUsersAsync();
    Task<UserDto?> GetUserByIdAsync(Guid id);
    Task<IEnumerable<UserDto>> SearchUsersAsync(string searchTerm, int page = 1, int pageSize = 20);
    Task UpdateUserStatusAsync(Guid userId, string status);
    Task UpdateUserRoleAsync(Guid userId, List<string>? roles, string role, string? secondaryRole = null);
    Task DeactivateUserAsync(Guid userId);
    Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task ChangePasswordAsync(Guid userId, string currentPassword, string newPassword);
    Task<UserDto> UpdateAvatarAsync(Guid userId, string avatarUrl);
}

public interface ITeamService
{
    Task<IEnumerable<TeamDto>> GetUserTeamsAsync(Guid userId);
    Task<TeamDto?> GetTeamByIdAsync(Guid teamId);
    Task<TeamDto> CreateTeamAsync(CreateTeamRequest request, Guid ownerId);
    Task<TeamDto> UpdateTeamAsync(Guid teamId, UpdateTeamRequest request);
    Task DeleteTeamAsync(Guid teamId);
    Task AddMemberAsync(Guid teamId, Guid userId);
    Task RemoveMemberAsync(Guid teamId, Guid userId);
}

public interface IChannelService
{
    Task<IEnumerable<ChannelDto>> GetTeamChannelsAsync(Guid teamId);
    Task<ChannelDto?> GetChannelByIdAsync(Guid channelId);
    Task<ChannelDto> CreateChannelAsync(Guid teamId, CreateChannelRequest request);
    Task DeleteChannelAsync(Guid channelId);
}

public interface IChatService
{
    Task<PaginatedResponse<MessageDto>> GetMessagesAsync(Guid channelId, int page = 1, int pageSize = 50);
    Task<MessageDto> SendMessageAsync(Guid channelId, Guid userId, SendMessageRequest request);
    Task<MessageDto> EditMessageAsync(Guid messageId, Guid userId, EditMessageRequest request);
    Task DeleteMessageAsync(Guid messageId, Guid userId);
    Task<GroupDmDto> CreateGroupDmAsync(Guid creatorId, List<Guid> userIds, string name);
    Task<List<GroupDmDto>> GetUserGroupDmsAsync(Guid userId);
}

public interface INotificationService
{
    Task<IEnumerable<NotificationDto>> GetNotificationsAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task MarkAsReadAsync(Guid notificationId, Guid userId);
    Task MarkAllAsReadAsync(Guid userId);
    Task CreateNotificationAsync(Guid userId, string type, string content, Guid? channelId = null);
}

public interface IDmService
{
    Task<DmChannelDto> GetOrCreateDmChannelAsync(Guid currentUserId, Guid peerId);
    Task<Guid?> GetDmPeerAsync(Guid channelId, Guid currentUserId);
}

public interface ITokenService
{
    string GenerateAccessToken(Guid userId, string email, IEnumerable<string> roles);
    string GenerateRefreshToken();
}

public interface IFileService
{
    Task<(string filePath, string contentType, long size)> UploadFileAsync(Stream fileStream, string fileName);
    void DeleteFile(string filePath);
    string[] GetAllowedExtensions();
    long GetMaxFileSize();
}
