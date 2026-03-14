# TeamTalk Platform

TeamTalk est une plateforme de communication d'entreprise full-stack conçue pour centraliser les échanges en équipe — messagerie instantanée, appels audio/vidéo, partage de fichiers et gestion des équipes, le tout en temps réel.

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Redux Toolkit, Framer Motion |
| **Backend** | .NET 9 (Clean Architecture), ASP.NET Core, SignalR, JWT Bearer |
| **Base de données** | PostgreSQL 15 via Npgsql + Entity Framework Core 9 |
| **Temps réel** | SignalR (chat, voix, présence, notifications) |
| **Média** | WebRTC (voix/vidéo/partage d'écran), Giphy API (GIFs/Stickers/Clips) |

---

## Fonctionnalités

- **Authentification** — Inscription/connexion JWT, refresh token, rôles hiérarchiques
- **Équipes & Canaux** — Création, gestion des membres, canaux texte et vocaux, privés/publics
- **Chat temps réel** — Messages, réactions emoji, édition/suppression, réponses, mentions `@user`
- **Pièces jointes** — Upload fichiers (images, vidéos, PDF, ZIP, Office), preview intégré
- **GIF Picker** — Giphy API : GIFs, Stickers, Clips, favoris localStorage
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

## Structure du projet

```
TeamTalk-platform/
├── teamtalk-frontend/          React + TypeScript + Vite
│   ├── src/
│   │   ├── features/           Domaines : auth, chat, teams, messages, notifications, users
│   │   ├── components/         Composants partagés (MessageBubble, GifPicker, VideoLayout…)
│   │   ├── store/slices/       Redux : auth, chat, teams, notifications, activeVoice
│   │   ├── services/           signalRService, apiClient
│   │   ├── hooks/              Hooks personnalisés
│   │   ├── layouts/            DashboardLayout, AuthLayout
│   │   ├── types/              Types TypeScript globaux
│   │   └── utils/              Helpers, gestion des rôles
│   ├── .env.example
│   └── package.json
│
└── teamtalk-backend/           .NET 9 Clean Architecture
    ├── src/
    │   ├── Domain/             Entités, enums, interfaces
    │   ├── Application/        DTOs, services, validateurs FluentValidation, AutoMapper
    │   ├── Infrastructure/     EF Core, repositories, JWT, migrations
    │   └── WebAPI/             Controllers REST, ChatHub SignalR, middlewares
    ├── docker-compose.yml      PostgreSQL + API
    └── Dockerfile
```

---

## Démarrage rapide

### Prérequis

- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 1 — Backend

```bash
cd teamtalk-backend
docker-compose up -d
```

- API REST : http://localhost:5001
- Swagger : http://localhost:5001/swagger
- SignalR Hub : ws://localhost:5001/hubs/chat

### 2 — Frontend

```bash
cd teamtalk-frontend
cp .env.example .env      # puis renseigner les clés
npm install
npm run dev
```

- Application : http://localhost:3000

### 3 — Variables d'environnement (frontend)

Créer `teamtalk-frontend/.env` à partir de `.env.example` :

```env
VITE_API_URL=http://localhost:5001/api
VITE_SIGNALR_URL=http://localhost:5001/hubs/chat
VITE_GIPHY_API_KEY=your_giphy_api_key_here
```

> Obtenir une clé Giphy gratuite sur [developers.giphy.com](https://developers.giphy.com) — choisir **API** (pas SDK).

---

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| salma@company.com | password123 | Admin |
| fatima@company.com | password123 | Manager |
| yassine@company.com | password123 | Employee |

---

## Configuration backend

La base de données et JWT sont configurés dans `teamtalk-backend/docker-compose.yml`.
Les migrations EF Core s'appliquent automatiquement au démarrage (`DbSeeder`).

---

## Notes de développement

- Les fichiers `bin/`, `obj/`, `dist/`, `node_modules/` sont exclus du dépôt via `.gitignore`
- Les uploads utilisateurs sont dans `teamtalk-backend/src/WebAPI/wwwroot/uploads/` (exclu du dépôt)
- Ne jamais committer le fichier `.env` (contient les clés API)
