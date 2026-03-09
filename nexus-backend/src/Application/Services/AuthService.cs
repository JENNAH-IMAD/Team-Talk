using AutoMapper;
using NexusPlatform.Application.DTOs.Auth;
using NexusPlatform.Application.Interfaces;
using NexusPlatform.Domain.Entities;
using NexusPlatform.Domain.Interfaces;

namespace NexusPlatform.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUnitOfWork _uow;
    private readonly ITokenService _tokenService;
    private readonly IMapper _mapper;

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

        var token = _tokenService.GenerateAccessToken(user.Id, user.Email, user.Role.ToString(), user.SecondaryRole?.ToString());
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

        var role = Domain.Enums.UserRole.Employee;
        if (!string.IsNullOrWhiteSpace(request.Role) &&
            Enum.TryParse<Domain.Enums.UserRole>(request.Role, true, out var parsedRole))
            role = parsedRole;

        Domain.Enums.UserRole? secondaryRole = null;
        if (!string.IsNullOrWhiteSpace(request.SecondaryRole) &&
            Enum.TryParse<Domain.Enums.UserRole>(request.SecondaryRole, true, out var parsedSecondary))
            secondaryRole = parsedSecondary;

        var user = new User
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Title = request.Title,
            Role = role,
            SecondaryRole = secondaryRole
        };

        await _uow.Users.AddAsync(user);
        await _uow.SaveChangesAsync();

        var token = _tokenService.GenerateAccessToken(user.Id, user.Email, user.Role.ToString(), user.SecondaryRole?.ToString());
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

        var newToken = _tokenService.GenerateAccessToken(user.Id, user.Email, user.Role.ToString(), user.SecondaryRole?.ToString());
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
}
