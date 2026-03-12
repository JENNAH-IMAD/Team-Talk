# Team Talk - Enterprise Collaboration Platform Frontend

A modern, production-grade React frontend for an enterprise collaboration platform (similar to Slack/Teams), built with TypeScript, Vite, Tailwind CSS, Redux Toolkit, and SignalR.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** (fast build & HMR)
- **Tailwind CSS** (utility-first styling, dark mode)
- **Redux Toolkit** (state management)
- **React Router v6** (routing with lazy loading)
- **Axios** (HTTP client with interceptors)
- **React Hook Form** + **Zod** (form validation)
- **SignalR** (real-time messaging)
- **Recharts** (admin dashboard charts)
- **Lucide React** (icons)
- **React Hot Toast** (notifications)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app runs on `http://localhost:3000` by default.

## Project Architecture

```
src/
├── app/                  # Global config (app settings)
├── assets/styles/        # Global CSS & Tailwind
├── components/
│   ├── ui/               # Reusable UI: Avatar, Button, Input, Modal, Badge, Dropdown, Loader
│   └── shared/           # Shared components: MessageBubble, SidebarItem
├── features/
│   ├── auth/             # Login form, auth pages
│   ├── users/            # Home page, Admin dashboard
│   ├── teams/            # Team management CRUD
│   ├── channels/         # Channel components (extensible)
│   ├── chat/             # Chat view, message input, members panel
│   └── notifications/    # Activity page, notification components
├── hooks/                # useAuth, useSignalR, useDebounce, useTheme, useClickOutside
├── layouts/              # AuthLayout, DashboardLayout (sidebar + navbar)
├── routes/               # Router config with lazy loading + ProtectedRoute
├── services/             # API services: auth, chat, team, notification, signalR
├── store/
│   └── slices/           # Redux slices: auth, chat, teams, notifications
├── types/                # TypeScript interfaces for all entities
└── utils/                # Helpers: cn, formatTime, getInitials, storage, debounce
```

## Features

### Authentication
- Login page with email/password validation (Zod + React Hook Form)
- JWT token stored in localStorage with Axios interceptors
- Automatic token refresh with retry queue
- Protected routes with role-based access

### Chat
- Real-time messaging via SignalR
- Message bubbles with @mention highlighting
- Edit / Delete messages (own messages only)
- Reactions, thread replies indicator
- Typing indicator
- Members panel (right side)
- Channel welcome header

### Teams & Channels
- Create, edit, delete teams
- Add/remove members
- Channel list grouped by team in sidebar
- Private channel support (lock icon)
- Search/filter channels

### Notifications
- Notification dropdown with unread badge
- Mark as read / Mark all as read
- Real-time notifications via SignalR
- Toast notifications (react-hot-toast)

### Admin Dashboard (admin role only)
- Stats cards (users, teams, messages, active)
- Weekly activity bar chart
- User role pie chart
- Monthly trends area chart
- User management table

### UI/UX
- Dark / Light mode toggle (persisted in localStorage)
- Fully responsive layout
- Smooth animations (Tailwind keyframes)
- Custom scrollbars
- Accessible focus states

## Connecting to Your .NET Backend

1. Update `.env` with your API URL:
   ```
   VITE_API_URL=https://localhost:7001/api
   ```

2. The Vite proxy in `vite.config.ts` forwards `/api` and `/hubs` to your backend.

3. Replace mock data in Redux slices with real API calls — each slice has `// TODO` comments marking where to swap.

4. SignalR hub URL is configured in `services/signalRService.ts`.

## Demo Credentials

```
Email:    sarah@company.com
Password: password123
```

## Security Best Practices

- JWT stored in localStorage (consider httpOnly cookies for production)
- Axios interceptors for automatic token attachment
- Refresh token rotation with sliding window
- Protected routes block unauthenticated access
- Admin UI hidden for non-admin users
- Input sanitization via Zod validation
