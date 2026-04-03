# EduSIS — K-12 Student Information System

A fully containerized, secure, and feature-rich Student Information System designed for K-12 schools. Built with modern web technologies and hosted on your own server.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Hostinger VPS Deployment — Ubuntu 24.04](#hostinger-vps-deployment--ubuntu-2404)
   - [Phase 0 — Prerequisites & Preparation](#phase-0--prerequisites--preparation)
   - [Phase 1 — Server Access & Initial Hardening](#phase-1--server-access--initial-hardening)
   - [Phase 2 — Install All Dependencies](#phase-2--install-all-dependencies)
   - [Phase 3 — Clone & Configure](#phase-3--clone--configure)
   - [Phase 4 — Google Workspace Setup](#phase-4--google-workspace-setup)
   - [Phase 5 — Email (SMTP) Setup](#phase-5--email-smtp-setup)
   - [Phase 6 — SSL Certificate](#phase-6--ssl-certificate)
   - [Phase 7 — Build & Launch](#phase-7--build--launch)
   - [Phase 8 — First Login & School Setup](#phase-8--first-login--school-setup)
   - [Phase 9 — Maintenance & Operations](#phase-9--maintenance--operations)
5. [Local Development Quick Start](#local-development-quick-start)
6. [Make Commands Reference](#make-commands-reference)
7. [Troubleshooting](#troubleshooting)
8. [License](#license)

---

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

---

## Hostinger VPS Deployment — Ubuntu 24.04

> **Target**: Hostinger KVM VPS running Ubuntu 24.04 LTS  
> **Estimated time**: 45–90 minutes (first-time setup)  
> **Minimum spec**: 2 vCPU, 2 GB RAM, 40 GB SSD (KVM 2 or higher recommended)

---

### Phase 0 — Prerequisites & Preparation

Collect the following **before** you start. You will need them during configuration.

| Item | Where to get it | Example |
|------|----------------|---------|
| Server IP address | Hostinger hPanel → VPS → Overview | `89.116.21.45` |
| Root password / SSH key | Hostinger hPanel → VPS → SSH Access | — |
| Domain name | Your domain registrar or Hostinger | `sis.yourschool.edu` |
| DNS A record set to VPS IP | Domain registrar DNS settings | A record → `89.116.21.45` |
| Gmail / Google Workspace email | Use an existing school Gmail | `noreply@yourschool.edu` |
| Gmail App Password | Google Account → Security → App Passwords | `abcd efgh ijkl mnop` |
| Google OAuth Client ID & Secret | Google Cloud Console (see Phase 4) | `xxxx.apps.googleusercontent.com` |

> **DNS note**: Point your domain's A record to your VPS IP address **before** starting. DNS changes can take up to 24 hours, but usually propagate within 15–30 minutes on Hostinger.

---

### Phase 1 — Server Access & Initial Hardening

#### 1.1 — Connect via SSH

**Windows**: Open PowerShell or Windows Terminal.  
**Mac / Linux**: Open Terminal.

```bash
ssh root@YOUR_SERVER_IP
# Example:
ssh root@89.116.21.45
```

When prompted "Are you sure you want to continue connecting?" — type `yes` and press Enter.

---

#### 1.2 — Update the System

```bash
# Refresh package list and upgrade all packages
apt update && apt upgrade -y
```

> This may take 3–10 minutes. Wait until you see the command prompt again.

---

#### 1.3 — Set the Server Hostname

```bash
hostnamectl set-hostname sis-server
echo "127.0.1.1 sis-server" >> /etc/hosts
```

---

#### 1.4 — Configure the Firewall (UFW)

```bash
# Install UFW
apt install -y ufw

# Default: block all incoming, allow all outgoing
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (CRITICAL — do this before enabling UFW)
ufw allow 22/tcp

# Allow web traffic
ufw allow 80/tcp
ufw allow 443/tcp

# Enable the firewall
ufw --force enable

# Verify rules
ufw status
```

Expected output:
```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

---

#### 1.5 — Install Fail2Ban (Brute-Force Protection)

```bash
apt install -y fail2ban

# Enable and start
systemctl enable fail2ban
systemctl start fail2ban

# Verify it's running
systemctl status fail2ban
```

---

#### 1.6 — Add Swap Space (Essential for 2 GB RAM Servers)

```bash
# Create a 2 GB swap file
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Make it permanent across reboots
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Reduce swap aggressiveness (recommended)
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -p

# Verify swap is active
free -h
```

---

### Phase 2 — Install All Dependencies

#### 2.1 — Install Essential Tools

```bash
apt install -y \
  curl \
  git \
  wget \
  nano \
  unzip \
  ca-certificates \
  gnupg \
  lsb-release \
  apt-transport-https \
  software-properties-common \
  openssl \
  make
```

---

#### 2.2 — Install Docker Engine

Ubuntu 24.04 requires installing Docker from the official Docker repository.

```bash
# Step 1: Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Step 2: Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Step 3: Update package index
apt update

# Step 4: Install Docker Engine and Docker Compose plugin
apt install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

# Step 5: Enable Docker to start on boot
systemctl enable docker
systemctl start docker

# Step 6: Verify installation
docker --version
docker compose version
```

Expected output (versions may differ):
```
Docker version 27.x.x, build xxxxxxx
Docker Compose version v2.x.x
```

---

#### 2.3 — Install Certbot (for SSL Certificates)

```bash
# Install Certbot via snap (recommended for Ubuntu 24.04)
apt install -y snapd
snap install --classic certbot

# Create symlink so certbot is available system-wide
ln -sf /snap/bin/certbot /usr/bin/certbot

# Verify installation
certbot --version
```

---

#### 2.4 — (Optional) Create a Dedicated App User

Running as root is fine for setup, but a dedicated user is safer for production.

```bash
# Create user
adduser --disabled-password --gecos "" sisadmin

# Give Docker access (no sudo needed for docker commands)
usermod -aG docker sisadmin

# Switch to the new user (optional — you can continue as root)
# su - sisadmin
```

---

#### 2.5 — Verify All Dependencies

Run this checklist to confirm everything is installed:

```bash
echo "=== Dependency Check ==="
docker --version           && echo "✅ Docker OK"         || echo "❌ Docker MISSING"
docker compose version     && echo "✅ Docker Compose OK" || echo "❌ Docker Compose MISSING"
git --version              && echo "✅ Git OK"            || echo "❌ Git MISSING"
openssl version            && echo "✅ OpenSSL OK"        || echo "❌ OpenSSL MISSING"
certbot --version          && echo "✅ Certbot OK"        || echo "❌ Certbot MISSING"
make --version             && echo "✅ Make OK"           || echo "❌ Make MISSING"
echo "========================"
```

All items should show ✅ before proceeding.

---

### Phase 3 — Clone & Configure

#### 3.1 — Clone the Repository

```bash
# Create application directory
mkdir -p /opt/student-sis

# Clone the project
git clone https://github.com/YOUR_ORG/student-sis.git /opt/student-sis

# Enter the directory
cd /opt/student-sis

# Verify files are present
ls -la
```

You should see: `backend/`, `frontend/`, `nginx/`, `docker-compose.yml`, `docker-compose.prod.yml`, `Makefile`, `.env.example`

---

#### 3.2 — Generate Secrets

```bash
cd /opt/student-sis

# Generate all required secrets and display them
echo "========== COPY ALL OF THIS =========="
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/')"
echo "REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/')"
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
echo "INVITE_SECRET=$(openssl rand -hex 32)"
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)"
echo "======================================="
```

> **IMPORTANT**: Copy this entire output and save it in a password manager or secure document. You will paste these values into the `.env` file next.

---

#### 3.3 — Create the Environment File

```bash
# Copy the template
cp .env.example .env

# Open the editor
nano .env
```

The nano editor will open. Use arrow keys to navigate to each line and fill in the values. Here is the complete reference:

```env
# ── DATABASE ──────────────────────────────────────────────────────────────────
POSTGRES_DB=sisdb
POSTGRES_USER=sisuser
POSTGRES_PASSWORD=<paste POSTGRES_PASSWORD from Step 3.2>

# ── REDIS ─────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=<paste REDIS_PASSWORD from Step 3.2>

# ── JWT SECRETS ───────────────────────────────────────────────────────────────
JWT_SECRET=<paste JWT_SECRET from Step 3.2>
JWT_REFRESH_SECRET=<paste JWT_REFRESH_SECRET from Step 3.2>

# ── INVITE & SESSION ──────────────────────────────────────────────────────────
INVITE_SECRET=<paste INVITE_SECRET from Step 3.2>
NEXTAUTH_SECRET=<paste NEXTAUTH_SECRET from Step 3.2>

# ── URLS (replace sis.yourschool.edu with your actual domain) ─────────────────
FRONTEND_URL=https://sis.yourschool.edu
BACKEND_URL=https://sis.yourschool.edu
NEXT_PUBLIC_API_URL=https://sis.yourschool.edu
NEXTAUTH_URL=https://sis.yourschool.edu

# ── EMAIL (Gmail example — see Phase 5 for other providers) ───────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@yourschool.edu
EMAIL_PASS=abcdefghijklmnop        # 16-char App Password, NO spaces
EMAIL_FROM="EduSIS <noreply@yourschool.edu>"

# ── GOOGLE OAUTH (see Phase 4) ────────────────────────────────────────────────
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://sis.yourschool.edu/api/google/callback
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
```

**Save and exit nano**: Press `Ctrl+X`, then `Y`, then `Enter`.

---

#### 3.4 — Configure Nginx for Your Domain

```bash
# Replace the placeholder domain with your actual domain
# (Run this exactly — replace sis.yourschool.edu with your real domain)
sed -i 's/YOUR_DOMAIN.com/sis.yourschool.edu/g' /opt/student-sis/nginx/nginx.prod.conf

# Verify the change was applied
grep "server_name" /opt/student-sis/nginx/nginx.prod.conf
```

Expected output:
```
server_name sis.yourschool.edu www.sis.yourschool.edu;
```

---

### Phase 4 — Google Workspace Setup

> Skip this phase if you do not need Google Workspace or Google Classroom integration. Leave the `GOOGLE_*` values in `.env` as placeholder text — the app will still work without them.

#### 4.1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your school's Google Workspace admin account
3. Click the project dropdown at the top → **"New Project"**
4. Project name: `School EduSIS` → Click **Create**
5. Wait for it to create, then select the new project

#### 4.2 — Enable Required APIs

1. In the left menu go to **APIs & Services → Library**
2. Search and enable each of these:
   - **Google Classroom API** → Enable
   - **Google Admin SDK API** → Enable

#### 4.3 — Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. User Type: **Internal** (Google Workspace only) → Click Create
3. Fill in:
   - App name: `EduSIS`
   - User support email: your admin email
   - Developer contact: your admin email
4. Click **Save and Continue** through all remaining steps

#### 4.4 — Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `EduSIS Production`
5. Under **Authorized redirect URIs** click **+ Add URI**:
   ```
   https://sis.yourschool.edu/api/google/callback
   ```
6. Click **Create**
7. A dialog shows your credentials — **copy both values**:
   - **Client ID** → paste as `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env`
   - **Client secret** → paste as `GOOGLE_CLIENT_SECRET` in `.env`

#### 4.5 — Update `.env` with Google Credentials

```bash
nano /opt/student-sis/.env
# Update the GOOGLE_* lines with your credentials
# Save: Ctrl+X → Y → Enter
```

---

### Phase 5 — Email (SMTP) Setup

Choose **one** of the options below and update the email section in `.env`.

#### Option A — Gmail / Google Workspace (Recommended)

1. Sign in to the Gmail account that will send emails (e.g., `noreply@yourschool.edu`)
2. Go to **Google Account → Security**
3. Make sure **2-Step Verification** is turned ON
4. Search for **"App Passwords"** in Google Account settings
5. Click **App Passwords** → Select app: **Mail** → Select device: **Other** → type `EduSIS`
6. Click **Generate** — copy the 16-character password shown
7. In `.env`:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=noreply@yourschool.edu
   EMAIL_PASS=abcdefghijklmnop   # paste 16-char password, NO spaces
   ```

#### Option B — SendGrid (High-Volume Schools)

1. Sign up at [sendgrid.com](https://sendgrid.com) → free tier: 100 emails/day
2. Go to **Settings → API Keys → Create API Key** (Full Access)
3. Copy the API key
4. In `.env`:
   ```env
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_USER=apikey
   EMAIL_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

#### Option C — SMTP2GO (Reliable Delivery)

1. Sign up at [smtp2go.com](https://www.smtp2go.com)
2. Add and verify your school domain
3. Go to **Sending → SMTP Users → Add SMTP User**
4. In `.env`:
   ```env
   EMAIL_HOST=mail.smtp2go.com
   EMAIL_PORT=587
   EMAIL_USER=your-smtp2go-username
   EMAIL_PASS=your-smtp2go-password
   ```

---

### Phase 6 — SSL Certificate

SSL encrypts all traffic between users and your server (the padlock 🔒 in the browser). This is required for secure login.

#### 6.1 — Verify DNS is Pointing to Your Server

```bash
# Replace sis.yourschool.edu with your domain
# Expected output: your server's IP address
dig +short sis.yourschool.edu
```

> If the IP shown does not match your VPS IP, wait for DNS to propagate (up to 24 hours) before continuing.

#### 6.2 — Obtain the Certificate

```bash
certbot certonly --standalone \
  --domain sis.yourschool.edu \
  --domain www.sis.yourschool.edu \
  --email admin@yourschool.edu \
  --agree-tos \
  --non-interactive
```

Successful output looks like:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/sis.yourschool.edu/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/sis.yourschool.edu/privkey.pem
This certificate expires on 2024-09-14.
```

#### 6.3 — Set Up Auto-Renewal

Certificates expire every 90 days. Automate renewal:

```bash
# Test that renewal would work (does NOT actually renew)
certbot renew --dry-run

# Add auto-renewal cron job
crontab -e
```

When the editor opens, add this line at the bottom:

```
0 3 * * * certbot renew --quiet && docker compose -f /opt/student-sis/docker-compose.prod.yml restart nginx >> /var/log/certbot-renew.log 2>&1
```

Save and exit (`Ctrl+X` → `Y` → `Enter`).

---

### Phase 7 — Build & Launch

#### 7.1 — Build Docker Images

```bash
cd /opt/student-sis

# Build all images (takes 5–15 minutes on first run)
docker compose -f docker-compose.prod.yml build
```

You will see lots of output as Docker downloads base images and installs dependencies. This is normal.

---

#### 7.2 — Start All Services

```bash
# Start all containers in the background
docker compose -f docker-compose.prod.yml up -d
```

---

#### 7.3 — Verify All Containers Are Running

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output (all should show `Up` or `healthy`):

```
NAME           IMAGE              STATUS                    PORTS
sis_postgres   postgres:16-alpine Up (healthy)              5432/tcp
sis_redis      redis:7-alpine     Up (healthy)              6379/tcp
sis_backend    student-sis-back.. Up                        4000/tcp
sis_frontend   student-sis-front. Up                        3000/tcp
sis_nginx      student-sis-nginx  Up                        0.0.0.0:80->80, 0.0.0.0:443->443
```

> If any container shows `Exit` or `Restarting`, see [Troubleshooting](#troubleshooting).

---

#### 7.4 — Run Database Migrations

```bash
# Apply the database schema (creates all tables)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

Expected output:
```
Prisma Migrate: Applied 1 migration(s).
```

---

#### 7.5 — Seed Initial Data

```bash
# Create the default admin account and school
docker compose -f docker-compose.prod.yml exec backend node prisma/seed.js
```

Expected output:
```
Seeding database...
Seed complete. Admin login: admin@demo-school.edu / Admin@123456
School ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

#### 7.6 — Test the Application

```bash
# Test the health endpoint
curl https://sis.yourschool.edu/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-06-15T10:30:00.000Z"}
```

Then open a browser and go to `https://sis.yourschool.edu` — you should see the EduSIS login page with a padlock (🔒) in the address bar.

---

#### 7.7 — Enable Auto-Start on Server Reboot

```bash
# Create a systemd service so EduSIS starts automatically after a reboot
cat > /etc/systemd/system/edusis.service << 'EOF'
[Unit]
Description=EduSIS Student Information System
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/student-sis
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl daemon-reload
systemctl enable edusis.service

# Verify it's enabled
systemctl is-enabled edusis.service
# Expected: enabled
```

---

### Phase 8 — First Login & School Setup

#### 8.1 — Log In

1. Open your browser and go to `https://sis.yourschool.edu`
2. Log in with the default admin credentials:
   - **Email**: `admin@demo-school.edu`
   - **Password**: `Admin@123456`

#### 8.2 — Change the Default Password Immediately

1. Click your avatar/name in the top right corner
2. Go to **Account Settings**
3. Change the password to a strong, unique password
4. Save

#### 8.3 — Configure Your School

1. Click **School Settings** in the left sidebar
2. Update:
   - School name, address, phone
   - Grade levels offered (K–12)
   - Academic year and terms
   - Email notification preferences
   - School branding (logo, color)
3. Save settings

#### 8.4 — Set Up Google Workspace (Optional)

If you completed Phase 4:

1. In School Settings → **Google Integration**
2. Add your school's Google Workspace domain(s) (e.g., `yourschool.edu`)
3. Teachers and admins can then click **"Connect Google Account"** in their profile

#### 8.5 — Invite Your First Users

All users are invited by the admin — there is no public registration.

**To invite a teacher:**
1. From the admin dashboard, click **"+ Send Invite"**
2. Enter the teacher's school email address
3. Select Role: **Teacher**
4. Click Send — they receive an email with a registration link (valid 7 days)

**To add a student, then invite their parent:**
1. Go to **Students → Add Student** and fill in the student's details
2. Click **"+ Send Invite"**
3. Enter the parent's email → Role: **Parent**
4. The parent registers and is automatically linked to their child

---

### Phase 9 — Maintenance & Operations

#### 9.1 — Common Commands

```bash
# Check status of all containers
docker compose -f docker-compose.prod.yml ps

# View live logs (all services)
docker compose -f docker-compose.prod.yml logs -f

# View logs for a specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart one service
docker compose -f docker-compose.prod.yml restart backend

# Stop everything
docker compose -f docker-compose.prod.yml down

# Start everything
docker compose -f docker-compose.prod.yml up -d
```

---

#### 9.2 — Database Backups (Run Weekly at Minimum)

```bash
# Create a backup
cd /opt/student-sis
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U sisuser sisdb > /opt/backups/sis_backup_$(date +%Y%m%d_%H%M%S).sql

# Create backup directory if it doesn't exist
mkdir -p /opt/backups
```

**Automate weekly backups:**

```bash
# Add to crontab
crontab -e
```

Add this line:
```
0 2 * * 0  mkdir -p /opt/backups && docker compose -f /opt/student-sis/docker-compose.prod.yml exec -T postgres pg_dump -U sisuser sisdb > /opt/backups/sis_$(date +\%Y\%m\%d).sql && find /opt/backups -name "*.sql" -mtime +30 -delete
```

This runs every Sunday at 2 AM and keeps backups for 30 days.

**Download a backup to your local computer:**
```bash
# From your local machine:
scp root@YOUR_SERVER_IP:/opt/backups/sis_backup_20240615_020000.sql ./
```

---

#### 9.3 — Updating EduSIS

```bash
cd /opt/student-sis

# 1. Pull latest code
git pull origin main

# 2. Rebuild images
docker compose -f docker-compose.prod.yml build

# 3. Restart with new images (zero downtime for DB/Redis)
docker compose -f docker-compose.prod.yml up -d

# 4. Apply any new database migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 5. Verify everything is running
docker compose -f docker-compose.prod.yml ps
```

---

#### 9.4 — Monitor Server Resources

```bash
# Live container resource usage (CPU, RAM, network)
docker stats

# Server disk usage
df -h

# Server memory usage
free -h

# Running processes
htop   # Install with: apt install -y htop
```

---

## Local Development Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/student-sis.git
cd student-sis

# 2. Configure
cp .env.example .env
# Edit .env — for local dev, FRONTEND_URL=http://localhost:3000

# 3. Start development stack
docker compose up --build

# 4. In a second terminal, run migrations and seed
docker compose exec backend npx prisma migrate dev
docker compose exec backend node prisma/seed.js

# 5. Open browser
open http://localhost:3000
# Login: admin@demo-school.edu / Admin@123456
```

---

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

## Make Commands Reference

```bash
make dev               # Start development stack (with hot reload)
make dev-bg            # Start development stack in background
make prod              # Start production stack in background
make stop              # Stop development containers
make prod-stop         # Stop production containers
make logs              # Tail all logs (development)
make prod-logs         # Tail all logs (production)
make migrate           # Apply DB migrations (production)
make migrate-dev       # Create and apply DB migrations (development)
make seed              # Seed initial admin account and school
make studio            # Open Prisma database browser (port 5555)
make backup-db         # Dump database to .sql file
make restore-db FILE=x # Restore database from .sql file
make generate-secrets  # Generate all required environment secrets
make clean             # Remove all containers and volumes (destructive!)
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Container exits immediately | Bad `.env` value | `docker compose logs <service>` to read the error |
| `502 Bad Gateway` in browser | Backend not ready yet | Wait 60 seconds, try again. Check `docker compose ps` |
| `SSL_ERROR_RX_RECORD_TOO_LONG` | Nginx using HTTP on port 443 | Verify cert paths in `nginx.prod.conf` |
| Login page loads but login fails | Wrong `FRONTEND_URL` / `BACKEND_URL` | Must match exactly — `https://` not `http://` |
| Invite emails not arriving | Wrong SMTP credentials | Check `EMAIL_PASS` has no spaces; check spam folder |
| Google OAuth fails | Redirect URI mismatch | URI in Google Console must match `GOOGLE_REDIRECT_URI` exactly |
| `ECONNREFUSED` in backend logs | PostgreSQL not healthy | Run `docker compose ps` — wait for `(healthy)` status |
| `P1001` Prisma error | Database URL wrong | Verify `POSTGRES_PASSWORD` matches in `.env` |
| Disk full | Log accumulation | `docker system prune -f` removes unused images/containers |
| Server unreachable after reboot | Docker not auto-started | `systemctl enable docker && systemctl enable edusis` |

**Read service-specific logs:**
```bash
# Backend errors
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# Database errors
docker compose -f docker-compose.prod.yml logs --tail=50 postgres

# Nginx / SSL errors
docker compose -f docker-compose.prod.yml logs --tail=50 nginx
```

**Reset everything and start fresh** (⚠️ deletes all data):
```bash
cd /opt/student-sis
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend node prisma/seed.js
```

---

## License

MIT License — free to use for educational institutions.
