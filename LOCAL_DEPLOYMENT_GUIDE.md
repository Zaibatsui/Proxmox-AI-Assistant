# Local Deployment Guide - Proxmox AI Admin

This guide explains how to deploy the Proxmox AI Admin app on your own infrastructure after migrating from Emergent's `emergentintegrations` library.

## Migration Complete ✅

The app has been migrated from Emergent-specific libraries to standard open-source packages:

**Changed:**
- ❌ `emergentintegrations` → ✅ `anthropic` (official Anthropic SDK)
- ❌ `EMERGENT_LLM_KEY` → ✅ `ANTHROPIC_API_KEY`

**Model Updated:**
- Using: `claude-3-5-sonnet-20241022` (latest stable Claude model)

## Prerequisites

### 1. Get Anthropic API Key

1. Go to: https://console.anthropic.com/
2. Sign up or log in
3. Navigate to: **API Keys** → **Create Key**
4. Copy your API key (starts with `sk-ant-`)

### 2. System Requirements

- Docker & Docker Compose (recommended)
- OR: Python 3.11+, Node.js 20+, MongoDB 7.0
- Proxmox VE server (for production use)

## Deployment Options

### Option 1: Docker Compose (Recommended)

**1. Clone/Download the project**

**2. Update environment variables:**

Edit `backend/.env`:
```bash
MONGO_URL="mongodb://mongodb:27017"
DB_NAME="proxmox_ai_admin"
CORS_ORIGINS="*"
JWT_SECRET="your-secure-secret-key-here"
ANTHROPIC_API_KEY="sk-ant-your-actual-key-here"
```

Edit `frontend/.env`:
```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

**3. Start with Docker Compose:**
```bash
docker-compose up -d
```

**4. Access the app:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8001

**5. Verify AI is working:**
- Create account → Login
- Go to AI Assistant
- Ask: "What is IOMMU?"
- Should get Claude response

### Option 2: Manual Installation

**Backend Setup:**
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start backend
uvicorn server:app --host 0.0.0.0 --port 8001
```

**Frontend Setup:**
```bash
cd frontend

# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Edit .env - set REACT_APP_BACKEND_URL

# Start frontend
yarn start
```

**MongoDB:**
```bash
# Option 1: Docker
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Option 2: Install locally
# See: https://www.mongodb.com/docs/manual/installation/
```

## Configuration Details

### Backend Environment Variables

```bash
# Database
MONGO_URL="mongodb://localhost:27017"
DB_NAME="proxmox_ai_admin"

# Security
JWT_SECRET="change-this-to-a-long-random-string"
CORS_ORIGINS="*"  # For production, set specific origins

# AI Service (REQUIRED for AI Assistant feature)
ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

### Frontend Environment Variables

```bash
# Backend API endpoint
REACT_APP_BACKEND_URL=http://localhost:8001

# Optional
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

## Features That Require API Keys

### Claude AI Integration (Optional but Recommended)

**What it does:**
- AI Assistant for hardware analysis
- Automated action creation
- Intelligent passthrough suggestions

**Cost:**
- Pay-as-you-go pricing
- ~$3 per 1M input tokens
- ~$15 per 1M output tokens
- See: https://www.anthropic.com/pricing

**Without API key:**
- App works fine for device scanning, VM management
- AI Assistant will show error: "AI service not configured"

## Proxmox Integration

### For Real Device Scanning

**1. SSH Key Setup (in container/VM running the app):**
```bash
ssh-keygen -t ed25519 -N ""
ssh-copy-id root@YOUR_PROXMOX_IP
```

**2. Proxmox API Token:**
- In Proxmox Web UI:
- Datacenter → Permissions → API Tokens
- Create token for root@pam
- Copy token ID and secret
- Add in Settings page of the app

### For Mock Data (Testing)

Without Proxmox connection, the app uses mock device data for demonstration.

## Production Deployment

### Security Checklist

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Set `CORS_ORIGINS` to your domain only
- [ ] Use HTTPS (reverse proxy with Caddy/Nginx)
- [ ] Secure MongoDB with authentication
- [ ] Restrict Proxmox API token permissions
- [ ] Use environment-specific `.env` files
- [ ] Never commit API keys to git

### Reverse Proxy Example (Caddy)

```caddy
proxmox-ai.yourdomain.com {
    reverse_proxy localhost:3000
    
    handle /api/* {
        reverse_proxy localhost:8001
    }
}
```

### Persistence

Docker volumes for data:
```yaml
volumes:
  - ./data/mongodb:/data/db
  - ./backups:/backups
```

Regular backups:
```bash
# Backup MongoDB
docker exec mongodb mongodump --out=/backups/$(date +%Y%m%d)

# Backup configs
tar -czf configs_backup.tar.gz backend/.env frontend/.env
```

## Troubleshooting

### AI Not Working

**Error:** "AI service not configured"

**Solution:**
1. Check `backend/.env` has `ANTHROPIC_API_KEY`
2. Verify key is valid: https://console.anthropic.com/
3. Restart backend: `docker-compose restart backend`
4. Check logs: `docker logs proxmox-ai-backend`

### Device Scanning Shows Mock Data

**Issue:** Always shows GTX 980, Samsung NVMe

**Solution:**
- Configure SSH access to Proxmox host
- Add Proxmox API token in Settings
- See `PROXMOX_SETUP.md` for details

### Database Connection Failed

**Error:** "Connection to MongoDB failed"

**Solutions:**
- Verify MongoDB is running: `docker ps`
- Check `MONGO_URL` in `backend/.env`
- For Docker: Use `mongodb://mongodb:27017`
- For local: Use `mongodb://localhost:27017`

### Frontend Can't Reach Backend

**Error:** "Network Error" or 404 on API calls

**Solutions:**
- Verify backend is running: `curl http://localhost:8001/api/`
- Check `REACT_APP_BACKEND_URL` in `frontend/.env`
- For Docker: Use internal service name
- For local: Use `http://localhost:8001`

## Cost Estimation

### Anthropic Claude API

**Typical usage for Proxmox AI Admin:**

- 50 AI queries/day
- ~500 tokens per query (input)
- ~1000 tokens per response (output)

**Monthly cost:**
```
Input:  50 * 30 * 500 = 750,000 tokens = $2.25
Output: 50 * 30 * 1000 = 1,500,000 tokens = $22.50
Total: ~$25/month
```

**Free tier:**
- Anthropic offers $5 free credits
- Covers ~200 queries

## Alternative AI Providers

If you want to use other AI services:

### OpenAI (GPT-4)

```bash
pip install openai
```

Replace in `server.py`:
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
response = await client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": system_message},
        {"role": "user", "content": query.question}
    ]
)
```

### Local LLMs (Ollama)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull llama2

# Use in code
pip install ollama
```

## Support & Resources

- **Anthropic Docs:** https://docs.anthropic.com/
- **Proxmox Docs:** https://pve.proxmox.com/wiki/
- **MongoDB Docs:** https://www.mongodb.com/docs/

## Migration from Emergent Platform

If you're migrating from Emergent platform:

**What stays the same:**
- All UI and UX
- Database schema
- Feature functionality
- Theme system

**What changes:**
- Need your own Anthropic API key
- Self-manage infrastructure
- Handle your own deployment
- Pay API costs directly

**Benefits:**
- Full control over deployment
- No platform dependencies
- Can customize everything
- Host anywhere (AWS, GCP, on-premise)

## Next Steps

1. ✅ Get Anthropic API key
2. ✅ Update `backend/.env`
3. ✅ Run with Docker Compose
4. ✅ Configure Proxmox connection
5. ✅ Test AI Assistant feature
6. ✅ Set up SSH for real device scanning
7. ✅ Configure backups
8. ✅ Deploy to production (optional)

**Your app is now fully independent and ready for local/self-hosted deployment!** 🚀
