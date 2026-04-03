# EduSIS — K-12 Student Information System

A fully containerized, secure, and feature-rich Student Information System designed for K-12 schools. Built with modern web technologies and hosted on your own server.

## Features

### Security & Authentication
- **Email-based authentication** with JWT access/refresh token rotation
- **Invite-only registration** — no open sign-up; administrators send invite links via email
- **Role-Based Access Control** (RBAC): School Admin, Teacher, Parent
- Password reset via secure email tokens
- Automatic token refresh, blacklisting on logout
- Rate limiting on all auth endpoints
- Helmet.js security headers + CORS protection

### School Admin Dashboard
- Live enrollment, attendance, and user statistics
- Student record management (demographics, IEP/ELL/Gifted flags, health records, documents)
- Teacher and parent account management
- Invite management (send, track, revoke invites)
- Academic year and term configuration
- Announcement broadcasting (target by role)
- At-risk student identification (attendance-based)
- School branding and settings customization

### Teacher Dashboard
- My Classes overview with attendance status indicator
- One-click attendance submission with parent auto-notification on absence
- Gradebook with assignment management (homework, quiz, test, project, etc.)
- Standards-based, traditional, and percentage grading support
- 7-day attendance trend per class
- At-risk student alerts
- Google Classroom roster sync

### Parent Dashboard
- View all linked children in one portal
- Real-time grade viewing with assignment details
- Attendance alerts and history
- School announcements
- Two-way messaging with teachers
- Emergency contact management
- Report card access

### Google Workspace Integration
- OAuth2 single sign-on
- Google Classroom course sync
- Student roster import from Google Classroom
- Domain restriction (only school Google accounts)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Cache/Sessions | Redis 7 |
| Auth | JWT (RS256), bcrypt, email verification |
| Email | Nodemailer (SMTP) |
| Container | Docker + Docker Compose |
| Reverse Proxy | Nginx with SSL termination |
| Google | googleapis SDK |

## Quick Start (Development)

```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/student-sis.git
cd student-sis

# 2. Configure
cp .env.example .env
# Edit .env with your settings

# 3. Start
docker compose up --build

# 4. Database setup (in another terminal)
docker compose exec backend npx prisma migrate dev
docker compose exec backend node prisma/seed.js

# 5. Open browser
open http://localhost:3000
# Login: admin@demo-school.edu / Admin@123456
```

## Production Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full technical deployment guide.

For non-technical users: [`docs/DEPLOY_GUIDE_SIMPLE.md`](docs/DEPLOY_GUIDE_SIMPLE.md) — step-by-step with screenshots and explanations.

## Project Structure

```
student-sis/
├── backend/                  # Express.js API
│   ├── prisma/
│   │   ├── schema.prisma     # Full database schema
│   │   └── seed.js           # Initial data seeder
│   └── src/
│       ├── config/           # DB + Redis clients
│       ├── middleware/        # Auth + RBAC middleware
│       ├── routes/           # API route handlers
│       ├── services/         # Email + Google services
│       └── utils/            # JWT + logging + invite tokens
├── frontend/                 # Next.js 14 application
│   └── src/
│       ├── app/
│       │   ├── auth/         # Login, invite registration
│       │   └── dashboard/    # Admin, Teacher, Parent views
│       ├── components/       # Shared UI components
│       └── lib/              # API client + auth helpers
├── nginx/                    # Reverse proxy config (dev + prod)
├── docs/
│   ├── DEPLOYMENT.md         # Technical deployment guide
│   └── DEPLOY_GUIDE_SIMPLE.md # Non-technical guide
├── docker-compose.yml        # Development compose
├── docker-compose.prod.yml   # Production compose
├── .env.example              # Environment template
└── Makefile                  # Common commands
```

## Available Make Commands

```bash
make dev            # Start in development mode
make prod           # Start in production mode
make stop           # Stop containers
make logs           # Tail all logs
make migrate        # Run database migrations
make seed           # Seed initial data
make backup-db      # Backup the database
make generate-secrets  # Generate all required secrets
make clean          # Remove containers and volumes
```

## License

MIT License — free to use for educational institutions.
