# Deployment Guide for Arvan Fullstack Application

This guide covers deploying the Arvan ecommerce application (frontend and backend) to **Vercel** or **Render**.

## Prerequisites

- **Vercel account** (sign up at [vercel.com](https://vercel.com)) OR **Render account** (sign up at [render.com](https://render.com))
- Git repository with your project
- Database (PostgreSQL recommended - can use Vercel Postgres, Supabase, Render Postgres, or any PostgreSQL provider)
- Environment variables configured

## Project Structure

- `arvan-main/` - Next.js frontend application
- `arvan-backend-main/` - Node.js/Express backend API

## Backend Deployment (arvan-backend-main)

### 1. Configure Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your Git repository
4. Configure project settings:
   - **Root Directory**: `arvan-backend-main`
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `dist`

### 2. Environment Variables

Set these environment variables in your Vercel project settings:

#### Required:
- `DATABASE_URL` - Your database connection string
- `JWT_SECRET` - Secret key for JWT authentication
- `FRONTENDURL` - Frontend URL (set after frontend deployment)

#### Optional (for additional features):
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - For image uploads
- `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` - For shipping integration
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc. - For Google OAuth/merchant features
- `VERIFY_TOKEN` - For WhatsApp integration
- `RESEND_API_KEY` - For email services

### 3. Deploy Backend

1. Click "Deploy"
2. Wait for deployment to complete
3. Note the backend URL (e.g., `https://arvan-backend.vercel.app`)

## Frontend Deployment (arvan-main)

### 1. Configure Vercel Project

1. Create another new project in Vercel
2. Import the same Git repository
3. Configure project settings:
   - **Root Directory**: `arvan-main`
   - **Framework Preset**: Next.js (should auto-detect)

### 2. Environment Variables

Set these environment variables in your Vercel project settings:

#### Required:
- `NEXT_PUBLIC_BACKEND_URL` - Backend URL from step above
- `NEXT_PUBLIC_FRONTEND_URL` - Frontend URL (can be set after deployment)
- `NEXTAUTH_SECRET` - Secret for NextAuth
- `NEXTAUTH_URL` - Frontend URL (can be set after deployment)

#### Optional:
- `ADMIN_NUMBERS` - Comma-separated admin phone numbers
- `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET` - For payment processing
- `NEXT_PUBLIC_GTM_ID` - Google Tag Manager ID

### 3. Deploy Frontend

1. Click "Deploy"
2. Wait for deployment to complete
3. Update the `NEXT_PUBLIC_FRONTEND_URL` and `NEXTAUTH_URL` environment variables with the actual frontend URL

## Post-Deployment Configuration

### 1. Update Environment Variables

After both deployments are complete:

1. **Backend**: Update `FRONTENDURL` with the frontend URL
2. **Frontend**: Update `NEXT_PUBLIC_FRONTEND_URL` and `NEXTAUTH_URL` with the frontend URL

### 2. Database Setup

1. Run Prisma migrations on your database:
   ```bash
   npx prisma migrate deploy
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

### 3. CORS Configuration

Ensure your backend allows requests from the frontend URL by verifying the `FRONTENDURL` environment variable is set correctly.

## Troubleshooting

### Common Issues:

1. **Build Failures**: Check that all required environment variables are set
2. **Database Connection**: Ensure `DATABASE_URL` is correct and accessible
3. **CORS Errors**: Verify `FRONTENDURL` matches your frontend domain
4. **Authentication Issues**: Check `NEXTAUTH_SECRET` and `JWT_SECRET` are set

### Vercel Logs:

- Check deployment logs in Vercel dashboard
- Use `vercel logs` CLI command for detailed logs

### Render Logs:

- Check deployment logs in Render dashboard under your service
- Use the "Logs" tab for real-time logs
- Use the "Events" tab for deployment history

## Environment Variables Reference

### Backend (.env.example):
```
DATABASE_URL="your_database_connection_string"
JWT_SECRET="your_jwt_secret"
FRONTENDURL="https://your-frontend.vercel.app"
# ... other optional variables
```

### Frontend (.env.example):
```
NEXT_PUBLIC_BACKEND_URL="https://your-backend.vercel.app"
NEXT_PUBLIC_FRONTEND_URL="https://your-frontend.vercel.app"
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="https://your-frontend.vercel.app"
# ... other optional variables
```

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique secrets for `JWT_SECRET` and `NEXTAUTH_SECRET`
- Regularly rotate API keys and secrets
- Use environment-specific variables for different deployment environments

## Support

For issues specific to Vercel deployment:
- Vercel Documentation: https://vercel.com/docs
- Vercel Community: https://vercel.com/discord

For issues specific to Render deployment:
- Render Documentation: https://docs.render.com/
- Render Community: https://community.render.com/
