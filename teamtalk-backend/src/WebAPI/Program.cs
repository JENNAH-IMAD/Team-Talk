using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.FileProviders;
using TeamTalk.Infrastructure.Persistence;
using TeamTalk.WebAPI.Extensions;
using TeamTalk.WebAPI.Hubs;
using TeamTalk.WebAPI.Middlewares;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddApplicationServices(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddSwaggerDocumentation();
builder.Services.AddCorsPolicy();

var app = builder.Build();

// ── Seed Database ─────────────────────────────────────────
await DbSeeder.SeedAsync(app.Services);

// ── Middleware Pipeline ───────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI();

app.UseMiddleware<ExceptionMiddleware>();

app.UseCors("AllowFrontend");

// Ensure wwwroot exists so static files (uploads) are always served
var wwwrootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
Directory.CreateDirectory(wwwrootPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(wwwrootPath),
    RequestPath = ""
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
