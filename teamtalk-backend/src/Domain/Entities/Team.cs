namespace TeamTalk.Domain.Entities;

public class Team : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = "⚡";
    public string Color { get; set; } = "#6247ea";
    public Guid OwnerId { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public User Owner { get; set; } = null!;
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
    public ICollection<Channel> Channels { get; set; } = new List<Channel>();
}
