using TeamTalk.Application.DTOs.Auth;

namespace TeamTalk.Application.DTOs.Channel;

public class ChannelDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? TeamId { get; set; }
    public bool IsPrivate { get; set; }
    public bool IsDm { get; set; }
    public bool IsVoice { get; set; }
    public bool IsGroup { get; set; }
    public string? GroupName { get; set; }
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
    public bool IsVoice { get; set; } = false;
}

public class CreateGroupDmRequest
{
    public List<Guid> UserIds { get; set; } = new();
    public string Name { get; set; } = string.Empty;
}

public class GroupDmDto
{
    public Guid ChannelId { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<UserDto> Participants { get; set; } = new();
}
