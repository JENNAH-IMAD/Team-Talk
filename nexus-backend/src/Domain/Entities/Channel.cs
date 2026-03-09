namespace NexusPlatform.Domain.Entities;

public class Channel : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? TeamId { get; set; }
    public bool IsPrivate { get; set; } = false;
    public bool IsDm { get; set; } = false;
    public DateTime? LastMessageAt { get; set; }

    // Navigation
    public Team? Team { get; set; }
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}

public class DirectConversation : BaseEntity
{
    public Guid User1Id { get; set; }
    public Guid User2Id { get; set; }
    public Guid ChannelId { get; set; }

    // Navigation
    public User User1 { get; set; } = null!;
    public User User2 { get; set; } = null!;
    public Channel Channel { get; set; } = null!;
}
