using NexusPlatform.Domain.Entities;

namespace NexusPlatform.Domain.Interfaces;

public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(Guid id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(Guid id);
    IQueryable<T> Query();
}

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByRefreshTokenAsync(string refreshToken);
    Task<IEnumerable<User>> SearchUsersAsync(string searchTerm, int page, int pageSize);
}

public interface ITeamRepository : IRepository<Team>
{
    Task<IEnumerable<Team>> GetUserTeamsAsync(Guid userId);
    Task<Team?> GetTeamWithMembersAsync(Guid teamId);
}

public interface IChannelRepository : IRepository<Channel>
{
    Task<IEnumerable<Channel>> GetTeamChannelsAsync(Guid teamId);
    Task<Channel?> GetChannelWithMessagesAsync(Guid channelId, int page, int pageSize);
}

public interface IMessageRepository : IRepository<Message>
{
    Task<IEnumerable<Message>> GetChannelMessagesAsync(Guid channelId, int page, int pageSize);
    Task<int> GetChannelMessageCountAsync(Guid channelId);
    Task<IEnumerable<Message>> GetThreadRepliesAsync(Guid parentId);
}

public interface INotificationRepository : IRepository<Notification>
{
    Task<IEnumerable<Notification>> GetUserNotificationsAsync(Guid userId, int page, int pageSize);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task MarkAllAsReadAsync(Guid userId);
}

public interface ITeamMemberRepository : IRepository<TeamMember>
{
    Task<TeamMember?> GetMembershipAsync(Guid teamId, Guid userId);
    Task<bool> IsMemberAsync(Guid teamId, Guid userId);
}

public interface IDirectConversationRepository : IRepository<DirectConversation>
{
    Task<DirectConversation?> GetByUsersAsync(Guid user1Id, Guid user2Id);
    Task<DirectConversation?> GetByChannelAsync(Guid channelId);
}

public interface IUnitOfWork : IDisposable
{
    IUserRepository Users { get; }
    ITeamRepository Teams { get; }
    IChannelRepository Channels { get; }
    IMessageRepository Messages { get; }
    INotificationRepository Notifications { get; }
    ITeamMemberRepository TeamMembers { get; }
    IDirectConversationRepository DirectConversations { get; }
    Task<int> SaveChangesAsync();
}
