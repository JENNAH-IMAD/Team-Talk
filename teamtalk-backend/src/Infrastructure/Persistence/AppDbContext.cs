using Microsoft.EntityFrameworkCore;
using TeamTalk.Domain.Entities;

namespace TeamTalk.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<DirectConversation> DirectConversations => Set<DirectConversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<GroupParticipant> GroupParticipants => Set<GroupParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.RefreshToken);
            e.Property(u => u.Email).HasMaxLength(256);
            e.Property(u => u.FirstName).HasMaxLength(50);
            e.Property(u => u.LastName).HasMaxLength(50);
        });

        // Team
        modelBuilder.Entity<Team>(e =>
        {
            e.HasOne(t => t.Owner).WithMany().HasForeignKey(t => t.OwnerId).OnDelete(DeleteBehavior.Restrict);
            e.Property(t => t.Name).HasMaxLength(100);
        });

        // TeamMember
        modelBuilder.Entity<TeamMember>(e =>
        {
            e.HasIndex(tm => new { tm.TeamId, tm.UserId }).IsUnique();
            e.HasOne(tm => tm.Team).WithMany(t => t.Members).HasForeignKey(tm => tm.TeamId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(tm => tm.User).WithMany(u => u.TeamMemberships).HasForeignKey(tm => tm.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // Channel
        modelBuilder.Entity<Channel>(e =>
        {
            e.HasOne(c => c.Team).WithMany(t => t.Channels).HasForeignKey(c => c.TeamId).IsRequired(false).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(c => c.TeamId);
            e.Property(c => c.Name).HasMaxLength(100);
        });

        // GroupParticipant
        modelBuilder.Entity<GroupParticipant>(e =>
        {
            e.HasOne(gp => gp.Channel).WithMany(c => c.GroupParticipants).HasForeignKey(gp => gp.ChannelId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(gp => gp.User).WithMany().HasForeignKey(gp => gp.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(gp => new { gp.ChannelId, gp.UserId }).IsUnique();
        });

        // DirectConversation
        modelBuilder.Entity<DirectConversation>(e =>
        {
            e.HasIndex(d => new { d.User1Id, d.User2Id }).IsUnique();
            e.HasOne(d => d.User1).WithMany().HasForeignKey(d => d.User1Id).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(d => d.User2).WithMany().HasForeignKey(d => d.User2Id).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(d => d.Channel).WithMany().HasForeignKey(d => d.ChannelId).OnDelete(DeleteBehavior.Cascade);
        });

        // Message
        modelBuilder.Entity<Message>(e =>
        {
            e.HasOne(m => m.Channel).WithMany(c => c.Messages).HasForeignKey(m => m.ChannelId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.User).WithMany(u => u.Messages).HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(m => m.Parent).WithMany(m => m.Replies).HasForeignKey(m => m.ParentId).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(m => m.ChannelId);
            e.HasIndex(m => m.CreatedAt);
            e.Property(m => m.Content).HasMaxLength(4000);
            e.Property(m => m.ReactionsJson).HasDefaultValue("[]");
        });

        // Attachment
        modelBuilder.Entity<Attachment>(e =>
        {
            e.HasOne(a => a.Message).WithMany(m => m.Attachments).HasForeignKey(a => a.MessageId).OnDelete(DeleteBehavior.Cascade);
        });

        // Notification
        modelBuilder.Entity<Notification>(e =>
        {
            e.HasOne(n => n.User).WithMany(u => u.Notifications).HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(n => new { n.UserId, n.IsRead });
        });
    }
}
