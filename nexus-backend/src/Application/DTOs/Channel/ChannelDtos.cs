namespace NexusPlatform.Application.DTOs.Channel;

public class ChannelDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? TeamId { get; set; }
    public bool IsPrivate { get; set; }
    public bool IsDm { get; set; }
    public int PinnedCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastMessageAt { get; set; }
}

public class DmChannelDto
{
    public Guid ChannelId { get; set; }
}

public class CreateChannelRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsPrivate { get; set; } = false;
}
