# Quick Deployment Checklist

## Frontend (Vercel) - 5 Steps

- [ ] **Step 1**: Push code to GitHub
- [ ] **Step 2**: Connect repo to Vercel (set root directory to `frontend`)
- [ ] **Step 3**: Add environment variables in Vercel dashboard
- [ ] **Step 4**: Deploy (automatic on push to main)
- [ ] **Step 5**: Run database migrations: `npx prisma migrate deploy`

## gRPC Service (Fly.io) - 6 Steps

- [ ] **Step 1**: Install Fly.io CLI: `brew install flyctl`
- [ ] **Step 2**: Login: `fly auth login`
- [ ] **Step 3**: Navigate: `cd Microservices/gRPC`
- [ ] **Step 4**: Initialize: `fly launch --name your-app-grpc`
- [ ] **Step 5**: Set secrets: `fly secrets set DATABASE_URL=... JWT_SECRET=...`
- [ ] **Step 6**: Deploy: `fly deploy`

## WebSocket Service (Fly.io) - 6 Steps

- [ ] **Step 1**: Navigate: `cd Microservices/WebSockets`
- [ ] **Step 2**: Initialize: `fly launch --name your-app-websockets`
- [ ] **Step 3**: Set secrets: `fly secrets set GRPC_URL=... JWT_SECRET=...`
- [ ] **Step 4**: Deploy: `fly deploy`
- [ ] **Step 5**: Get URL: `fly status`
- [ ] **Step 6**: Update Vercel env: `NEXT_PUBLIC_WS_URL=wss://your-app-websockets.fly.dev`

## Final Steps

- [ ] Update Vercel environment variables with microservice URLs
- [ ] Test WebSocket connection
- [ ] Test API calls to gRPC gateway
- [ ] Verify all services are running

## Environment Variables Summary

### Frontend (Vercel)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
NEXT_PUBLIC_WS_URL=wss://your-websockets.fly.dev
BACKEND_HTTP_URL=https://your-grpc.fly.dev:4001
```

### gRPC Service (Fly.io)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret (must match frontend)
GRPC_PORT=50051
HTTP_PORT=4001
```

### WebSocket Service (Fly.io)
```
GRPC_URL=your-app-grpc.fly.dev:50051
JWT_SECRET=your-secret (must match frontend)
PORT=4000
```


