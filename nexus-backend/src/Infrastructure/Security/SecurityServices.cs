using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using NexusPlatform.Application.Interfaces;

namespace NexusPlatform.Infrastructure.Security;

public class TokenService : ITokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) { _config = config; }

    public string GenerateAccessToken(Guid userId, string email, string role, string? secondaryRole = null)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured")));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (!string.IsNullOrEmpty(secondaryRole))
            claims.Add(new Claim(ClaimTypes.Role, secondaryRole));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }
}

public class FileService : IFileService
{
    private readonly string _uploadsPath;
    private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx", ".txt", ".zip" };
    private const long MaxFileSize = 10 * 1024 * 1024; // 10MB

    public FileService()
    {
        _uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        Directory.CreateDirectory(_uploadsPath);
    }

    public async Task<(string filePath, string contentType, long size)> UploadFileAsync(Stream fileStream, string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLower();
        if (!_allowedExtensions.Contains(ext))
            throw new InvalidOperationException($"File type {ext} not allowed");

        if (fileStream.Length > MaxFileSize)
            throw new InvalidOperationException("File too large (max 10MB)");

        var uniqueName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(_uploadsPath, uniqueName);

        using var stream = new FileStream(filePath, FileMode.Create);
        await fileStream.CopyToAsync(stream);

        return (uniqueName, GetContentType(ext), fileStream.Length);
    }

    public void DeleteFile(string filePath)
    {
        var fullPath = Path.Combine(_uploadsPath, filePath);
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }

    public string[] GetAllowedExtensions() => _allowedExtensions;
    public long GetMaxFileSize() => MaxFileSize;

    private static string GetContentType(string ext) => ext switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".gif" => "image/gif",
        ".pdf" => "application/pdf",
        _ => "application/octet-stream"
    };
}
