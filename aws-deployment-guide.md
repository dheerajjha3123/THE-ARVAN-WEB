# AWS Deployment Guide for Arvan E-commerce Project

## Overview
This guide provides step-by-step instructions to deploy the full-stack Arvan e-commerce application on AWS. The application consists of:
- **Frontend**: Next.js application (arvan-main)
- **Backend**: Node.js/Express API with TypeScript (arvan-backend-main)
- **Database**: PostgreSQL with Prisma ORM

## Prerequisites
- AWS Account with appropriate permissions
- Domain name (optional but recommended)
- AWS CLI installed and configured
- Git repository access

## Architecture Overview
- **Database**: Amazon RDS PostgreSQL
- **Backend**: AWS Elastic Beanstalk (Node.js)
- **Frontend**: AWS Amplify or S3 + CloudFront
- **File Storage**: AWS S3 (for static assets)
- **CDN**: Amazon CloudFront

---

## Step 1: Database Setup (Amazon RDS)

### 1.1 Create RDS PostgreSQL Instance
1. Go to AWS Console → RDS → Create database
2. Choose PostgreSQL
3. Settings:
   - DB instance identifier: `arvan-db`
   - Master username: `arvan_admin`
   - Master password: [secure password]
   - DB instance class: `db.t3.micro` (free tier)
   - Storage: 20 GB (gp2)
4. Connectivity:
   - VPC: Default
   - Public access: Yes (for development)
   - Security group: Create new with port 5432 open
5. Additional configuration:
   - Initial database name: `arvan_prod`
   - Backup retention: 7 days

### 1.2 Configure Security Group
- Add inbound rule: PostgreSQL (5432) from your IP or 0.0.0.0/0 (temporary)

### 1.3 Get Connection String
Format: `postgresql://username:password@host:port/database`

---

## Step 2: Backend Deployment (Elastic Beanstalk)

### 2.1 Prepare Backend for AWS
Create `.ebextensions` directory and configuration files:

```bash
mkdir arvan-backend-main/.ebextensions
```

Create `arvan-backend-main/.ebextensions/environment.config`:
```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
  aws:autoscaling:launchconfiguration:
    InstanceType: t3.small
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role
  aws:elasticbeanstalk:environment:proxy:staticfiles:
    /static: static
```

Create `arvan-backend-main/.ebextensions/packages.config`:
```yaml
packages:
  yum:
    git: []
commands:
  01_node_get:
    command: "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
  02_node_install:
    command: "source ~/.bashrc && nvm install 18 && nvm use 18"
  03_node_default:
    command: "source ~/.bashrc && nvm alias default 18"
```

### 2.2 Create Elastic Beanstalk Environment
1. AWS Console → Elastic Beanstalk → Create application
2. Application name: `arvan-backend`
3. Platform: Node.js 18
4. Application code: Upload source code

### 2.3 Environment Variables
Set these in EB environment configuration:
```
NODE_ENV=production
DATABASE_URL=postgresql://[your-rds-connection-string]
PORT=8080
FRONTENDURL=https://your-frontend-domain.com
AUTH_SECRET=[generate-secure-secret]
WHATSAPP_API_TOKEN=[your-token]
WHATSAPP_MOBILE=[your-mobile]
WHATSAPP_MOBILE_ID=[your-mobile-id]
WHATSAPP_BUISSNESS_ID=[your-business-id]
RESEND_API_KEY=[your-resend-key]
RESEND_EMAIL=[your-email]
CLOUDINARY_CLOUD_NAME=[your-cloudinary-name]
CLOUDINARY_API_KEY=[your-cloudinary-key]
CLOUDINARY_API_SECRET=[your-cloudinary-secret]
```

### 2.4 Deploy Backend
1. Zip the `arvan-backend-main` directory
2. Upload to Elastic Beanstalk
3. EB will handle build and deployment

---

## Step 3: Frontend Deployment (AWS Amplify)

### 3.1 Prepare Frontend
Update `arvan-main/next.config.ts` for production:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  images: {
    domains: ['your-cloudinary-domain.cloudfront.net'],
  },
}

export default nextConfig
```

### 3.2 Create Amplify App
1. AWS Console → Amplify → Create app
2. Connect repository (GitHub/GitLab/Bitbucket)
3. Build settings:
   - Build command: `npm run build`
   - Start command: `npm start`
   - Build output: `.next`
4. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-eb-url.elasticbeanstalk.com
   NEXTAUTH_URL=https://your-frontend-domain.com
   NEXTAUTH_SECRET=[secure-secret]
   ```

### 3.3 Domain Configuration
1. Add custom domain in Amplify
2. Update DNS records as instructed

---

## Step 4: File Storage Setup (S3)

### 4.1 Create S3 Bucket
1. AWS Console → S3 → Create bucket
2. Bucket name: `arvan-assets-[unique-suffix]`
3. Configure CORS for web access:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://your-frontend-domain.com"],
    "ExposeHeaders": []
  }
]
```

### 4.2 Update Environment Variables
Add S3 configuration to backend environment:
```
AWS_ACCESS_KEY_ID=[your-access-key]
AWS_SECRET_ACCESS_KEY=[your-secret-key]
S3_BUCKET_NAME=arvan-assets-[unique-suffix]
AWS_REGION=us-east-1
```

---

## Step 5: Database Migration

### 5.1 Run Prisma Migrations
After backend is deployed, SSH into EC2 instance or use EB CLI:
```bash
eb ssh arvan-backend
cd /var/app/current
npx prisma migrate deploy
npx prisma generate
```

---

## Step 6: SSL and Security

### 6.1 SSL Certificates
- Amplify provides free SSL automatically
- Elastic Beanstalk can use AWS Certificate Manager

### 6.2 Security Best Practices
1. Update RDS security group to only allow backend access
2. Use IAM roles instead of access keys
3. Enable CloudTrail for auditing
4. Configure WAF if needed

---

## Step 7: Monitoring and Logging

### 7.1 CloudWatch Setup
- Enable CloudWatch logs for Elastic Beanstalk
- Set up alarms for key metrics

### 7.2 Health Checks
- Configure health check endpoints in backend
- Set up monitoring in Amplify

---

## Step 8: Cost Optimization

### 8.1 Reserved Instances
- Consider RI for RDS if production workload is steady

### 8.2 Auto Scaling
- Configure auto scaling for Elastic Beanstalk based on CPU utilization

---

## Alternative Deployment Options

### Option A: ECS Fargate (More Scalable)
Instead of Elastic Beanstalk, use ECS Fargate:
1. Create ECR repository for Docker images
2. Build Docker image for backend
3. Deploy to ECS Fargate cluster
4. Use Application Load Balancer

### Option B: EC2 Instance (More Control)
1. Launch EC2 instance
2. Install Node.js and PostgreSQL
3. Deploy code manually or with scripts
4. Configure security groups and load balancer

### Option C: Frontend on S3 + CloudFront
Instead of Amplify:
1. Build Next.js app statically
2. Upload to S3 bucket
3. Configure CloudFront distribution
4. Set up custom domain and SSL

---

## Troubleshooting

### Common Issues:
1. **Database Connection**: Verify security groups and connection string
2. **Build Failures**: Check logs in Elastic Beanstalk console
3. **Environment Variables**: Ensure all required vars are set
4. **CORS Issues**: Update FRONTENDURL in backend config

### Useful Commands:
```bash
# Check EB logs
eb logs

# SSH into EB instance
eb ssh

# Deploy updates
eb deploy

# Check Amplify build logs
amplify console
```

---

## Estimated Monthly Costs (Basic Setup)
- RDS PostgreSQL (t3.micro): ~$15/month
- Elastic Beanstalk (t3.small): ~$20/month
- Amplify: ~$1/month
- S3: ~$1/month
- CloudFront: ~$1/month
**Total: ~$38/month**

---

## Next Steps
1. Test all functionality end-to-end
2. Set up CI/CD pipelines
3. Configure backup strategies
4. Implement monitoring dashboards
5. Set up alerting for critical issues

---

## Additional Resources
- [AWS Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Amazon RDS Documentation](https://docs.aws.amazon.com/rds/)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
