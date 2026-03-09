namespace NexusPlatform.Domain.Entities;

public class Message : BaseEntity
{
    public string Content { get; set; } = string.Empty;
    public Guid ChannelId { get; set; }
    public Guid UserId { get; set; }
    public Guid? ParentId { get; set; }
    public bool IsEdited { get; set; } = false;
    public bool IsDeleted { get; set; } = false;
    // JSON-stored reactions: [{emoji,users:[userId,...]}]
    public string ReactionsJson { get; set; } = "[]";

    // Navigation
    public Channel Channel { get; set; } = null!;
    public User User { get; set; } = null!;
    public Message? Parent { get; set; }
    public ICollection<Message> Replies { get; set; } = new List<Message>();
    public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
}
