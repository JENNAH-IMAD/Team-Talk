using Microsoft.EntityFrameworkCore;
using TeamTalk.Domain.Entities;
using TeamTalk.Domain.Interfaces;
using TeamTalk.Infrastructure.Persistence;

namespace TeamTalk.Infrastructure.Repositories;

// ── Generic Repository ───────────────────────────────────────
public class Repository<T> : IRepository<T> where T : BaseEntity
{
    protected readonly AppDbContext _db;
    protected readonly DbSet<T> _set;

    public Repository(AppDbContext db) { _db = db; _set = db.Set<T>(); }

    public virtual async Task<T?> GetByIdAsync(Guid id) => await _set.FindAsync(id);
    public virtual async Task<IEnumerable<T>> GetAllAsync() => await _set.ToListAsync();
    public virtual async Task<T> AddAsync(T entity) { await _set.AddAsync(entity); return entity; }
    public virtual Task UpdateAsync(T entity) { _set.Update(entity); return Task.CompletedTask; }
    public virtual async Task DeleteAsync(Guid id) { var e = await _set.FindAsync(id); if (e != null) _set.Remove(e); }
    public IQueryable<T> Query() => _set.AsQueryable();
}

// ── User Repository ──────────────────────────────────────────
public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(AppDbContext db) : base(db) { }

    public async Task<User?> GetByEmailAsync(string email) =>
        await _set.FirstOrDefaultAsync(u => u.Email == email.ToLower());

    public async Task<User?> GetByRefreshTokenAsync(string refreshToken) =>
        await _set.FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

    public async Task<IEnumerable<User>> SearchUsersAsync(string searchTerm, int page, int pageSize) =>
        await _set.Where(u => u.FirstName.Contains(searchTerm) || u.LastName.Contains(searchTerm) || u.Email.Contains(searchTerm))
            .OrderBy(u => u.FirstName).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
}

// ── Team Repository ──────────────────────────────────────────
public class TeamRepository : Repository<Team>, ITeamRepository
{
    public TeamRepository(AppDbContext db) : base(db) { }

    public async Task<IEnumerable<Team>> GetActiveTeamsWithMembersAsync() =>
        await _set.Include(t => t.Members).Where(t => t.IsActive).ToListAsync();

    public async Task<IEnumerable<Team>> GetUserTeamsAsync(Guid userId) =>
        await _set.Include(t => t.Members).Where(t => t.Members.Any(m => m.UserId == userId) && t.IsActive).ToListAsync();

    public async Task<Team?> GetTeamWithMembersAsync(Guid teamId) =>
        await _set.Include(t => t.Members).Include(t => t.Channels).FirstOrDefaultAsync(t => t.Id == teamId);
}

// ── Channel Repository ───────────────────────────────────────
public class ChannelRepository : Repository<Channel>, IChannelRepository
{
    public ChannelRepository(AppDbContext db) : base(db) { }

    public async Task<IEnumerable<Channel>> GetTeamChannelsAsync(Guid teamId) =>
        await _set.Where(c => c.TeamId == teamId).OrderBy(c => c.Name).ToListAsync();

    public async Task<Channel?> GetChannelWithMessagesAsync(Guid channelId, int page, int pageSize) =>
        await _set.Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize))
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == channelId);
}

// ── Message Repository ───────────────────────────────────────
public class MessageRepository : Repository<Message>, IMessageRepository
{
    public MessageRepository(AppDbContext db) : base(db) { }

    public override async Task<Message?> GetByIdAsync(Guid id) =>
        await _set.Include(m => m.User).Include(m => m.Replies).Include(m => m.Attachments).FirstOrDefaultAsync(m => m.Id == id);

    public async Task<IEnumerable<Message>> GetChannelMessagesAsync(Guid channelId, int page, int pageSize) =>
        await _set.Where(m => m.ChannelId == channelId && !m.IsDeleted && m.ParentId == null)
            .Include(m => m.User).Include(m => m.Replies).Include(m => m.Attachments)
            .OrderBy(m => m.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

    public async Task<int> GetChannelMessageCountAsync(Guid channelId) =>
        await _set.CountAsync(m => m.ChannelId == channelId && !m.IsDeleted && m.ParentId == null);

    public async Task<IEnumerable<Message>> GetThreadRepliesAsync(Guid parentId) =>
        await _set.Where(m => m.ParentId == parentId && !m.IsDeleted)
            .Include(m => m.User).OrderBy(m => m.CreatedAt).ToListAsync();
}

// ── Notification Repository ──────────────────────────────────
public class NotificationRepository : Repository<Notification>, INotificationRepository
{
    public NotificationRepository(AppDbContext db) : base(db) { }

    public async Task<IEnumerable<Notification>> GetUserNotificationsAsync(Guid userId, int page, int pageSize) =>
        await _set.Where(n => n.UserId == userId).OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

    public async Task<int> GetUnreadCountAsync(Guid userId) =>
        await _set.CountAsync(n => n.UserId == userId && !n.IsRead);

    public async Task MarkAllAsReadAsync(Guid userId) =>
        await _set.Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
}

// ── TeamMember Repository ────────────────────────────────────
public class TeamMemberRepository : Repository<TeamMember>, ITeamMemberRepository
{
    public TeamMemberRepository(AppDbContext db) : base(db) { }

    public async Task<TeamMember?> GetMembershipAsync(Guid teamId, Guid userId) =>
        await _set.FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == userId);

    public async Task<bool> IsMemberAsync(Guid teamId, Guid userId) =>
        await _set.AnyAsync(tm => tm.TeamId == teamId && tm.UserId == userId);
}

// ── DirectConversation Repository ────────────────────────────
public class DirectConversationRepository : Repository<DirectConversation>, IDirectConversationRepository
{
    public DirectConversationRepository(AppDbContext db) : base(db) { }

    public async Task<DirectConversation?> GetByUsersAsync(Guid user1Id, Guid user2Id)
    {
        var a = user1Id < user2Id ? user1Id : user2Id;
        var b = user1Id < user2Id ? user2Id : user1Id;
        return await _set.FirstOrDefaultAsync(d => d.User1Id == a && d.User2Id == b);
    }

    public async Task<DirectConversation?> GetByChannelAsync(Guid channelId) =>
        await _set.FirstOrDefaultAsync(d => d.ChannelId == channelId);
}

// ── GroupParticipant Repository ───────────────────────────────
public class GroupParticipantRepository : Repository<GroupParticipant>, IGroupParticipantRepository
{
    public GroupParticipantRepository(AppDbContext db) : base(db) { }

    public async Task<List<GroupParticipant>> GetByUserIdAsync(Guid userId) =>
        await _set.Include(gp => gp.Channel).Where(gp => gp.UserId == userId).ToListAsync();

    public async Task<List<GroupParticipant>> GetByChannelIdAsync(Guid channelId) =>
        await _set.Include(gp => gp.User).Where(gp => gp.ChannelId == channelId).ToListAsync();
}

// ── Unit of Work ─────────────────────────────────────────────
public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _db;
    public IUserRepository Users { get; }
    public ITeamRepository Teams { get; }
    public IChannelRepository Channels { get; }
    public IMessageRepository Messages { get; }
    public INotificationRepository Notifications { get; }
    public ITeamMemberRepository TeamMembers { get; }
    public IDirectConversationRepository DirectConversations { get; }
    public IGroupParticipantRepository GroupParticipants { get; }

    public UnitOfWork(AppDbContext db)
    {
        _db = db;
        Users = new UserRepository(db);
        Teams = new TeamRepository(db);
        Channels = new ChannelRepository(db);
        Messages = new MessageRepository(db);
        Notifications = new NotificationRepository(db);
        TeamMembers = new TeamMemberRepository(db);
        DirectConversations = new DirectConversationRepository(db);
        GroupParticipants = new GroupParticipantRepository(db);
    }

    public async Task<int> SaveChangesAsync() => await _db.SaveChangesAsync();
    public void Dispose() => _db.Dispose();
}
