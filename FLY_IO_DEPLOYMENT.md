# Fly.io Deployment Guide - Step by Step

Complete guide for deploying WebSocket and gRPC services to Fly.io (free tier).

---

## Prerequisites

1. **GitHub account** (your code should be on GitHub)
2. **Fly.io account** (sign up at https://fly.io - it's free)
3. **PostgreSQL database** (Neon, Supabase, or Railway - all have free tiers)
4. **Node.js 18+** installed locally (for building)

---

## Step 1: Install Fly.io CLI

### macOS:
```bash
brew install flyctl
```

### Linux/Windows:
```bash
curl -L https://fly.io/install.sh | sh
```

### Verify Installation:
```bash
fly version
```

---

## Step 2: Login to Fly.io

```bash
fly auth login
```

This will open a browser window for authentication. Complete the login process.

---

## Step 3: Deploy gRPC Service

### 3.1 Navigate to gRPC Directory
```bash
cd Microservices/gRPC
```

### 3.2 Initialize Fly.io App
```bash
fly launch --name your-app-grpc
```

**When prompted:**
- **App name**: Use the suggested name or choose your own (must be globally unique)
- **Region**: Choose closest to you (e.g., `iad` for US East, `lhr` for London)
- **Postgres**: Select "No" (we'll use external database)
- **Redis**: Select "No"
- **Deploy now**: Select "No" (we'll configure first)

### 3.3 Configure fly.toml

The `fly launch` command creates a `fly.toml` file. Replace its contents with:

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

**Important**: Replace `your-app-grpc` with your actual app name.

### 3.4 Set Environment Variables (Secrets)

```bash
fly secrets set DATABASE_URL="your-postgresql-connection-string"
fly secrets set JWT_SECRET="your-secure-jwt-secret-key"
fly secrets set GRPC_PORT="50051"
fly secrets set HTTP_PORT="4001"
```

**Where to get values:**
- `DATABASE_URL`: From your PostgreSQL provider (Neon, Supabase, etc.)
- `JWT_SECRET`: Generate a secure random string (use the same for all services)

**Generate JWT_SECRET:**
```bash
# macOS/Linux
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3.5 Deploy

```bash
fly deploy
```

This will:
1. Build your Docker image
2. Push it to Fly.io
3. Deploy your service

**First deployment takes 3-5 minutes.**

### 3.6 Get Your Service URL

```bash
fly status
```

Look for the hostname, e.g., `your-app-grpc.fly.dev`

**Note these URLs:**
- **gRPC**: `your-app-grpc.fly.dev:50051`
- **HTTP Gateway**: `https://your-app-grpc.fly.dev:4001`

---

## Step 4: Deploy WebSocket Service

### 4.1 Navigate to WebSockets Directory
```bash
cd ../WebSockets
```

### 4.2 Initialize Fly.io App
```bash
fly launch --name your-app-websockets
```

**When prompted:**
- **App name**: Choose a unique name (e.g., `your-app-websockets`)
- **Region**: Choose same region as gRPC service (for lower latency)
- **Postgres**: Select "No"
- **Redis**: Select "No"
- **Deploy now**: Select "No"

### 4.3 Configure fly.toml

Replace `fly.toml` contents with:

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

**Important**: Replace `your-app-websockets` with your actual app name.

### 4.4 Set Environment Variables

```bash
fly secrets set GRPC_URL="your-app-grpc.fly.dev:50051"
fly secrets set JWT_SECRET="your-secure-jwt-secret-key"
fly secrets set PORT="4000"
```

**Important**: 
- `GRPC_URL` should use the gRPC service hostname from Step 3.6
- `JWT_SECRET` must match the one used in gRPC service

### 4.5 Deploy

```bash
fly deploy
```

### 4.6 Get Your WebSocket URL

```bash
fly status
```

Look for the hostname, e.g., `your-app-websockets.fly.dev`

**WebSocket URL**: `wss://your-app-websockets.fly.dev` (note the `wss://` for secure WebSocket)

---

## Step 5: Update Frontend Environment Variables

### 5.1 Go to Vercel Dashboard

1. Open your Vercel project
2. Go to **Settings** → **Environment Variables**

### 5.2 Add/Update These Variables

```
NEXT_PUBLIC_WS_URL=wss://your-app-websockets.fly.dev
BACKEND_HTTP_URL=https://your-app-grpc.fly.dev:4001
```

**Important**: 
- Use `wss://` (secure WebSocket) not `ws://`
- Use `https://` for HTTP gateway

### 5.3 Redeploy Frontend

In Vercel dashboard, go to **Deployments** and click **Redeploy** on the latest deployment.

---

## Step 6: Run Database Migrations

### 6.1 For Frontend (Vercel)

You can run migrations via Vercel CLI or add to build script:

**Option A: Via Vercel CLI**
```bash
cd frontend
vercel env pull .env.local
npx prisma migrate deploy
```

**Option B: Add to package.json build script**
```json
{
  "scripts": {
    "build": "prisma migrate deploy && next build"
  }
}
```

### 6.2 For gRPC Service

Migrations should run automatically on first deploy, but you can verify:

```bash
cd Microservices/gRPC
fly ssh console
# Then inside the container:
npx prisma migrate deploy
exit
```

---

## Step 7: Verify Deployment

### 7.1 Check gRPC Service

```bash
# Check if service is running
fly status -a your-app-grpc

# Check logs
fly logs -a your-app-grpc

# Test HTTP gateway
curl https://your-app-grpc.fly.dev:4001/health
```

### 7.2 Check WebSocket Service

```bash
# Check if service is running
fly status -a your-app-websockets

# Check logs
fly logs -a your-app-websockets
```

### 7.3 Test from Frontend

1. Open your deployed frontend
2. Open browser console (F12)
3. Try to connect to WebSocket
4. Check for connection errors

---

## Troubleshooting

### Issue: Service won't start

**Check logs:**
```bash
fly logs -a your-app-name
```

**Common issues:**
- Missing environment variables → Check with `fly secrets list -a your-app-name`
- Database connection error → Verify `DATABASE_URL`
- Port binding error → Check `fly.toml` port configuration

### Issue: WebSocket connection fails

**Check:**
1. WebSocket URL uses `wss://` (not `ws://`)
2. CORS is configured correctly
3. Service is running: `fly status -a your-app-websockets`
4. Check logs: `fly logs -a your-app-websockets`

### Issue: gRPC connection fails

**Check:**
1. `GRPC_URL` in WebSocket service matches gRPC service hostname
2. Port 50051 is accessible
3. Both services are in same region (for lower latency)

### Issue: Database connection fails

**Check:**
1. `DATABASE_URL` is correct
2. Database allows connections from Fly.io IPs
3. Database credentials are correct

---

## Useful Fly.io Commands

### View App Status
```bash
fly status -a your-app-name
```

### View Logs
```bash
fly logs -a your-app-name
```

### View Secrets
```bash
fly secrets list -a your-app-name
```

### Update Secrets
```bash
fly secrets set KEY="value" -a your-app-name
```

### SSH into Container
```bash
fly ssh console -a your-app-name
```

### Restart Service
```bash
fly apps restart your-app-name
```

### View App Info
```bash
fly info -a your-app-name
```

---

## Monitoring Usage (Stay Within Free Tier)

### Check Resource Usage
```bash
fly status -a your-app-name
```

### Monitor Bandwidth
Fly.io dashboard: https://fly.io/dashboard

**Free Tier Limits:**
- 3 shared VMs
- 160GB outbound data/month
- Unlimited inbound

**Stay within limits:**
- Monitor dashboard monthly
- Set up alerts if approaching limits
- Optimize code to reduce bandwidth

---

## Cost Breakdown

### Free Tier (Your Use Case)
- **gRPC Service**: 1 shared VM = **$0/month**
- **WebSocket Service**: 1 shared VM = **$0/month**
- **Bandwidth**: 160GB/month included = **$0/month**
- **Total**: **$0/month** ✅

### If You Exceed Free Tier
- Additional VM: ~$1.94/month
- Additional bandwidth: $0.02/GB after 160GB

**For low traffic, you'll stay free!**

---

## Next Steps

1. ✅ Deploy gRPC service
2. ✅ Deploy WebSocket service
3. ✅ Update frontend environment variables
4. ✅ Test all connections
5. ✅ Monitor usage in Fly.io dashboard

---

## Quick Reference

### Service URLs Format:
- **gRPC**: `your-app-grpc.fly.dev:50051`
- **HTTP Gateway**: `https://your-app-grpc.fly.dev:4001`
- **WebSocket**: `wss://your-app-websockets.fly.dev`

### Environment Variables Checklist:

**gRPC Service:**
- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `GRPC_PORT=50051`
- [ ] `HTTP_PORT=4001`

**WebSocket Service:**
- [ ] `GRPC_URL=your-app-grpc.fly.dev:50051`
- [ ] `JWT_SECRET` (must match gRPC)
- [ ] `PORT=4000`

**Frontend (Vercel):**
- [ ] `NEXT_PUBLIC_WS_URL=wss://your-app-websockets.fly.dev`
- [ ] `BACKEND_HTTP_URL=https://your-app-grpc.fly.dev:4001`

---

## Support

- **Fly.io Docs**: https://fly.io/docs
- **Fly.io Community**: https://community.fly.io
- **Fly.io Status**: https://status.fly.io

---

**You're all set! Your services should now be running on Fly.io's free tier.** 🚀


