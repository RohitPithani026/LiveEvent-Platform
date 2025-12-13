# Deployment Guide

This guide provides step-by-step instructions for deploying the LiveEvent Platform to production.

## Architecture Overview

- **Frontend**: Next.js app deployed on Vercel
- **gRPC Service**: Backend service with gRPC + HTTP gateway
- **WebSocket Service**: Real-time WebSocket service

---

## Part 1: Frontend Deployment on Vercel

### Prerequisites
- GitHub account
- Vercel account (sign up at https://vercel.com)
- PostgreSQL database (Neon, Supabase, or Railway)

### Step 1: Prepare Your Repository
1. Ensure your code is pushed to GitHub
2. Make sure `vercel.json` is in the `frontend/` directory

### Step 2: Connect Repository to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Step 3: Set Environment Variables
In Vercel project settings, add these environment variables:

```
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secure_jwt_secret_key
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
NEXT_PUBLIC_WS_URL=https://your-websocket-service.com
BACKEND_HTTP_URL=https://your-grpc-http-gateway.com
```

**Important Notes:**
- `JWT_SECRET` must match the secret used in microservices
- `NEXT_PUBLIC_WS_URL` should be your WebSocket service URL (e.g., `wss://websockets.example.com`)
- `BACKEND_HTTP_URL` should be your gRPC HTTP gateway URL (e.g., `https://grpc.example.com`)

### Step 4: Deploy
1. Click **"Deploy"**
2. Vercel will build and deploy your application
3. Wait for the build to complete
4. Your app will be available at `https://your-app.vercel.app`

### Step 5: Run Database Migrations
After deployment, run Prisma migrations:

```bash
# Option 1: Using Vercel CLI
vercel env pull .env.local
cd frontend
npx prisma migrate deploy

# Option 2: Using Vercel's deployment environment
# Add a build script that runs migrations:
# In package.json, update build script:
# "build": "prisma migrate deploy && next build"
```

---

## Part 2: Microservices Deployment

You have several options for deploying microservices:
- **Option A**: Fly.io (Recommended for WebSockets)
- **Option B**: Railway
- **Option C**: Render
- **Option D**: AWS/GCP/Azure (for enterprise)

### Option A: Deploy to Fly.io (Recommended)

Fly.io is excellent for WebSocket services and has a free tier.

#### Step 1: Install Fly.io CLI
```bash
# macOS
brew install flyctl

# Linux/Windows
curl -L https://fly.io/install.sh | sh
```

#### Step 2: Login to Fly.io
```bash
fly auth login
```

#### Step 3: Deploy gRPC Service

1. **Navigate to gRPC directory:**
```bash
cd Microservices/gRPC
```

2. **Create Fly.io app:**
```bash
fly launch --name your-app-grpc
```

3. **Create `fly.toml` configuration:**
```toml
app = "your-app-grpc"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  GRPC_PORT = "50051"
  HTTP_PORT = "4001"

[[services]]
  internal_port = 50051
  protocol = "tcp"
  processes = ["app"]

  [[services.ports]]
    port = 50051
    handlers = ["tls", "http"]

[[services]]
  internal_port = 4001
  protocol = "tcp"
  processes = ["app"]

  [[services.ports]]
    port = 4001
    handlers = ["tls", "http"]

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

4. **Set secrets (environment variables):**
```bash
fly secrets set DATABASE_URL="your_postgresql_connection_string"
fly secrets set JWT_SECRET="your_jwt_secret"
fly secrets set GRPC_PORT="50051"
fly secrets set HTTP_PORT="4001"
```

5. **Deploy:**
```bash
fly deploy
```

6. **Get your service URL:**
```bash
fly status
# Note the hostname, e.g., your-app-grpc.fly.dev
```

#### Step 4: Deploy WebSocket Service

1. **Navigate to WebSockets directory:**
```bash
cd Microservices/WebSockets
```

2. **Create Fly.io app:**
```bash
fly launch --name your-app-websockets
```

3. **Create `fly.toml` configuration:**
```toml
app = "your-app-websockets"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "4000"

[[services]]
  internal_port = 4000
  protocol = "tcp"
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

4. **Set secrets:**
```bash
fly secrets set GRPC_URL="your-app-grpc.fly.dev:50051"
fly secrets set JWT_SECRET="your_jwt_secret"
fly secrets set PORT="4000"
```

5. **Deploy:**
```bash
fly deploy
```

6. **Get your WebSocket URL:**
```bash
fly status
# Note the hostname, e.g., your-app-websockets.fly.dev
# Use wss://your-app-websockets.fly.dev for WebSocket connections
```

---

### Option B: Deploy to Railway

#### Step 1: Install Railway CLI (Optional)
```bash
npm i -g @railway/cli
```

#### Step 2: Deploy gRPC Service

1. Go to [Railway Dashboard](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Select the `Microservices/gRPC` directory
6. Railway will auto-detect the Dockerfile
7. Add environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `GRPC_PORT=50051`
   - `HTTP_PORT=4001`
8. Deploy

#### Step 3: Deploy WebSocket Service

1. In Railway dashboard, click **"New Service"**
2. Select **"Deploy from GitHub repo"**
3. Choose the same repository
4. Select the `Microservices/WebSockets` directory
5. Add environment variables:
   - `GRPC_URL` (use the gRPC service URL from Railway)
   - `JWT_SECRET` (same as gRPC service)
   - `PORT=4000`
6. Deploy

---

### Option C: Deploy to Render

#### Step 1: Deploy gRPC Service

1. Go to [Render Dashboard](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `your-app-grpc`
   - **Root Directory**: `Microservices/gRPC`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Microservices/gRPC/Dockerfile`
   - **Docker Context**: `Microservices/gRPC`
5. Add environment variables (same as above)
6. Deploy

#### Step 2: Deploy WebSocket Service

1. Click **"New +"** → **"Web Service"**
2. Configure:
   - **Name**: `your-app-websockets`
   - **Root Directory**: `Microservices/WebSockets`
   - **Environment**: `Docker`
3. Add environment variables
4. Deploy

---

## Part 3: Update Frontend Environment Variables

After deploying microservices, update your Vercel environment variables:

1. Go to Vercel project settings
2. Update these variables:
   ```
   NEXT_PUBLIC_WS_URL=wss://your-websockets-service.com
   BACKEND_HTTP_URL=https://your-grpc-http-gateway.com
   ```
3. Redeploy your frontend

---

## Part 4: Post-Deployment Checklist

### Database Setup
- [ ] Run Prisma migrations: `npx prisma migrate deploy`
- [ ] Verify database connection
- [ ] Check that all tables are created

### Service Connectivity
- [ ] Verify gRPC service is accessible
- [ ] Verify WebSocket service is accessible
- [ ] Test WebSocket connection from frontend
- [ ] Test API calls to gRPC HTTP gateway

### Security
- [ ] Ensure all environment variables are set
- [ ] Verify JWT_SECRET is the same across all services
- [ ] Enable HTTPS for all services
- [ ] Review CORS settings

### Monitoring
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Set up uptime monitoring
- [ ] Configure logging

---

## Troubleshooting

### Frontend Issues

**Build fails:**
- Check environment variables are set correctly
- Verify database connection string
- Check build logs in Vercel

**API routes not working:**
- Verify `BACKEND_HTTP_URL` is correct
- Check CORS settings
- Verify JWT tokens are being sent

### WebSocket Issues

**Connection fails:**
- Verify `NEXT_PUBLIC_WS_URL` uses `wss://` (secure WebSocket)
- Check WebSocket service is running
- Verify firewall/network settings

**Messages not received:**
- Check WebSocket service logs
- Verify gRPC service connection
- Check JWT token validation

### gRPC Service Issues

**Service not accessible:**
- Verify ports are exposed correctly
- Check firewall rules
- Verify environment variables

**Database connection fails:**
- Verify `DATABASE_URL` is correct
- Check database is accessible from service
- Verify Prisma client is generated

---

## Production Best Practices

1. **Use Environment Variables**: Never commit secrets to git
2. **Enable HTTPS**: All services should use HTTPS/WSS
3. **Set up Monitoring**: Use services like Sentry, Datadog, or New Relic
4. **Database Backups**: Set up automated backups for your PostgreSQL database
5. **Rate Limiting**: Implement rate limiting on API endpoints
6. **Caching**: Use Redis for caching if needed
7. **CDN**: Use a CDN for static assets
8. **Load Balancing**: For high traffic, use load balancers

---

## Cost Estimation

### Free Tier Options:
- **Vercel**: Free tier includes 100GB bandwidth/month
- **Fly.io**: Free tier includes 3 shared VMs
- **Railway**: $5/month for starter plan
- **Render**: Free tier available (with limitations)

### Recommended Setup (Small to Medium Scale):
- **Frontend**: Vercel (Free tier)
- **gRPC Service**: Fly.io (Free tier)
- **WebSocket Service**: Fly.io (Free tier)
- **Database**: Neon (Free tier) or Supabase (Free tier)

**Total Cost**: $0-10/month

---

## Support

For issues or questions:
1. Check service logs
2. Review environment variables
3. Verify network connectivity
4. Check service documentation

---

## Quick Reference

### Service URLs Format:
- **Frontend**: `https://your-app.vercel.app`
- **gRPC HTTP Gateway**: `https://your-grpc-service.com:4001`
- **WebSocket Service**: `wss://your-websockets-service.com`

### Environment Variables Checklist:
- [ ] `DATABASE_URL` (same for all services)
- [ ] `JWT_SECRET` (same for all services)
- [ ] `NEXT_PUBLIC_WS_URL` (frontend only)
- [ ] `BACKEND_HTTP_URL` (frontend only)
- [ ] `NEXTAUTH_SECRET` (frontend only)
- [ ] `NEXTAUTH_URL` (frontend only)
- [ ] `GRPC_URL` (WebSocket service only)
- [ ] `GRPC_PORT` (gRPC service only)
- [ ] `HTTP_PORT` (gRPC service only)
- [ ] `PORT` (WebSocket service only)


