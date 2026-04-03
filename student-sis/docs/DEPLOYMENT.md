# EduSIS — Technical Deployment Guide

## Architecture Overview

```
Internet
   │
   ▼
[Hostinger VPS]
   │
[Nginx] ─────────────────────────────────────────────────
   │  /api/*           /
   ▼                   ▼
[Backend]         [Frontend]
Node.js/Express   Next.js 14
Port 4000         Port 3000
   │
   ├──► [PostgreSQL 16]  Port 5432
   └──► [Redis 7]        Port 6379
```

All services run in Docker containers managed by Docker Compose.

---

## Server Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Storage | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Docker | 24+ | latest |

**Hostinger VPS plan**: KVM 2 or higher recommended.

---

## Pre-Deployment Checklist

- [ ] VPS provisioned (Ubuntu 22.04 LTS)
- [ ] Domain name configured with DNS A record pointing to VPS IP
- [ ] SSH access with key-based auth configured
- [ ] Google Cloud project created with OAuth credentials
- [ ] SMTP email credentials ready (Gmail App Password or SendGrid)
- [ ] Firewall rules: ports 22, 80, 443 open

---

## Step 1 — Server Initial Setup

```bash
# SSH into your VPS
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install essentials
apt install -y curl git ufw fail2ban

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# Start fail2ban (brute-force protection)
systemctl enable --now fail2ban
```

---

## Step 2 — Install Docker

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Add non-root user (optional but recommended)
adduser sisadmin
usermod -aG docker,sudo sisadmin

# Enable Docker service
systemctl enable --now docker

# Verify installation
docker --version
docker compose version
```

---

## Step 3 — Clone and Configure

```bash
# Switch to app user
su - sisadmin   # or remain as root

# Clone the repository
git clone https://github.com/YOUR_ORG/student-sis.git /opt/student-sis
cd /opt/student-sis

# Copy env template
cp .env.example .env

# Generate secrets (copy the output into .env)
make generate-secrets
# OR manually:
# openssl rand -hex 64    (for JWT secrets)
# openssl rand -base64 24 (for passwords)
```

### Edit .env

```bash
nano .env
```

Fill in ALL required values:

```env
# Database
POSTGRES_DB=sisdb
POSTGRES_USER=sisuser
POSTGRES_PASSWORD=<strong-random-password>

# Redis
REDIS_PASSWORD=<strong-random-password>

# JWT (generate with openssl rand -hex 64)
JWT_SECRET=<64-char-hex>
JWT_REFRESH_SECRET=<different-64-char-hex>

# Invite
INVITE_SECRET=<32-char-hex>

# NextAuth
NEXTAUTH_SECRET=<32-char-hex>

# URLs (replace with your actual domain)
FRONTEND_URL=https://sis.yourschool.edu
BACKEND_URL=https://sis.yourschool.edu

# Email (example: Gmail App Password)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@yourschool.edu
EMAIL_PASS=abcd efgh ijkl mnop   # 16-char Gmail App Password (no spaces)
EMAIL_FROM="EduSIS <noreply@yourschool.edu>"

# Google OAuth
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxx
GOOGLE_REDIRECT_URI=https://sis.yourschool.edu/api/google/callback

# Frontend
NEXT_PUBLIC_API_URL=https://sis.yourschool.edu
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
NEXTAUTH_URL=https://sis.yourschool.edu
```

---

## Step 4 — SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot

# Obtain certificate (standalone, before starting nginx)
certbot certonly --standalone \
  -d sis.yourschool.edu \
  -d www.sis.yourschool.edu \
  --agree-tos \
  --email admin@yourschool.edu \
  --non-interactive

# Verify certificate files
ls /etc/letsencrypt/live/sis.yourschool.edu/

# Auto-renewal (add to crontab)
crontab -e
# Add this line:
0 3 * * * certbot renew --quiet && docker compose -f /opt/student-sis/docker-compose.prod.yml restart nginx
```

---

## Step 5 — Configure Domain in Nginx

Edit the production nginx config:

```bash
# Replace YOUR_DOMAIN.com with your actual domain
sed -i 's/YOUR_DOMAIN.com/sis.yourschool.edu/g' /opt/student-sis/nginx/nginx.prod.conf
```

---

## Step 6 — First Launch

```bash
cd /opt/student-sis

# Pull and build images
docker compose -f docker-compose.prod.yml build

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Watch logs for errors
docker compose -f docker-compose.prod.yml logs -f

# Run database migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed initial admin account
docker compose -f docker-compose.prod.yml exec backend node prisma/seed.js
```

After seeding, the admin account is:
- **Email**: `admin@demo-school.edu`
- **Password**: `Admin@123456`

**IMPORTANT**: Change this password immediately after first login!

---

## Step 7 — Verify Deployment

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Check health endpoints
curl https://sis.yourschool.edu/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Check nginx is proxying correctly
curl -I https://sis.yourschool.edu
```

---

## Google Workspace Setup

### 1. Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: **"Your School SIS"**
3. Enable APIs:
   - **Google Classroom API**
   - **Google Admin SDK API**
   - **Google OAuth2 API**

### 2. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: "EduSIS"
5. Authorized redirect URIs:
   - `https://sis.yourschool.edu/api/google/callback`
   - `http://localhost:4000/api/google/callback` (for dev)
6. Save **Client ID** and **Client Secret** → paste into `.env`

### 3. Configure OAuth Consent Screen

1. Go to **OAuth consent screen**
2. User type: **Internal** (for Google Workspace domains only)
3. App name: "EduSIS"
4. Support email: your admin email
5. Add authorized domain: `yourschool.edu`
6. Scopes: `openid`, `email`, `profile`, `classroom.courses.readonly`

### 4. Restrict to School Domain (optional)

In School Settings (admin panel), add your Google Workspace domains:
- e.g., `yourschool.edu`

Users will only be able to connect Google accounts from these domains.

---

## Email Configuration

### Gmail / Google Workspace (Recommended)

1. Sign in to the email account you want to use for sending
2. Enable 2-Factor Authentication
3. Go to **Account Settings → Security → App Passwords**
4. Generate a password for "Mail" on "Other device"
5. Use this 16-character password in `EMAIL_PASS` (remove spaces)

### SendGrid (High Volume)

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.xxxxxxxxxxxx
```

---

## Database Management

```bash
# Backup database
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U sisuser sisdb > backup_$(date +%Y%m%d).sql

# Restore database
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U sisuser sisdb < backup_20240101.sql

# Open Prisma Studio (database GUI)
docker compose -f docker-compose.prod.yml exec backend npx prisma studio
# Access at: http://localhost:5555 (via SSH tunnel)

# SSH tunnel for Prisma Studio:
# From local machine: ssh -L 5555:localhost:5555 sisadmin@YOUR_SERVER_IP
```

---

## Updating the Application

```bash
cd /opt/student-sis

# Pull latest code
git pull origin main

# Rebuild and restart services
docker compose -f docker-compose.prod.yml up --build -d

# Run any new migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

---

## Monitoring & Logs

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx

# Container resource usage
docker stats

# Nginx access logs
docker compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/access.log
docker compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/error.log
```

---

## Security Hardening

### SSH Key-Only Auth
```bash
# Disable password auth
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### Automatic Security Updates
```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### Swap Space (for 2GB RAM servers)
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Container won't start | `docker compose logs <service>` to check errors |
| 502 Bad Gateway | Backend container isn't healthy — check `docker compose ps` |
| Email not sending | Verify SMTP credentials, check firewall allows port 587 |
| SSL errors | Verify certificate paths in `nginx.prod.conf` |
| DB connection refused | Wait for postgres healthcheck to pass |
| Google OAuth fails | Check redirect URI matches exactly in Google Console |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL password |
| `REDIS_PASSWORD` | ✅ | Redis password |
| `JWT_SECRET` | ✅ | Access token signing key (64+ chars) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token signing key (different from above) |
| `INVITE_SECRET` | ✅ | Invite token HMAC key |
| `NEXTAUTH_SECRET` | ✅ | NextAuth session secret |
| `FRONTEND_URL` | ✅ | Full URL of frontend |
| `BACKEND_URL` | ✅ | Full URL of backend |
| `EMAIL_HOST` | ✅ | SMTP server hostname |
| `EMAIL_USER` | ✅ | SMTP username |
| `EMAIL_PASS` | ✅ | SMTP password |
| `GOOGLE_CLIENT_ID` | ⚠️ | Required for Google integration |
| `GOOGLE_CLIENT_SECRET` | ⚠️ | Required for Google integration |
| `GOOGLE_REDIRECT_URI` | ⚠️ | Must match Google Console exactly |
