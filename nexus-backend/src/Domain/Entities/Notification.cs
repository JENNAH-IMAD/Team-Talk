using NexusPlatform.Domain.Enums;

namespace NexusPlatform.Domain.Entities;

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public Guid? ChannelId { get; set; }
    public Guid? MessageId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
