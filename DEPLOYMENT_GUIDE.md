# AWS EC2 + Vercel Deployment Guide for Arvan Project

This guide provides step-by-step instructions to deploy the Arvan backend (Node.js with Prisma ORM) on AWS EC2 Ubuntu and the frontend (Next.js) on Vercel.

## Prerequisites
- AWS account with EC2 access
- Basic knowledge of AWS console, SSH, and Linux commands
- Domain name (optional, for HTTPS)

## Step 1: Launch EC2 Instance
1. Go to AWS EC2 Console > Launch Instance
2. Choose Ubuntu Server 22.04 LTS (HVM), SSD Volume Type
3. Select instance type: t3.micro (free tier) or t3.small for better performance
4. Configure security group:
   - SSH (22) from your IP
   - HTTP (80) and HTTPS (443) from anywhere
   - Custom TCP 3000-3001 (for app ports)
5. Launch and connect via SSH

## Step 2: Update System and Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget gnupg2 software-properties-common
```

## Step 3: Install Node.js and pnpm
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm
```

## Step 4: Install PostgreSQL Client (if using RDS)
```bash
sudo apt install -y postgresql-client
```

## Step 5: Clone Repository
```bash
git clone <your-repo-url> arvan
cd arvan
```

## Step 6: Set Up Environment Variables
Create environment files for backend and frontend:

### Backend (.env)
```bash
cd arvan-backend-main
cp .env .env.production  # Copy from your local .env and modify
nano .env.production
```

Required variables (from render.yaml):
- NODE_ENV=production
- DATABASE_URL=postgresql://user:password@rds-endpoint:5432/dbname
- DIRECT_URL=postgresql://user:password@rds-endpoint:5432/dbname
- AUTH_SECRET=your-secret
- FRONTENDURL=https://your-domain.com
- WHATSAPP_API_TOKEN=...
- WHATSAPP_MOBILE=...
- WHATSAPP_MOBILE_ID=...
- WHATSAPP_BUISSNESS_ID=...
- RESEND_API_KEY=...
- RESEND_EMAIL=...
- CLOUDINARY_CLOUD_NAME=...
- CLOUDINARY_API_KEY=...
- CLOUDINARY_API_SECRET=...

### Frontend (.env.local)
```bash
cd ../arvan-main
cp .env.local .env.local.production
nano .env.local.production
```

Required variables:
- NEXT_PUBLIC_BACKEND_URL=https://your-domain.com/backend
- NEXT_PUBLIC_FRONTEND_URL=https://your-domain.com

## Step 7: Install Dependencies and Build Backend
```bash
cd arvan-backend-main
pnpm install
pnpm run build
```

## Step 8: Run Database Migrations
```bash
# Ensure DATABASE_URL is set
export $(cat .env.production | xargs)
npx prisma migrate deploy
npx prisma generate
```

## Step 9: Install and Configure PM2
```bash
# Run these commands from the backend directory
cd arvan-backend-main
npm install -g pm2
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

## Step 10: Start Backend with PM2
```bash
# Still in the backend directory
pm2 start ecosystem.config.js
pm2 save
```

## Step 11: Install and Configure Nginx for Backend
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/arvan-backend
```

Add this configuration for backend API:
```
server {
    listen 80;
    server_name your-backend-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/arvan-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Frontend Deployment on Vercel

### Step 12: Prepare Frontend for Vercel
1. Go to [Vercel](https://vercel.com) and sign in
2. Click "New Project"
3. Import your repository (select the `arvan-main` folder)
4. Configure build settings:
   - Framework Preset: Next.js
   - Root Directory: `arvan-main`
   - Build Command: `pnpm run build`
   - Output Directory: `.next`

### Step 13: Set Environment Variables in Vercel
In your Vercel project settings, add these environment variables:
- `NEXT_PUBLIC_BACKEND_URL`: `https://your-backend-domain.com`
- `NEXT_PUBLIC_FRONTEND_URL`: `https://your-frontend-domain.vercel.app`

### Step 14: Deploy Frontend
1. Click "Deploy"
2. Vercel will automatically build and deploy your frontend
3. Your frontend will be available at `https://your-project-name.vercel.app`

## Step 13: Set Up SSL with Let's Encrypt (Optional)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Step 14: Configure Auto-Scaling and Monitoring (Optional)
- Set up CloudWatch for monitoring
- Configure auto-scaling group if needed
- Add health checks

## Step 15: Test Deployment
- Access your-frontend-domain.vercel.app (frontend)
- Test API endpoints at your-backend-domain.com/api/...
- Check PM2 status on EC2: `pm2 status`
- Monitor backend logs: `pm2 logs`

## Troubleshooting
- Check PM2 logs: `pm2 logs arvan-backend`
- Verify environment variables
- Ensure database connectivity
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

## Maintenance
- Update code: Pull latest changes, rebuild, restart PM2
- Backup database regularly
- Monitor resource usage
