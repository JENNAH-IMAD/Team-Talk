# TeamTalk Platform

TeamTalk est une plateforme de communication d'entreprise full-stack conçue pour centraliser les échanges en équipe — messagerie instantanée, appels audio/vidéo, partage de fichiers et gestion des équipes, le tout en temps réel.

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Redux Toolkit, Framer Motion |
| **Backend** | .NET 9 (Clean Architecture), ASP.NET Core, SignalR, JWT Bearer |
| **Base de données** | PostgreSQL 16 via Npgsql + Entity Framework Core 9 |
| **Temps réel** | SignalR (chat, voix, présence, notifications) |
| **Média** | WebRTC (voix/vidéo/partage d'écran), Giphy API (GIFs/Stickers/Clips) |
| **Conteneurisation** | Docker, Docker Compose, Nginx |

---

## Fonctionnalités

- **Authentification** — Inscription/connexion JWT, rôles hiérarchiques
- **Équipes & Canaux** — Création, gestion membres, canaux texte et vocaux
- **Chat temps réel** — Messages, réactions emoji, édition/suppression, réponses, mentions `@user`
- **Pièces jointes** — Upload fichiers (images, vidéos, PDF, ZIP, Office), preview intégré
- **GIF Picker** — Giphy API : GIFs, Stickers, Clips, favoris
- **Messages directs** — DMs 1-to-1 et groupes, appels audio/vidéo
- **Voix/Vidéo** — Canaux vocaux multi-participants WebRTC, partage d'écran, mute/sourd
- **Notifications** — Centre de notifications temps réel
- **Dashboard Admin** — Gestion utilisateurs, équipes, rôles
- **Thème** — Dark / Light mode

### Rôles utilisateurs

| Rôle | Permissions |
|------|-------------|
| **Director** | Accès complet — gère toutes les équipes |
| **Admin** | Gestion des utilisateurs + équipes dont il est owner |
| **Manager** | Crée et gère ses propres équipes |
| **Employee** | Membre standard |

---

## Docker Hub

Les images sont publiées sur Docker Hub :

| Image | Lien |
|-------|------|
| Backend (.NET 9) | `bluekayn11/teamtalk-backend:latest` |
| Frontend (Nginx) | `bluekayn11/teamtalk-frontend:latest` |

---

## Démarrage avec Docker (recommandé)

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Lancer le projet complet

```bash
docker compose up -d
```

C'est tout. Docker télécharge les images depuis Docker Hub et démarre les 3 containers.

| Container | Port | Description |
|-----------|------|-------------|
| `teamtalk-postgres` | 5432 | Base de données PostgreSQL |
| `teamtalk-backend` | 5001 | API REST + SignalR Hub |
| `teamtalk-frontend` | 3000 | Application React (Nginx) |

- Application : http://localhost:3000
- API / Swagger : http://localhost:5001/swagger

### Arrêter les containers

```bash
docker compose down
```

### Supprimer aussi les volumes (base de données)

```bash
docker compose down -v
```

---

## Démarrage en mode développement (local)

### Prérequis

- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 1 — Base de données

```bash
cd teamtalk-backend
docker compose up postgres -d
```

### 2 — Backend

```bash
cd teamtalk-backend
dotnet run --project src/WebAPI
```

- API REST : http://localhost:5001
- Swagger : http://localhost:5001/swagger
- SignalR Hub : ws://localhost:5001/hubs/chat

### 3 — Frontend

```bash
cd teamtalk-frontend
cp .env.example .env
npm install
npm run dev
```

- Application : http://localhost:3000

### Variables d'environnement (frontend)

```env
VITE_API_URL=http://localhost:5001/api
VITE_SIGNALR_URL=http://localhost:5001/hubs/chat
VITE_GIPHY_API_KEY=your_giphy_api_key_here
```

> Clé Giphy gratuite sur [developers.giphy.com](https://developers.giphy.com) — choisir **API**.

---

## Structure du projet

```
TeamTalk-platform/
├── docker-compose.yml              Orchestration complète (postgres + backend + frontend)
│
├── teamtalk-frontend/              React + TypeScript + Vite
│   ├── Dockerfile                  Build Vite → Nginx
│   ├── nginx.conf                  Reverse proxy vers le backend
│   ├── .env.example                Template des variables d'environnement
│   └── src/
│       ├── features/               auth, chat, teams, messages, notifications, users
│       ├── components/             MessageBubble, GifPicker, VideoLayout, FilePreviewCard…
│       ├── store/slices/           auth, chat, teams, notifications, activeVoice
│       ├── services/               signalRService, apiClient
│       ├── hooks/                  Hooks personnalisés
│       ├── layouts/                DashboardLayout, AuthLayout
│       ├── types/                  Types TypeScript globaux
│       └── utils/                  Helpers
│
└── teamtalk-backend/               .NET 9 Clean Architecture
    ├── Dockerfile                  Build multi-stage .NET 9
    └── src/
        ├── Domain/                 Entités, enums, interfaces
        ├── Application/            DTOs, services, FluentValidation, AutoMapper
        ├── Infrastructure/         EF Core, repositories, JWT, migrations
        └── WebAPI/                 Controllers REST, ChatHub SignalR, middlewares
```

---

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| salma@company.com | password123 | Admin |
| fatima@company.com | password123 | Manager |
| yassine@company.com | password123 | Employee |

---

## Notes

- Les fichiers `bin/`, `obj/`, `dist/`, `node_modules/` sont exclus du dépôt
- Les uploads utilisateurs (`wwwroot/uploads/`) sont persistés dans un volume Docker
- Ne jamais committer le fichier `.env`
