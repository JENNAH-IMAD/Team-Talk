using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TeamTalk.Domain.Entities;
using TeamTalk.Domain.Enums;

namespace TeamTalk.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Database.MigrateAsync();

        if (await db.Users.AnyAsync()) return;

        // ── Users ─────────────────────────────────────────
        var salma = new User
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            FirstName = "Salma", LastName = "El Fassi",
            Email = "salma@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Admin, Status = UserStatus.Online,
            Title = "Engineering Lead"
        };
        var yassine = new User
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            FirstName = "Yassine", LastName = "Benali",
            Email = "yassine@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Online,
            Title = "Senior Developer"
        };
        var nadia = new User
        {
            Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
            FirstName = "Nadia", LastName = "Berrada",
            Email = "nadia@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Away,
            Title = "Product Designer"
        };
        var mehdi = new User
        {
            Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
            FirstName = "Mehdi", LastName = "Cherkaoui",
            Email = "mehdi@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Offline,
            Title = "Backend Engineer"
        };
        var fatima = new User
        {
            Id = Guid.Parse("55555555-5555-5555-5555-555555555555"),
            FirstName = "Fatima", LastName = "Idrissi",
            Email = "fatima@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Manager, Status = UserStatus.Online,
            Title = "Project Manager"
        };
        var zineb = new User
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
            FirstName = "Zineb", LastName = "Amrani",
            Email = "zineb@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Online,
            Title = "Frontend Developer"
        };
        var karim = new User
        {
            Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
            FirstName = "Karim", LastName = "Tazi",
            Email = "karim@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = UserRole.Employee, Status = UserStatus.Away,
            Title = "DevOps Engineer"
        };

        db.Users.AddRange(salma, yassine, nadia, mehdi, fatima, zineb, karim);

        // ── Teams ─────────────────────────────────────────
        var engineering = new Team
        {
            Id = Guid.Parse("aaaa1111-1111-1111-1111-111111111111"),
            Name = "Engineering", Description = "Core engineering team",
            Icon = "⚡", Color = "#6247ea", OwnerId = salma.Id
        };
        var design = new Team
        {
            Id = Guid.Parse("aaaa2222-2222-2222-2222-222222222222"),
            Name = "Design", Description = "Product design team",
            Icon = "🎨", Color = "#10b981", OwnerId = nadia.Id
        };
        var marketing = new Team
        {
            Id = Guid.Parse("aaaa3333-3333-3333-3333-333333333333"),
            Name = "Marketing", Description = "Marketing & growth",
            Icon = "📈", Color = "#f59e0b", OwnerId = fatima.Id
        };
        db.Teams.AddRange(engineering, design, marketing);

        // ── Team Members ──────────────────────────────────
        db.TeamMembers.AddRange(
            new TeamMember { TeamId = engineering.Id, UserId = salma.Id, Role = TeamMemberRole.Owner },
            new TeamMember { TeamId = engineering.Id, UserId = yassine.Id },
            new TeamMember { TeamId = engineering.Id, UserId = mehdi.Id },
            new TeamMember { TeamId = engineering.Id, UserId = zineb.Id },
            new TeamMember { TeamId = engineering.Id, UserId = karim.Id },
            new TeamMember { TeamId = design.Id, UserId = nadia.Id, Role = TeamMemberRole.Owner },
            new TeamMember { TeamId = design.Id, UserId = fatima.Id },
            new TeamMember { TeamId = marketing.Id, UserId = fatima.Id, Role = TeamMemberRole.Owner }
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
            new Message { ChannelId = general.Id, UserId = yassine.Id, Content = "Salam l'équipe ! Je viens de push le nouveau module d'authentification. Quelqu'un peut review la PR ?", CreatedAt = DateTime.UtcNow.AddHours(-5) },
            new Message { ChannelId = general.Id, UserId = salma.Id, Content = "Bon travail @Yassine ! Je vais y jeter un œil cet après-midi. T'as ajouté la logique de refresh token ?", CreatedAt = DateTime.UtcNow.AddHours(-4.5) },
            new Message { ChannelId = general.Id, UserId = yassine.Id, Content = "Oui, la rotation du refresh token est implémentée avec une fenêtre glissante. J'ai aussi ajouté le rate limiting sur l'endpoint.", CreatedAt = DateTime.UtcNow.AddHours(-4), IsEdited = true },
            new Message { ChannelId = general.Id, UserId = zineb.Id, Content = "Je travaille sur le nouveau composant de notifications. Il supporte les variantes toast, bannière et inline avec des animations.", CreatedAt = DateTime.UtcNow.AddHours(-3) },
            new Message { ChannelId = general.Id, UserId = mehdi.Id, Content = "Migration BDD déployée pour le nouveau schéma de messagerie. Tous les services sont au vert. 🟢", CreatedAt = DateTime.UtcNow.AddHours(-2) },
            new Message { ChannelId = general.Id, UserId = karim.Id, Content = "Pipeline CI/CD mis à jour. Les temps de build ont baissé de 40% après le switch vers la nouvelle stratégie de cache.", CreatedAt = DateTime.UtcNow.AddHours(-1) },
            new Message { ChannelId = general.Id, UserId = salma.Id, Content = "Standup dans 30 minutes. Préparez vos updates : review du module auth, système de notifs, et pipeline de déploiement.", CreatedAt = DateTime.UtcNow.AddMinutes(-30) }
        );

        // ── Notifications ─────────────────────────────────
        db.Notifications.AddRange(
            new Notification { UserId = salma.Id, Type = NotificationType.Mention, Content = "Yassine Benali vous a mentionné dans #general", ChannelId = general.Id },
            new Notification { UserId = salma.Id, Type = NotificationType.Reply, Content = "Zineb Amrani a répondu à votre fil de discussion", ChannelId = frontend.Id },
            new Notification { UserId = salma.Id, Type = NotificationType.TeamInvitation, Content = "Vous avez été ajouté à l'équipe Design", IsRead = true },
            new Notification { UserId = salma.Id, Type = NotificationType.System, Content = "Maintenance système prévue cette nuit", IsRead = true }
        );

        await db.SaveChangesAsync();
    }
}
