# Deployment Steps for Arvan Project on AWS EC2 Ubuntu

## Prerequisites
- [ ] AWS account with EC2 access
- [ ] SSH key pair for EC2 access
- [ ] Domain name (optional, for SSL)

## EC2 Setup
- [ ] Launch Ubuntu 22.04 EC2 instance (t3.medium recommended)
- [ ] Configure security groups (ports 22, 80, 443, 3000, 4000)
- [ ] Connect to instance via SSH

## Software Installation
- [ ] Update system packages
- [ ] Install Node.js 18+ and npm
- [ ] Install pnpm globally
- [ ] Install PostgreSQL server
- [ ] Install Nginx
- [ ] Install PM2 globally
- [ ] Install Git

## Database Setup
- [ ] Configure PostgreSQL
- [ ] Create database and user
- [ ] Set up database connection

## Project Deployment
- [ ] Clone repositories
- [ ] Install backend dependencies
- [ ] Install frontend dependencies
- [ ] Set up environment variables
- [ ] Run database migrations
- [ ] Build backend
- [ ] Build frontend

## Server Configuration
- [ ] Configure PM2 for backend
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL with Let's Encrypt (optional)
- [ ] Configure firewall

## Testing and Monitoring
- [ ] Test backend API endpoints
- [ ] Test frontend application
- [ ] Set up monitoring and logs
- [ ] Configure auto-start on reboot
