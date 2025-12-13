# Fly.io Quick Start Checklist

Follow these steps in order to deploy your microservices to Fly.io.

---

## ✅ Pre-Deployment Checklist

- [ ] Fly.io account created (https://fly.io)
- [ ] Fly.io CLI installed (`brew install flyctl` or see FLY_IO_DEPLOYMENT.md)
- [ ] Logged in to Fly.io (`fly auth login`)
- [ ] PostgreSQL database ready (Neon/Supabase/Railway)
- [ ] JWT_SECRET generated (use same for all services)
- [ ] Code pushed to GitHub

---

## 🚀 Deploy gRPC Service

### Step 1: Setup
```bash
cd Microservices/gRPC
fly launch --name your-app-grpc
# Choose region, say "No" to Postgres/Redis, "No" to deploy now
```

### Step 2: Configure
```bash
# Copy example config
cp fly.toml.example fly.toml
# Edit fly.toml and replace "your-app-grpc" with your actual app name
```

### Step 3: Set Secrets
```bash
fly secrets set DATABASE_URL="your-postgresql-url"
fly secrets set JWT_SECRET="your-generated-secret"
fly secrets set GRPC_PORT="50051"
fly secrets set HTTP_PORT="4001"
```

### Step 4: Deploy
```bash
fly deploy
```

### Step 5: Get URL
```bash
fly status
# Note: your-app-grpc.fly.dev
# gRPC: your-app-grpc.fly.dev:50051
# HTTP: https://your-app-grpc.fly.dev:4001
```

**✅ gRPC Service Deployed!**

---

## 🚀 Deploy WebSocket Service

### Step 1: Setup
```bash
cd ../WebSockets
fly launch --name your-app-websockets
# Choose same region as gRPC, say "No" to Postgres/Redis, "No" to deploy now
```

### Step 2: Configure
```bash
# Copy example config
cp fly.toml.example fly.toml
# Edit fly.toml and replace "your-app-websockets" with your actual app name
```

### Step 3: Set Secrets
```bash
fly secrets set GRPC_URL="your-app-grpc.fly.dev:50051"
fly secrets set JWT_SECRET="same-secret-as-grpc"
fly secrets set PORT="4000"
```

### Step 4: Deploy
```bash
fly deploy
```

### Step 5: Get URL
```bash
fly status
# Note: your-app-websockets.fly.dev
# WebSocket: wss://your-app-websockets.fly.dev
```

**✅ WebSocket Service Deployed!**

---

## 🔗 Update Frontend

### Step 1: Go to Vercel Dashboard
- Open your Vercel project
- Settings → Environment Variables

### Step 2: Add/Update Variables
```
NEXT_PUBLIC_WS_URL=wss://your-app-websockets.fly.dev
BACKEND_HTTP_URL=https://your-app-grpc.fly.dev:4001
```

### Step 3: Redeploy
- Go to Deployments
- Click "Redeploy" on latest deployment

**✅ Frontend Updated!**

---

## 🧪 Test Everything

- [ ] gRPC service is running: `fly status -a your-app-grpc`
- [ ] WebSocket service is running: `fly status -a your-app-websockets`
- [ ] Frontend loads correctly
- [ ] WebSocket connects (check browser console)
- [ ] API calls work (test from frontend)

---

## 📊 Monitor Usage

- [ ] Check Fly.io dashboard: https://fly.io/dashboard
- [ ] Verify you're within free tier limits
- [ ] Set up usage alerts (optional)

---

## 🎉 Done!

Your services are now running on Fly.io's free tier!

**Total Cost: $0/month** (for low-traffic usage)

---

## 🆘 Need Help?

- **Full Guide**: See `FLY_IO_DEPLOYMENT.md`
- **Troubleshooting**: Check logs with `fly logs -a your-app-name`
- **Fly.io Docs**: https://fly.io/docs

---

## Quick Commands Reference

```bash
# Check status
fly status -a your-app-name

# View logs
fly logs -a your-app-name

# List secrets
fly secrets list -a your-app-name

# Restart service
fly apps restart your-app-name

# SSH into container
fly ssh console -a your-app-name
```


