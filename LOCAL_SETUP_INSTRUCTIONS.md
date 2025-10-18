# Local Environment Setup Instructions

## Issue Fixed
The frontend was pointing to the cloud backend URL instead of your local backend. This has been corrected.

## Changes Made

### 1. Frontend .env file (`/app/frontend/.env`)
- **Before:** `REACT_APP_BACKEND_URL=https://proxmox-ai-assist.preview.emergentagent.com`
- **After:** `REACT_APP_BACKEND_URL=http://localhost:8001`

### 2. Docker Compose file (`/app/docker-compose.yml`)
- Frontend environment now uses: `http://localhost:8001`
- Backend uses MongoDB service name: `mongodb://mongodb:27017`
- Replaced `EMERGENT_LLM_KEY` with `OPENAI_API_KEY`

## How to Apply These Changes

### Step 1: Stop All Containers
```bash
cd /path/to/your/project
docker-compose down
```

### Step 2: Rebuild and Start Containers
```bash
docker-compose up -d --build
```

This will:
- Rebuild the frontend with the new environment variable
- Rebuild the backend with updated configuration
- Start all services with the correct settings

### Step 3: Verify Services Are Running
```bash
# Check all containers are running
docker-compose ps

# Check backend logs
docker logs -f proxmox-ai-backend

# Check frontend logs
docker logs -f proxmox-ai-frontend
```

### Step 4: Test the Connection

1. **Test Backend API:**
   - Open browser to: `http://localhost:8001/docs`
   - You should see the FastAPI Swagger documentation

2. **Test Frontend:**
   - Open browser to: `http://localhost:3000`
   - You should see the login screen
   - Try registering a new account

## Troubleshooting

### If registration still doesn't work:

1. **Check backend logs for errors:**
   ```bash
   docker logs proxmox-ai-backend
   ```

2. **Check if backend is accessible:**
   ```bash
   curl http://localhost:8001/api/health
   ```

3. **Check browser console:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for any network errors when you submit the registration form

4. **Verify CORS settings:**
   - Backend should have `CORS_ORIGINS=*` in environment variables
   - Check if requests are being blocked

### If MongoDB connection fails:

```bash
# Check MongoDB logs
docker logs proxmox-ai-mongodb

# Verify MongoDB is running
docker exec -it proxmox-ai-mongodb mongosh --eval "db.version()"
```

## Network Configuration Explained

### Why the change was needed:

**Docker Internal Network:**
- Services inside Docker can communicate using service names (e.g., `mongodb`, `backend`)
- The backend container can reach MongoDB using `mongodb://mongodb:27017`

**Browser Access (Frontend):**
- React apps run in the browser (client-side), NOT in the Docker container
- Your browser cannot resolve Docker service names like `proxmox-ai-backend`
- The browser needs to use `localhost:8001` to reach the backend from your host machine

**Port Mapping:**
- Docker exposes `8001:8001` - this maps container port 8001 to host port 8001
- Your browser accesses `http://localhost:8001` which Docker routes to the backend container

## Alternative: Using Host IP Address

If `localhost` doesn't work (e.g., accessing from another device on your network), you can use your machine's IP address:

1. Find your IP address:
   ```bash
   # Linux/Mac
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```

2. Update frontend .env:
   ```bash
   REACT_APP_BACKEND_URL=http://192.168.x.x:8001
   ```
   (Replace `192.168.x.x` with your actual IP)

3. Rebuild and restart:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## Quick Reference

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001
- **API Docs:** http://localhost:8001/docs
- **MongoDB:** localhost:27017 (no web interface)

## Need Help?

If you're still experiencing issues after following these steps, please provide:
1. Output of `docker-compose ps`
2. Backend logs: `docker logs proxmox-ai-backend`
3. Any error messages from browser console (F12)
