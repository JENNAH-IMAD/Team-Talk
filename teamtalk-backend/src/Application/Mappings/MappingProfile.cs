using System.Text.Json;
using AutoMapper;
using TeamTalk.Domain.Entities;
using TeamTalk.Domain.Enums;
using TeamTalk.Application.DTOs.Auth;
using TeamTalk.Application.DTOs.Team;
using TeamTalk.Application.DTOs.Channel;
using TeamTalk.Application.DTOs.Chat;
using TeamTalk.Application.DTOs.Notification;

namespace TeamTalk.Application.Mappings;

public class MappingProfile : Profile
{
    private static readonly UserRole[] RolePriority = { UserRole.Director, UserRole.Admin, UserRole.Manager, UserRole.Employee };

    public MappingProfile()
    {
        // User
        CreateMap<User, UserDto>()
            .ForMember(d => d.Name, o => o.MapFrom(s => s.FullName))
            .ForMember(d => d.Bio, o => o.MapFrom(s => s.Bio))
            .ForMember(d => d.Role, o => o.MapFrom(s => s.Role.ToString().ToLower()))
            .ForMember(d => d.SecondaryRole, o => o.MapFrom(s => s.SecondaryRole.HasValue ? s.SecondaryRole.Value.ToString().ToLower() : null))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString().ToLower()))
            .ForMember(d => d.Roles, o => o.MapFrom(s => GetRoles(s)));

        // Team
        CreateMap<Team, TeamDto>()
            .ForMember(d => d.Members, o => o.MapFrom(s => s.Members.Select(m => m.UserId.ToString())))
            .ForMember(d => d.MemberCount, o => o.MapFrom(s => s.Members.Count));

        // Channel
        CreateMap<Channel, ChannelDto>()
            .ForMember(d => d.PinnedCount, o => o.MapFrom(s => 0))
            .ForMember(d => d.IsVoice, o => o.MapFrom(s => s.IsVoice))
            .ForMember(d => d.IsGroup, o => o.MapFrom(s => s.IsGroup))
            .ForMember(d => d.GroupName, o => o.MapFrom(s => s.GroupName));

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

    private static List<string> GetRoles(User user)
    {
        if (!string.IsNullOrWhiteSpace(user.RolesJson))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<List<string>>(user.RolesJson);
                if (parsed != null && parsed.Count > 0)
                    return NormalizeRoles(parsed).Select(r => r.ToString().ToLower()).ToList();
            }
            catch { }
        }

        var roles = new List<string> { user.Role.ToString() };
        if (user.SecondaryRole.HasValue) roles.Add(user.SecondaryRole.Value.ToString());
        return NormalizeRoles(roles).Select(r => r.ToString().ToLower()).ToList();
    }

    private static List<UserRole> NormalizeRoles(IEnumerable<string> roles)
    {
        var set = new HashSet<UserRole>();
        foreach (var r in roles)
        {
            if (Enum.TryParse<UserRole>(r, true, out var parsed))
                set.Add(parsed);
        }

        if (set.Count == 0)
            set.Add(UserRole.Employee);

        return RolePriority.Where(set.Contains).ToList();
    }
}
