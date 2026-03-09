using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NexusPlatform.Domain.Entities;
using NexusPlatform.Domain.Enums;

namespace NexusPlatform.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Database.MigrateAsync();

        if (await db.Users.AnyAsync()) return;

        // ── Users ─────────────────────────────────────────
        var admin = new User
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            FirstName = "Sarah", LastName = "Chen",
            Email = "sarah@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Admin, Status = UserStatus.Online,
            Title = "Engineering Lead"
        };
        var marcus = new User
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            FirstName = "Marcus", LastName = "Johnson",
            Email = "marcus@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Online,
            Title = "Senior Developer"
        };
        var elena = new User
        {
            Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
            FirstName = "Elena", LastName = "Rodriguez",
            Email = "elena@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Away,
            Title = "Product Designer"
        };
        var david = new User
        {
            Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
            FirstName = "David", LastName = "Park",
            Email = "david@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Offline,
            Title = "Backend Engineer"
        };
        var aisha = new User
        {
            Id = Guid.Parse("55555555-5555-5555-5555-555555555555"),
            FirstName = "Aisha", LastName = "Patel",
            Email = "aisha@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Manager, Status = UserStatus.Online,
            Title = "Project Manager"
        };
        var lisa = new User
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
            FirstName = "Lisa", LastName = "Thompson",
            Email = "lisa@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Online,
            Title = "Frontend Developer"
        };
        var omar = new User
        {
            Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
            FirstName = "Omar", LastName = "Hassan",
            Email = "omar@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Away,
            Title = "DevOps Engineer"
        };

        db.Users.AddRange(admin, marcus, elena, david, aisha, lisa, omar);

        // ── Teams ─────────────────────────────────────────
        var engineering = new Team
        {
            Id = Guid.Parse("aaaa1111-1111-1111-1111-111111111111"),
            Name = "Engineering", Description = "Core engineering team",
            Icon = "⚡", Color = "#6247ea", OwnerId = admin.Id
        };
        var design = new Team
        {
            Id = Guid.Parse("aaaa2222-2222-2222-2222-222222222222"),
            Name = "Design", Description = "Product design team",
            Icon = "🎨", Color = "#10b981", OwnerId = elena.Id
        };
        var marketing = new Team
        {
            Id = Guid.Parse("aaaa3333-3333-3333-3333-333333333333"),
            Name = "Marketing", Description = "Marketing & growth",
            Icon = "📈", Color = "#f59e0b", OwnerId = aisha.Id
        };
        db.Teams.AddRange(engineering, design, marketing);

        // ── Team Members ──────────────────────────────────
        db.TeamMembers.AddRange(
            new TeamMember { TeamId = engineering.Id, UserId = admin.Id, Role = TeamMemberRole.Owner },
            new TeamMember { TeamId = engineering.Id, UserId = marcus.Id },
            new TeamMember { TeamId = engineering.Id, UserId = david.Id },
            new TeamMember { TeamId = engineering.Id, UserId = lisa.Id },
            new TeamMember { TeamId = engineering.Id, UserId = omar.Id },
            new TeamMember { TeamId = design.Id, UserId = elena.Id, Role = TeamMemberRole.Owner },
            new TeamMember { TeamId = design.Id, UserId = aisha.Id },
            new TeamMember { TeamId = marketing.Id, UserId = aisha.Id, Role = TeamMemberRole.Owner }
        );

        // ── Channels ──────────────────────────────────────
        var general = new Channel { Id = Guid.Parse("cccc1111-1111-1111-1111-111111111111"), Name = "general", Description = "General engineering discussion", TeamId = engineering.Id };
        var frontend = new Channel { Id = Guid.Parse("cccc2222-2222-2222-2222-222222222222"), Name = "frontend", Description = "Frontend development", TeamId = engineering.Id };
        var backend = new Channel { Id = Guid.Parse("cccc3333-3333-3333-3333-333333333333"), Name = "backend", Description = "Backend & APIs", TeamId = engineering.Id };
        var devops = new Channel { Id = Guid.Parse("cccc4444-4444-4444-4444-444444444444"), Name = "devops", Description = "Infrastructure & deployment", TeamId = engineering.Id, IsPrivate = true };
        var designSystem = new Channel { Id = Guid.Parse("cccc5555-5555-5555-5555-555555555555"), Name = "design-system", Description = "Design system updates", TeamId = design.Id };
        var campaigns = new Channel { Id = Guid.Parse("cccc6666-6666-6666-6666-666666666666"), Name = "campaigns", Description = "Marketing campaigns", TeamId = marketing.Id };
        db.Channels.AddRange(general, frontend, backend, devops, designSystem, campaigns);

        // ── Messages ──────────────────────────────────────
        db.Messages.AddRange(
            new Message { ChannelId = general.Id, UserId = marcus.Id, Content = "Hey team! I just pushed the new authentication module. Can someone review the PR?", CreatedAt = DateTime.UtcNow.AddHours(-5) },
            new Message { ChannelId = general.Id, UserId = admin.Id, Content = "Great work @Marcus! I'll take a look at it this afternoon. Did you add the refresh token logic?", CreatedAt = DateTime.UtcNow.AddHours(-4.5) },
            new Message { ChannelId = general.Id, UserId = marcus.Id, Content = "Yes, the refresh token rotation is implemented with a sliding window. Also added rate limiting on the token endpoint.", CreatedAt = DateTime.UtcNow.AddHours(-4), IsEdited = true },
            new Message { ChannelId = general.Id, UserId = lisa.Id, Content = "I've been working on the new notification component. It supports toast, banner, and inline variants with animations.", CreatedAt = DateTime.UtcNow.AddHours(-3) },
            new Message { ChannelId = general.Id, UserId = david.Id, Content = "Just deployed the database migration for the new messaging schema. All services are green. 🟢", CreatedAt = DateTime.UtcNow.AddHours(-2) },
            new Message { ChannelId = general.Id, UserId = omar.Id, Content = "CI/CD pipeline is updated. Build times are down 40% after switching to the new caching strategy.", CreatedAt = DateTime.UtcNow.AddHours(-1) },
            new Message { ChannelId = general.Id, UserId = admin.Id, Content = "Team standup in 30 minutes. Please have your updates ready. Focus areas: auth module review, notification system, and deployment pipeline.", CreatedAt = DateTime.UtcNow.AddMinutes(-30) }
        );

        // ── Notifications ─────────────────────────────────
        db.Notifications.AddRange(
            new Notification { UserId = admin.Id, Type = NotificationType.Mention, Content = "Marcus Johnson mentioned you in #general", ChannelId = general.Id },
            new Notification { UserId = admin.Id, Type = NotificationType.Reply, Content = "Lisa Thompson replied to your thread", ChannelId = frontend.Id },
            new Notification { UserId = admin.Id, Type = NotificationType.TeamInvitation, Content = "You were added to Design team", IsRead = true },
            new Notification { UserId = admin.Id, Type = NotificationType.System, Content = "System maintenance scheduled for tonight", IsRead = true }
        );

        await db.SaveChangesAsync();
    }
}
