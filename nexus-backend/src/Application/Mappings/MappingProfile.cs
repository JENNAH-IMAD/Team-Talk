using System.Text.Json;
using AutoMapper;
using NexusPlatform.Domain.Entities;
using NexusPlatform.Application.DTOs.Auth;
using NexusPlatform.Application.DTOs.Team;
using NexusPlatform.Application.DTOs.Channel;
using NexusPlatform.Application.DTOs.Chat;
using NexusPlatform.Application.DTOs.Notification;

namespace NexusPlatform.Application.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // User
        CreateMap<User, UserDto>()
            .ForMember(d => d.Name, o => o.MapFrom(s => s.FullName))
            .ForMember(d => d.Bio, o => o.MapFrom(s => s.Bio))
            .ForMember(d => d.Role, o => o.MapFrom(s => s.Role.ToString().ToLower()))
            .ForMember(d => d.SecondaryRole, o => o.MapFrom(s => s.SecondaryRole.HasValue ? s.SecondaryRole.Value.ToString().ToLower() : null))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString().ToLower()));

        // Team
        CreateMap<Team, TeamDto>()
            .ForMember(d => d.Members, o => o.MapFrom(s => s.Members.Select(m => m.UserId.ToString())))
            .ForMember(d => d.MemberCount, o => o.MapFrom(s => s.Members.Count));

        // Channel
        CreateMap<Channel, ChannelDto>()
            .ForMember(d => d.PinnedCount, o => o.MapFrom(s => 0));

        // Message
        CreateMap<Message, MessageDto>()
            .ForMember(d => d.UserName, o => o.MapFrom(s => s.User.FullName))
            .ForMember(d => d.Timestamp, o => o.MapFrom(s => new DateTimeOffset(s.CreatedAt, TimeSpan.Zero).ToUnixTimeMilliseconds()))
            .ForMember(d => d.IsEdited, o => o.MapFrom(s => s.IsEdited))
            .ForMember(d => d.ThreadCount, o => o.MapFrom(s => s.Replies.Count))
            .ForMember(d => d.Reactions, o => o.MapFrom(s =>
                JsonSerializer.Deserialize<List<ReactionDto>>(s.ReactionsJson ?? "[]",
                    (JsonSerializerOptions?)null) ?? new List<ReactionDto>()));

        // Attachment
        CreateMap<Attachment, AttachmentDto>()
            .ForMember(d => d.Url, o => o.MapFrom(s => $"/uploads/{s.FilePath}"));

        // Notification
        CreateMap<Notification, NotificationDto>()
            .ForMember(d => d.Type, o => o.MapFrom(s => s.Type.ToString().ToLower()))
            .ForMember(d => d.Timestamp, o => o.MapFrom(s => new DateTimeOffset(s.CreatedAt, TimeSpan.Zero).ToUnixTimeMilliseconds()))
            .ForMember(d => d.Read, o => o.MapFrom(s => s.IsRead));
    }
}
