namespace TeamTalk.Application.DTOs.Chat;

public class ReactionDto
{
    public string Emoji { get; set; } = string.Empty;
    public List<string> Users { get; set; } = new();
}

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid ChannelId { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public long Timestamp { get; set; }
    public bool IsEdited { get; set; }
    public int ThreadCount { get; set; }
    public Guid? ParentId { get; set; }
    public List<AttachmentDto> Attachments { get; set; } = new();
    public List<ReactionDto> Reactions { get; set; } = new();
}

public class AttachmentDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public long FileSize { get; set; }
}

public class AttachmentInput
{
    public string FilePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
}

public class SendMessageRequest
{
    public string Content { get; set; } = string.Empty;
    public Guid? ParentId { get; set; }
    public List<AttachmentInput>? Attachments { get; set; }
}

public class EditMessageRequest
{
    public string Content { get; set; } = string.Empty;
}

public class ToggleReactionRequest
{
    public string Emoji { get; set; } = string.Empty;
}

public class PaginatedResponse<T>
{
    public List<T> Data { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public bool HasMore { get; set; }
}
