namespace NexusPlatform.Application.DTOs.Notification;

public class NotificationDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public long Timestamp { get; set; }
    public bool Read { get; set; }
    public Guid? ChannelId { get; set; }
    public Guid? UserId { get; set; }
}
