# EduSIS — Step-by-Step Deployment Guide
### (For Non-Technical Users)

> **What you'll end up with**: A fully working, secure Student Information System running on your own server, accessible at your school's web address.
>
> **Time required**: About 1–2 hours, depending on your internet speed.
>
> **What you need**: A computer, internet connection, and the items in the checklist below.

---

## Before You Start — Collect These Items

You'll need to gather the following. Check each box as you get it:

- [ ] **Your server's IP address** (from Hostinger control panel, e.g., `123.456.78.90`)
- [ ] **Your domain name** (e.g., `sis.yourschool.edu`) — must point to your server
- [ ] **An email address** to use for sending notifications (e.g., a Gmail or Google Workspace account)
- [ ] **Google OAuth credentials** (see Section A below — takes about 15 minutes)
- [ ] **SSH client** on your computer:
  - Windows: Download [PuTTY](https://www.putty.org/) OR use Windows Terminal
  - Mac/Linux: Terminal is already installed

---

## Section A — Set Up Google (Takes 15 Minutes)

*Skip this section if you don't need Google Workspace or Classroom integration for now. You can add it later.*

**Step A1**: Go to [console.cloud.google.com](https://console.cloud.google.com)

**Step A2**: Sign in with your school's Google account.

**Step A3**: Click "Select a project" at the top → "New Project"
- Name it: `School SIS`
- Click "Create"

**Step A4**: In the left menu, click **APIs & Services → Library**
- Search for "Google Classroom API" → Click it → Click "Enable"
- Search for "Google OAuth2 API" → Click it → Click "Enable"

**Step A5**: Go to **APIs & Services → OAuth consent screen**
- Choose "Internal" (so only your school's Google accounts can use it)
- App name: `EduSIS`
- Support email: your email
- Click "Save and Continue" through all steps

**Step A6**: Go to **APIs & Services → Credentials**
- Click "+ Create Credentials" → "OAuth client ID"
- Application type: "Web application"
- Name: "EduSIS"
- Under "Authorized redirect URIs" click "+ Add URI"
  - Type: `https://sis.yourschool.edu/api/google/callback`
    (replace `sis.yourschool.edu` with your actual domain)
- Click "Create"
- **COPY** the "Client ID" and "Client secret" — you'll need these later

**Step A7**: Create a Gmail App Password (for sending emails)
- Go to your Gmail account settings → Security
- Make sure 2-Step Verification is ON
- Go to **Security → App passwords**
- Select "Mail" and "Other (Custom name)" → type "EduSIS"
- Click "Generate" → **COPY the 16-character password shown**

---

## Part 1 — Log Into Your Server

**Step 1**: Open your terminal (Mac/Linux) or PuTTY (Windows).

**Step 2**: Type the following command and press Enter:
```
ssh root@123.456.78.90
```
*(Replace `123.456.78.90` with your actual server IP)*

**Step 3**: If asked "Are you sure you want to continue connecting?" — type `yes` and press Enter.

**Step 4**: Enter your server password when prompted.

✅ You should now see a command prompt like `root@hostname:~#`

---

## Part 2 — Install Required Software

Copy and paste each command below **one at a time**, pressing Enter after each. Wait for it to finish before pasting the next.

**Step 5**: Update the server:
```bash
apt update && apt upgrade -y
```
*(This may take 2–5 minutes)*

**Step 6**: Install required tools:
```bash
apt install -y curl git ufw fail2ban
```

**Step 7**: Set up the firewall:
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

**Step 8**: Install Docker (the software that runs EduSIS):
```bash
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
systemctl enable --now docker
```

**Step 9**: Verify Docker installed correctly:
```bash
docker --version
```
You should see something like: `Docker version 26.x.x`

---

## Part 3 — Download EduSIS

**Step 10**: Download the application:
```bash
git clone https://github.com/YOUR_ORG/student-sis.git /opt/student-sis
cd /opt/student-sis
```

*(Ask your IT contact for the exact repository URL)*

---

## Part 4 — Configure Your Settings

**Step 11**: Create the settings file:
```bash
cp .env.example .env
```

**Step 12**: Generate secure passwords (copy ALL of this output — you'll need it):
```bash
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
echo "INVITE_SECRET=$(openssl rand -hex 32)"
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 20 | tr -d '=/')"
echo "REDIS_PASSWORD=$(openssl rand -base64 20 | tr -d '=/')"
```
📋 **Copy this entire output and save it in a safe place** (like a password manager or secure document).

**Step 13**: Open the settings file to edit it:
```bash
nano .env
```

This opens a text editor in the terminal. Use the arrow keys to move around.

**Step 14**: Fill in each setting. Here's what each one means:

| Setting | What to put there |
|---------|------------------|
| `POSTGRES_PASSWORD=` | The `POSTGRES_PASSWORD=...` line from Step 12 (just the value after `=`) |
| `REDIS_PASSWORD=` | The `REDIS_PASSWORD=...` line from Step 12 |
| `JWT_SECRET=` | The `JWT_SECRET=...` value from Step 12 |
| `JWT_REFRESH_SECRET=` | The `JWT_REFRESH_SECRET=...` value from Step 12 |
| `INVITE_SECRET=` | The `INVITE_SECRET=...` value from Step 12 |
| `NEXTAUTH_SECRET=` | The `NEXTAUTH_SECRET=...` value from Step 12 |
| `FRONTEND_URL=` | `https://sis.yourschool.edu` (your actual domain) |
| `BACKEND_URL=` | `https://sis.yourschool.edu` (same domain) |
| `EMAIL_HOST=` | `smtp.gmail.com` |
| `EMAIL_PORT=` | `587` |
| `EMAIL_USER=` | Your Gmail address (e.g., `noreply@yourschool.edu`) |
| `EMAIL_PASS=` | The 16-character App Password from Step A7 (no spaces) |
| `EMAIL_FROM=` | `"EduSIS <noreply@yourschool.edu>"` |
| `GOOGLE_CLIENT_ID=` | The Client ID from Step A6 |
| `GOOGLE_CLIENT_SECRET=` | The Client secret from Step A6 |
| `GOOGLE_REDIRECT_URI=` | `https://sis.yourschool.edu/api/google/callback` |
| `NEXT_PUBLIC_API_URL=` | `https://sis.yourschool.edu` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` | The Client ID from Step A6 (same as above) |
| `NEXTAUTH_URL=` | `https://sis.yourschool.edu` |

**Step 15**: Save the file:
- Press **Ctrl + X**
- Press **Y** (yes, save)
- Press **Enter**

---

## Part 5 — Set Up Your Domain Name (SSL/HTTPS)

**Step 16**: Replace `YOUR_DOMAIN.com` with your actual domain in the nginx config:
```bash
sed -i 's/YOUR_DOMAIN.com/sis.yourschool.edu/g' /opt/student-sis/nginx/nginx.prod.conf
```
*(Replace `sis.yourschool.edu` with your real domain)*

**Step 17**: Get a free SSL certificate (the padlock 🔒 in the browser):

First, install certbot:
```bash
apt install -y certbot
```

Then get your certificate:
```bash
certbot certonly --standalone \
  -d sis.yourschool.edu \
  --agree-tos \
  --email admin@yourschool.edu \
  --non-interactive
```
*(Replace both addresses with your real domain and email)*

You should see: `Successfully received certificate.`

---

## Part 6 — Start EduSIS!

**Step 18**: Build and start all the application containers:
```bash
cd /opt/student-sis
docker compose -f docker-compose.prod.yml up --build -d
```
⏳ *This will take 5–10 minutes the first time. You'll see lots of text scrolling by — this is normal.*

**Step 19**: Wait 1 minute for everything to fully start, then check status:
```bash
docker compose -f docker-compose.prod.yml ps
```
Every service should show **"Up"** or **"healthy"**.

**Step 20**: Set up the database:
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

**Step 21**: Create your first admin account:
```bash
docker compose -f docker-compose.prod.yml exec backend node prisma/seed.js
```

You'll see: `Seed complete. Admin login: admin@demo-school.edu / Admin@123456`

---

## Part 7 — First Login and Setup

**Step 22**: Open your web browser and go to:
```
https://sis.yourschool.edu
```

**Step 23**: Log in with:
- Email: `admin@demo-school.edu`
- Password: `Admin@123456`

**Step 24**: **IMMEDIATELY** change the admin password:
- Click your name/avatar in the top right
- Go to Account Settings
- Change the password to something strong and unique

**Step 25**: Set up your school:
- Go to **School Settings** in the left menu
- Update the school name, address, and branding
- Invite your first teachers (click "+ Send Invite" on the dashboard)

---

## Part 8 — Invite Users

**Step 26**: As the School Admin, you invite all users — nobody can self-register.

To invite a teacher:
1. Click "+ Send Invite" on the dashboard
2. Enter their email address
3. Select role: **Teacher**
4. Click "Send Invite"
5. They receive an email with a link to create their account

To invite a parent:
1. First add the student (Students → Add Student)
2. Click "+ Send Invite"
3. Enter parent's email
4. Select role: **Parent**
5. The parent can then see their child's information

---

## Part 9 — Set Up Auto-Renewal for SSL

SSL certificates expire every 90 days. Set up automatic renewal:

**Step 27**: Type:
```bash
crontab -e
```

**Step 28**: If asked to choose an editor, type `1` and press Enter.

**Step 29**: At the bottom of the file, add this line:
```
0 3 * * * certbot renew --quiet && docker compose -f /opt/student-sis/docker-compose.prod.yml restart nginx
```

**Step 30**: Save and exit (Ctrl+X, Y, Enter).

✅ **Congratulations! EduSIS is now fully deployed and running!**

---

## Daily Operations — Quick Reference

### How to see if everything is running
```bash
cd /opt/student-sis
docker compose -f docker-compose.prod.yml ps
```
All services should show "Up" or "healthy".

### How to restart everything
```bash
cd /opt/student-sis
docker compose -f docker-compose.prod.yml restart
```

### How to see error messages
```bash
cd /opt/student-sis
docker compose -f docker-compose.prod.yml logs -f
```
Press Ctrl+C to stop viewing logs.

### How to update EduSIS to a new version
```bash
cd /opt/student-sis
git pull
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### How to backup the database (do this regularly!)
```bash
cd /opt/student-sis
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U sisuser sisdb > backup_$(date +%Y%m%d).sql
```
A file named like `backup_20240615.sql` will appear. Download it to your computer regularly.

---

## Troubleshooting Common Issues

### "502 Bad Gateway" in browser
The application is still starting. Wait 2 minutes and try again.
If it persists: `docker compose -f docker-compose.prod.yml logs backend`

### "Site can't be reached" in browser
- Check your domain's DNS settings point to your server IP
- DNS changes can take up to 24 hours to spread globally

### Users aren't receiving invitation emails
- Verify your Gmail App Password is correct (no spaces between characters)
- Check spam folder
- View email logs: `docker compose -f docker-compose.prod.yml logs backend | grep -i email`

### SSL certificate issues
```bash
certbot renew --dry-run
```
If this fails, contact Certbot support or check that port 80 is open in your firewall.

### Forgot admin password
```bash
cd /opt/student-sis
docker compose -f docker-compose.prod.yml exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
bcrypt.hash('NewPassword@123', 12).then(h => 
  p.user.update({ where: { email: 'admin@demo-school.edu' }, data: { passwordHash: h } })
).then(() => { console.log('Password reset!'); p.\$disconnect(); });
"
```
*(Replace `admin@demo-school.edu` and `NewPassword@123` with your values)*

---

## Who to Contact

| Issue | Contact |
|-------|---------|
| Server problems | Hostinger Support: hpanel.hostinger.com |
| Google OAuth | Google Workspace Admin |
| Application bugs | Your IT administrator or developer |
| Email delivery | Your email provider |

---

## Security Reminders

- 🔐 **Never share your `.env` file** — it contains all your passwords
- 📦 **Take database backups weekly** at minimum
- 🔑 **Change the default admin password** immediately after setup
- 📧 **Invite-only registration** — don't share invite links publicly
- 🔄 **Check for updates** monthly by running the update commands above

---

*EduSIS — Secure, open-source Student Information System*
