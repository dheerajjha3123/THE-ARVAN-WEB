# AWS EC2 Deployment Guide for Arvan Fullstack Application

This guide provides a comprehensive step-by-step process to deploy the Arvan ecommerce application on AWS EC2 with Ubuntu 22.04, PostgreSQL, and proper production configuration.

## Prerequisites

- AWS Account with EC2 access
- Domain name (optional but recommended for SSL)
- SSH key pair for EC2 access
- Basic knowledge of Linux commands

## Table of Contents

1. [AWS EC2 Instance Setup](#1-aws-ec2-instance-setup)
2. [Initial Server Configuration](#2-initial-server-configuration)
3. [PostgreSQL Database Setup](#3-postgresql-database-setup)
4. [Node.js and pnpm Installation](#4-nodejs-and-pnpm-installation)
5. [Application Deployment](#5-application-deployment)
6. [Environment Configuration](#6-environment-configuration)
7. [Nginx Reverse Proxy Setup](#7-nginx-reverse-proxy-setup)
8. [SSL Certificate Configuration](#8-ssl-certificate-configuration)
9. [PM2 Process Management](#9-pm2-process-management)
10. [Database Migration](#10-database-migration)
11. [Security Hardening](#11-security-hardening)
12. [Monitoring and Maintenance](#12-monitoring-and-maintenance)

---

## 1. AWS EC2 Instance Setup

### Launch EC2 Instance

1. **Log in to AWS Console** and navigate to EC2 Dashboard
2. **Click "Launch Instance"**
3. **Choose AMI**: Ubuntu Server 22.04 LTS (HVM)
4. **Instance Type**: t3.medium or t3.large (2-4 vCPUs, 4-8 GB RAM recommended)
5. **Key Pair**: Create or select an existing key pair
6. **Security Group**: Create a new security group with these rules:
   - SSH (22) - Source: Your IP/My IP
   - HTTP (80) - Source: 0.0.0.0/0
   - HTTPS (443) - Source: 0.0.0.0/0
   - Custom TCP (5000) - Source: 0.0.0.0/0 (for backend, optional if using Nginx)
7. **Storage**: 20-50 GB gp3 SSD
8. **Launch Instance**

### Connect to Your Instance

```bash
ssh -i your-key.pem ubuntu@your-instance-public-ip
```

---

## 2. Initial Server Configuration

### Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Essential Tools

```bash
sudo apt install -y curl wget git htop unzip software-properties-common ufw
```

### Configure Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

### Create Application User

```bash
sudo adduser arvan
sudo usermod -aG sudo arvan
su - arvan
```

### Configure SSH for Application User

```bash
mkdir ~/.ssh
cp /home/ubuntu/.ssh/authorized_keys ~/.ssh/
chmod 600 ~/.ssh/authorized_keys
```

---

## 3. PostgreSQL Database Setup

### Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

### Start and Enable PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Configure PostgreSQL

```bash
sudo -u postgres psql
```

In PostgreSQL shell:

```sql
-- Create database and user
CREATE DATABASE arvan_db;
CREATE USER arvan_user WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE arvan_db TO arvan_user;

-- Connect to database and set up permissions
\c arvan_db;
GRANT ALL ON SCHEMA public TO arvan_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO arvan_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO arvan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO arvan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO arvan_user;

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Exit PostgreSQL
\q
```

### Configure PostgreSQL for Remote Access (Optional)

```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Add this line before the last line:
```
host    arvan_db        arvan_user      0.0.0.0/0          md5
```

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Uncomment and set:
```
listen_addresses = '*'
```

```bash
sudo systemctl restart postgresql
```

---

## 4. Node.js and pnpm Installation

### Install Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install pnpm

```bash
npm install -g pnpm
```

### Verify Installations

```bash
node --version
pnpm --version
```

---

## 5. Application Deployment

### Clone Repository

```bash
cd ~
git clone https://github.com/your-username/your-repo.git arvan
cd arvan
```

### Install Backend Dependencies

```bash
cd arvan-backend-main
pnpm install
```

### Install Frontend Dependencies

```bash
cd ../arvan-main
pnpm install
cd ..
```

---

## 6. Environment Configuration

### Backend Environment Variables

```bash
cd arvan-backend-main
nano .env
```

Add the following content (replace with your actual values):

```env
# Environment
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL="postgresql://arvan_user:YourSecurePassword123!@localhost:5432/arvan_db"

# Frontend URL
FRONTENDURL="https://yourdomain.com"

# JWT Secret (generate a secure random string)
JWT_SECRET="your-super-secure-jwt-secret-here-123456789"

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# WhatsApp Integration
WHATSAPP_API_TOKEN="your-whatsapp-token"
WHATSAPP_MOBILE="your-mobile-number"
WHATSAPP_MOBILE_ID="your-mobile-id"
WHATSAPP_BUISSNESS_ID="your-business-id"

# Email Service (Resend)
RESEND_API_KEY="your-resend-api-key"
RESEND_EMAIL="noreply@yourdomain.com"
RESEND_EMAIL_RECEIVER_ADMIN="admin@yourdomain.com"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Frontend Environment Variables

```bash
cd ../arvan-main
nano .env.local
```

Add the following content:

```env
# Backend URL
NEXT_PUBLIC_BACKEND_URL="https://yourdomain.com/api"

# Frontend URL
NEXT_PUBLIC_FRONTEND_URL="https://yourdomain.com"
NEXTAUTH_URL="https://yourdomain.com"

# NextAuth Secret
NEXTAUTH_SECRET="your-nextauth-secret-here-987654321"

# Optional: Admin Numbers
ADMIN_NUMBERS="+1234567890,+0987654321"

# Optional: Razorpay
RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_SECRET="your-razorpay-secret"

# Optional: Google Tag Manager
NEXT_PUBLIC_GTM_ID="GTM-XXXXXXX"
```

---

## 7. Nginx Reverse Proxy Setup

### Install Nginx

```bash
sudo apt install -y nginx
```

### Configure Nginx for Backend

```bash
sudo nano /etc/nginx/sites-available/arvan-backend
```

Add the following configuration:

```nginx
server {
    listen 5000;
    server_name your-server-ip;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:5000/api/health;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### Configure Nginx for Frontend

```bash
sudo nano /etc/nginx/sites-available/arvan-frontend
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Cache static assets
        location /_next/static {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook endpoint (no auth required)
    location /api/webhook {
        proxy_pass http://localhost:5000/api/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable Sites

```bash
sudo ln -s /etc/nginx/sites-available/arvan-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/arvan-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. SSL Certificate Configuration

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Configure Auto-Renewal

```bash
sudo crontab -e
```

Add this line:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 9. PM2 Process Management

### Install PM2

```bash
sudo npm install -g pm2
```

### Configure PM2 for Backend

```bash
cd ~/arvan/arvan-backend-main
pm2 start ecosystem.config.js
```

### Configure PM2 for Frontend

```bash
cd ~/arvan/arvan-main
pm2 start ecosystem.config.js
```

### Save PM2 Configuration

```bash
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u arvan --hp /home/arvan
```

### PM2 Useful Commands

```bash
pm2 list                    # List all processes
pm2 logs                    # View logs
pm2 restart arvan-backend   # Restart backend
pm2 restart arvan-frontend  # Restart frontend
pm2 monit                   # Monitor processes
```

---

## 10. Database Migration

### Run Prisma Migrations

```bash
cd ~/arvan/arvan-backend-main
npx prisma generate
npx prisma migrate deploy
```

### Seed Database (if needed)

```bash
npx prisma db seed
```

---

## 11. Security Hardening

### Configure Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Disable Root SSH Login

```bash
sudo nano /etc/ssh/sshd_config
```

Set:
```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo systemctl restart ssh
```

### Install and Configure UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

### Set Up Log Rotation

```bash
sudo nano /etc/logrotate.d/arvan
```

Add:
```
/home/arvan/arvan/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 arvan arvan
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 12. Monitoring and Maintenance

### Install Monitoring Tools

```bash
sudo apt install -y htop iotop ncdu
```

### Set Up Automated Backups

Create backup script:

```bash
sudo nano /usr/local/bin/backup-arvan.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/arvan/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="arvan_db"
DB_USER="arvan_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U $DB_USER -h localhost $DB_NAME > $BACKUP_DIR/${DB_NAME}_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/${DB_NAME}_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/${DB_NAME}_$DATE.sql.gz"
```

Make executable and set up cron:

```bash
sudo chmod +x /usr/local/bin/backup-arvan.sh
sudo crontab -e
```

Add:
```
0 2 * * * /usr/local/bin/backup-arvan.sh
```

### Health Check Monitoring

Test your endpoints:

```bash
curl -f https://yourdomain.com/api/health
curl -f https://yourdomain.com/ready
```

### Log Monitoring

```bash
# View PM2 logs
pm2 logs

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View application logs
tail -f ~/arvan/arvan-backend-main/logs/combined.log
```

---

## Troubleshooting

### Common Issues

1. **Port 80/443 already in use**
   ```bash
   sudo netstat -tulpn | grep :80
   sudo netstat -tulpn | grep :443
   ```

2. **Database connection issues**
   ```bash
   sudo -u postgres psql -c "SELECT version();"
   ```

3. **PM2 process not starting**
   ```bash
   pm2 logs --lines 50
   ```

4. **SSL certificate issues**
   ```bash
   sudo certbot certificates
   ```

### Performance Tuning

1. **Increase file limits**
   ```bash
   sudo nano /etc/security/limits.conf
   ```
   Add:
   ```
   arvan soft nofile 65536
   arvan hard nofile 65536
   ```

2. **Optimize PostgreSQL**
   ```bash
   sudo nano /etc/postgresql/14/main/postgresql.conf
   ```
   Adjust settings based on your instance size.

---

## Final Steps

1. **Test your application**
   - Visit `https://yourdomain.com`
   - Test all major functionality
   - Verify API endpoints work

2. **Set up monitoring alerts**
   - Configure AWS CloudWatch (optional)
   - Set up email notifications for critical errors

3. **Configure domain DNS**
   - Point your domain A record to EC2 instance IP
   - Set up www redirect if needed

4. **Regular maintenance**
   - Keep system updated: `sudo apt update && sudo apt upgrade`
   - Monitor disk space: `df -h`
   - Check logs regularly

Your Arvan application is now deployed and production-ready on AWS EC2! 🎉
