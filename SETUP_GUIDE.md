# Proxmox AI Admin - Complete Setup Guide v2.0

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Initial Configuration](#initial-configuration)
4. [Proxmox Setup](#proxmox-setup)
5. [AI Configuration](#ai-configuration)
6. [First Steps](#first-steps)
7. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Server Requirements
- **OS:** Linux (Ubuntu 20.04+, Debian 11+, or similar)
- **Docker:** Version 20.10+
- **Docker Compose:** Version 2.0+
- **RAM:** Minimum 2GB available
- **Storage:** 5GB for Docker images and data

### Network Requirements
- **Ports:**
  - `3000` - Frontend (Web UI)
  - `8001` - Backend API
  - `27017` - MongoDB (internal only)
- **Proxmox Access:**
  - API port `8006` (or `443` if using reverse proxy)
  - SSH port `22` (optional, for device scanning)

### Proxmox Requirements
- **Version:** Proxmox VE 7.0 or higher
- **Access:** API token with appropriate permissions
- **SSH:** Optional but recommended for hardware device scanning

---

## Installation

### Step 1: Install Docker & Docker Compose

**Ubuntu/Debian:**
```bash
# Update package index
sudo apt update

# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### Step 2: Download Proxmox AI Admin

```bash
# Clone repository (or download and extract)
git clone <repository-url>
cd Proxmox-AI-Assistant
```

### Step 3: Configure Environment

**Edit `docker-compose.yml`:**
```bash
nano docker-compose.yml
```

**Update frontend environment variable:**
```yaml
frontend:
  environment:
    - REACT_APP_BACKEND_URL=http://YOUR_SERVER_IP:8001
```

**Replace `YOUR_SERVER_IP` with:**
- `localhost` - If accessing from same machine
- `192.168.1.56` - Your server's local IP
- `your-domain.com` - Your domain name (if using reverse proxy)

**Example:**
```yaml
- REACT_APP_BACKEND_URL=http://192.168.1.56:8001
```

### Step 4: Start Services

```bash
# Start all services in detached mode
docker-compose up -d

# Verify all services are running
docker-compose ps

# You should see:
# proxmox-ai-frontend   Up   0.0.0.0:3000->3000/tcp
# proxmox-ai-backend    Up   0.0.0.0:8001->8001/tcp
# proxmox-ai-mongodb    Up   27017/tcp
```

### Step 5: Access the Application

**Open your browser:**
```
http://YOUR_SERVER_IP:3000
```

**Or on the same machine:**
```
http://localhost:3000
```

---

## Initial Configuration

### Create Your Account

1. On the login page, click **"Create Account"**
2. Enter your details:
   - **Username:** Your preferred username
   - **Email:** Your email address
   - **Password:** Strong password (min 8 characters)
3. Click **"Sign Up"**
4. You'll be automatically logged in

### Configure Proxmox Connection

1. Navigate to **Settings** page (gear icon in sidebar)
2. Find **"Proxmox API Configuration"** section
3. Follow instructions in [PROXMOX_CONFIGURATION.md](./PROXMOX_CONFIGURATION.md) to:
   - Create API token in Proxmox
   - Configure SSH access (optional but recommended)
4. Enter configuration in Settings page
5. Click **"Save API Config"**
6. Click **"Test API"** to verify connection

### Optional: Configure AI Assistant

1. In **Settings** page, find **"AI Configuration"** section
2. Follow instructions in [AI_CONFIGURATION.md](./AI_CONFIGURATION.md)
3. Enter OpenAI API key
4. Click **"Save Keys"**

---

## Proxmox Setup

**See [PROXMOX_CONFIGURATION.md](./PROXMOX_CONFIGURATION.md) for detailed instructions:**

1. Creating API tokens with correct permissions
2. Enabling "Privilege Separation"
3. Setting up SSH access
4. Testing connectivity

---

## AI Configuration

**See [AI_CONFIGURATION.md](./AI_CONFIGURATION.md) for detailed instructions:**

1. Getting OpenAI API key
2. Configuring per-user API keys
3. AI features overview

---

## First Steps

### 1. Verify Proxmox Connection

**In Settings page:**
- API status should show: ✅ **Connected** (with node count)
- SSH status will show ⚠️ **Failed** if SSH not configured (optional)

### 2. View Your VMs

**Navigate to "VM & Container Management":**
- Should display all your VMs and containers
- Organized by Running/Stopped status
- Try starting/stopping a VM

### 3. Scan Hardware Devices

**Navigate to "Device Scanner":**
1. Click **"Scan Devices"** button
2. Wait for scan to complete
3. View your hardware organized by category
4. Note: Requires SSH access to show real devices

### 4. Try the AI Assistant

**Navigate to "AI Assistant":**

Try asking:
- "What VMs do I have running?"
- "Show me all my hardware devices"
- "Tell me about my Proxmox environment"

---

## Troubleshooting

### Issue: Can't Access Web UI

**Check if services are running:**
```bash
docker-compose ps
```

**Check frontend logs:**
```bash
docker logs proxmox-ai-frontend
```

**Verify port not in use:**
```bash
sudo netstat -tlnp | grep 3000
```

### Issue: API Connection Failed

**1. Verify backend URL in browser:**
```
http://YOUR_SERVER_IP:8001/docs
```
Should show FastAPI documentation.

**2. Check backend logs:**
```bash
docker logs proxmox-ai-backend
```

**3. Verify network connectivity:**
```bash
# From your client machine
curl http://YOUR_SERVER_IP:8001/api/health
```

### Issue: Proxmox Connection Failed

**1. Test Proxmox API manually:**
```bash
curl -k https://YOUR_PROXMOX_IP:8006/api2/json/nodes
```

**2. Verify firewall allows connections:**
```bash
# On Proxmox server
sudo ufw status
sudo iptables -L
```

**3. Check API token permissions:**
- See [PROXMOX_CONFIGURATION.md](./PROXMOX_CONFIGURATION.md)
- Ensure "Privilege Separation" is enabled
- Grant required permissions

### Issue: No Devices Showing

**1. Verify device scan completed:**
- Green toast notification should appear
- Check backend logs for "Parsed X devices"

**2. Check SSH connection:**
- In Settings, "Test SSH" button
- Should show ✅ Connected or specific error

**3. Without SSH:**
- Mock devices will be shown
- SSH required for real hardware detection

### Issue: Database Errors

**Check MongoDB status:**
```bash
docker logs proxmox-ai-mongodb
```

**Restart MongoDB:**
```bash
docker-compose restart mongodb
```

**Reset database (⚠️ Deletes all data):**
```bash
docker-compose down -v
docker-compose up -d
```

### Getting More Help

**View all logs:**
```bash
# All services
docker-compose logs

# Specific service
docker logs proxmox-ai-backend
docker logs proxmox-ai-frontend

# Follow logs in real-time
docker logs -f proxmox-ai-backend
```

**Restart services:**
```bash
# Restart everything
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

**Complete reset:**
```bash
# Stop and remove everything
docker-compose down

# Start fresh
docker-compose up -d
```

---

## Next Steps

1. ✅ **Explore the Dashboard** - Overview of your environment
2. ✅ **Manage VMs** - Start, stop, restart your VMs
3. ✅ **Scan Hardware** - View all PCI devices
4. ✅ **Use AI Assistant** - Get environment-specific help
5. ✅ **Customize Theme** - Settings → App Appearance
6. ✅ **Review Audit Log** - Track all actions

---

## Production Deployment Tips

### Use Reverse Proxy (Recommended)

**Nginx example:**
```nginx
server {
    listen 80;
    server_name proxmox-admin.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name proxmox-admin.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Secure Your Installation

1. **Use strong passwords**
2. **Enable firewall rules**
3. **Use SSL/TLS in production**
4. **Regular backups of MongoDB**
5. **Monitor logs for suspicious activity**
6. **Keep Docker images updated**

### Backup Data

**Backup MongoDB:**
```bash
docker exec proxmox-ai-mongodb mongodump --out /backup
docker cp proxmox-ai-mongodb:/backup ./mongodb-backup-$(date +%Y%m%d)
```

**Restore MongoDB:**
```bash
docker cp ./mongodb-backup proxmox-ai-mongodb:/backup
docker exec proxmox-ai-mongodb mongorestore /backup
```

---

## Support

For additional help:
1. Check [PROXMOX_CONFIGURATION.md](./PROXMOX_CONFIGURATION.md)
2. Check [AI_CONFIGURATION.md](./AI_CONFIGURATION.md)
3. Review logs: `docker-compose logs`
4. Check Proxmox documentation: https://pve.proxmox.com/pve-docs/

---

**Version 2.0** | Made with ⚡ by Zaibatsui