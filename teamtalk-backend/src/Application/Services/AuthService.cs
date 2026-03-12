using System.Text.Json;
using AutoMapper;
using TeamTalk.Application.DTOs.Auth;
using TeamTalk.Application.Interfaces;
using TeamTalk.Domain.Entities;
using TeamTalk.Domain.Enums;
using TeamTalk.Domain.Interfaces;

namespace TeamTalk.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUnitOfWork _uow;
    private readonly ITokenService _tokenService;
    private readonly IMapper _mapper;
    private static readonly UserRole[] RolePriority = { UserRole.Director, UserRole.Admin, UserRole.Manager, UserRole.Employee };

    public AuthService(IUnitOfWork uow, ITokenService tokenService, IMapper mapper)
    {
        _uow = uow;
        _tokenService = tokenService;
        _mapper = mapper;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _uow.Users.GetByEmailAsync(request.Email)
            ?? throw new UnauthorizedAccessException("Invalid email or password");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid email or password");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Account is deactivated");

        var token = _tokenService.GenerateAccessToken(user.Id, user.Email, GetRolesFromUser(user));
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        user.Status = Domain.Enums.UserStatus.Online;
        user.LastActiveAt = DateTime.UtcNow;
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();

        return new AuthResponse
        {
            User = _mapper.Map<UserDto>(user),
            Token = token,
            RefreshToken = refreshToken,
            ExpiresAt = new DateTimeOffset(DateTime.UtcNow.AddHours(1)).ToUnixTimeMilliseconds()
        };
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var existing = await _uow.Users.GetByEmailAsync(request.Email);
        if (existing != null)
            throw new InvalidOperationException("Email already registered");

        var roles = NormalizeRoles(request.Roles, request.Role, request.SecondaryRole);
        var primaryRole = roles[0];
        var secondaryRole = roles.Count > 1 ? roles[1] : (UserRole?)null;

        var user = new User
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Title = request.Title,
            Role = primaryRole,
            SecondaryRole = secondaryRole,
            RolesJson = JsonSerializer.Serialize(roles.Select(r => r.ToString().ToLower()))
        };

        await _uow.Users.AddAsync(user);
        await _uow.SaveChangesAsync();

        var token = _tokenService.GenerateAccessToken(user.Id, user.Email, GetRolesFromUser(user));
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();

        return new AuthResponse
        {
            User = _mapper.Map<UserDto>(user),
            Token = token,
            RefreshToken = refreshToken,
            ExpiresAt = new DateTimeOffset(DateTime.UtcNow.AddHours(1)).ToUnixTimeMilliseconds()
        };
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken)
    {
        var user = await _uow.Users.GetByRefreshTokenAsync(refreshToken)
            ?? throw new UnauthorizedAccessException("Invalid refresh token");

        if (user.RefreshTokenExpiryTime < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token expired");

        var newToken = _tokenService.GenerateAccessToken(user.Id, user.Email, GetRolesFromUser(user));
        var newRefreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _uow.Users.UpdateAsync(user);
        await _uow.SaveChangesAsync();

        return new AuthResponse
        {
            User = _mapper.Map<UserDto>(user),
            Token = newToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = new DateTimeOffset(DateTime.UtcNow.AddHours(1)).ToUnixTimeMilliseconds()
        };
    }

    public async Task<UserDto> GetCurrentUserAsync(Guid userId)
    {
        var user = await _uow.Users.GetByIdAsync(userId)
            ?? throw new KeyNotFoundException("User not found");
        return _mapper.Map<UserDto>(user);
    }

    public async Task LogoutAsync(Guid userId)
    {
        var user = await _uow.Users.GetByIdAsync(userId);
        if (user != null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            user.Status = Domain.Enums.UserStatus.Offline;
            await _uow.Users.UpdateAsync(user);
            await _uow.SaveChangesAsync();
        }
    }

    private static List<UserRole> NormalizeRoles(IEnumerable<string>? roles, string? role, string? secondaryRole)
    {
        var set = new HashSet<UserRole>();
        if (roles != null)
        {
            foreach (var r in roles)
            {
                if (Enum.TryParse<UserRole>(r, true, out var parsed))
                    set.Add(parsed);
            }
        }

        if (set.Count == 0 && !string.IsNullOrWhiteSpace(role) &&
            Enum.TryParse<UserRole>(role, true, out var parsedRole))
            set.Add(parsedRole);

        if (set.Count == 0 && !string.IsNullOrWhiteSpace(secondaryRole) &&
            Enum.TryParse<UserRole>(secondaryRole, true, out var parsedSecondary))
            set.Add(parsedSecondary);

        if (set.Count == 0)
            set.Add(UserRole.Employee);

        return RolePriority.Where(set.Contains).ToList();
    }

    private static List<string> GetRolesFromUser(User user)
    {
        if (!string.IsNullOrWhiteSpace(user.RolesJson))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<List<string>>(user.RolesJson);
                if (parsed != null && parsed.Count > 0)
                    return NormalizeRoles(parsed, null, null).Select(r => r.ToString()).ToList();
            }
            catch { }
        }

        var roles = new List<string> { user.Role.ToString() };
        if (user.SecondaryRole.HasValue)
            roles.Add(user.SecondaryRole.Value.ToString());

        return NormalizeRoles(roles, null, null).Select(r => r.ToString()).ToList();
    }
}
