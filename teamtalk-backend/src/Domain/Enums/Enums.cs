namespace TeamTalk.Domain.Enums;

public enum UserRole
{
    Employee = 0,
    Manager = 1,
    Admin = 2,
    Director = 3
}

public enum UserStatus
{
    Online = 0,
    Away = 1,
    DoNotDisturb = 2,
    Offline = 3
}

public enum NotificationType
{
    NewMessage = 0,
    Mention = 1,
    TeamInvitation = 2,
    Reply = 3,
    Reaction = 4,
    System = 5
}

public enum TeamMemberRole
{
    Member = 0,
    Moderator = 1,
    Owner = 2
}
