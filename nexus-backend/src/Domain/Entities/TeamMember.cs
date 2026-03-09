using NexusPlatform.Domain.Enums;

namespace NexusPlatform.Domain.Entities;

public class TeamMember : BaseEntity
{
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }
    public TeamMemberRole Role { get; set; } = TeamMemberRole.Member;

    // Navigation
    public Team Team { get; set; } = null!;
    public User User { get; set; } = null!;
}
