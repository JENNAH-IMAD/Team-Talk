# Nexus Platform — Backend API

.NET 8 backend with Clean Architecture for the Nexus enterprise collaboration platform.

## Tech Stack
- .NET 8 / ASP.NET Core Web API
- Entity Framework Core + PostgreSQL
- SignalR (real-time chat)
- JWT Authentication + BCrypt
- AutoMapper, FluentValidation
- Repository Pattern + Unit of Work
- Swagger API documentation

## Quick Start

### Option 1: Docker (recommended)
```bash
docker-compose up -d
```
Backend runs at `http://localhost:5001`, Swagger at `http://localhost:5001/swagger`

### Option 2: Local Development
1. Install PostgreSQL and create database `nexus_platform`
2. Update connection string in `src/WebAPI/appsettings.json`
3. Run:
```bash
cd src/WebAPI
dotnet ef migrations add InitialCreate --project ../Infrastructure
dotnet ef database update --project ../Infrastructure
dotnet run
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/login | Login | No |
| POST | /api/auth/register | Register | No |
| POST | /api/auth/refresh | Refresh token | No |
| GET | /api/auth/me | Current user | Yes |
| GET | /api/users | All users | Yes |
| GET | /api/teams | User's teams | Yes |
| POST | /api/teams | Create team | Yes |
| GET | /api/teams/{id}/channels | Team channels | Yes |
| GET | /api/channels/{id}/messages | Channel messages | Yes |
| POST | /api/channels/{id}/messages | Send message | Yes |
| GET | /api/notifications | User notifications | Yes |

## SignalR Hub: `/hubs/chat`
- JoinChannel(channelId)
- LeaveChannel(channelId)
- SendMessage(channelId, content)
- SendTyping(channelId, isTyping)

## Demo Credentials
```
Email:    sarah@company.com
Password: password123
Role:     Admin
```

## Architecture
```
src/
├── Domain/          # Entities, Enums, Interfaces
├── Application/     # DTOs, Services, Validators, AutoMapper
├── Infrastructure/  # EF Core, Repositories, JWT, BCrypt
└── WebAPI/          # Controllers, SignalR Hub, Middleware
```
