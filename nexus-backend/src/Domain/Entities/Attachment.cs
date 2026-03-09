namespace NexusPlatform.Domain.Entities;

public class Attachment : BaseEntity
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public Guid MessageId { get; set; }

    // Navigation
    public Message Message { get; set; } = null!;
}
