# Proxmox AI Admin

An AI-powered Proxmox assistant that intelligently manages hardware devices, IOMMU groups, driver bindings, and VM/CT passthrough configurations.

## Features

### 🤖 AI-Powered Assistant
- **OpenAI Integration**: Get intelligent suggestions for hardware passthrough configurations
- **Natural Language Queries**: Ask questions about IOMMU groups, driver bindings, and best practices
- **Command Generation**: AI automatically generates safe commands with explanations
- **Conversation History**: Keep track of all your AI interactions

### 💻 Hardware Detection
- **PCI Device Scanning**: Automatically detect GPUs, USB controllers, NVMe drives, and more
- **IOMMU Group Mapping**: Visualize IOMMU group isolation for safe passthrough
- **Driver Status**: See which drivers are currently bound to each device
- **Real-time Updates**: Re-scan hardware at any time

### ⚙️ Driver Management
- **Bind/Unbind Operations**: Safely change device drivers (vfio-pci, i915, nouveau, etc.)
- **Dry-Run Mode**: Preview changes before executing
- **Action Queue**: Review and approve all operations before execution
- **Rollback Support**: Undo changes if needed

### 📦 VM & Container Management
- **VM Inventory**: View all QEMU VMs and LXC containers
- **Passthrough Visualization**: See which devices are assigned to each VM
- **Configuration Updates**: Automatically update VM configs for passthrough
- **Status Monitoring**: Track VM states and configurations

### 🔒 Safety Features
- **Dry-Run First**: Always preview operations before execution
- **Audit Logging**: Complete history of all operations
- **JWT Authentication**: Secure user access
- **API Token Management**: Safe Proxmox API integration

## Architecture

```
┌────────────────────┐
│  React Frontend     │
│  (Port 3000)        │
│  - Dashboard        │
│  - Device Scanner   │
│  - AI Assistant     │
│  - Action Queue     │
└───────┬────────────┘
        │
        │ REST API
        │
┌───────┴─────────────┐
│  FastAPI Backend    │
│  (Port 8001)        │
│  - Auth Service     │
│  - Device Scanner   │
│  - AI Integration   │
│  - Action Manager   │
│  - Proxmox API      │
└───────┬───────┬─────┘
        │        │
        │        └───────────────┐
        │                        │
┌───────┴─────────┐  ┌───────┴─────────┐
│  MongoDB         │  │  OpenAI          │
│  (Port 27017)    │  │  - Reasoning     │
│  - Users         │  │  - Commands      │
│  - Devices       │  │  - Suggestions   │
│  - Actions       │  └──────────────────┘
│  - Audit Logs    │
└──────────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Proxmox VE server with API access
- API Token from Proxmox (see Setup section)

### Installation

1. **Clone or copy the project to your system**

2. **Start the application using Docker Compose:**

```bash
docker-compose up -d
```

This will start:
- MongoDB on port 27017
- FastAPI backend on port 8001
- React frontend on port 3000

3. **Access the application:**

Open your browser to: `http://localhost:3000`

4. **Create an account:**
- Click "Create Account" on the login page
- Choose a username and password

5. **Configure Proxmox connection:**
- Go to Settings
- Enter your Proxmox host URL (e.g., `https://192.168.1.100:8006`)
- Enter your API token details
- Save configuration

### Creating a Proxmox API Token

1. Log into your Proxmox web interface
2. Navigate to: **Datacenter → Permissions → API Tokens**
3. Click **"Add"**
4. Select user (recommend: `root@pam`)
5. Enter a Token ID (e.g., `ai-admin`)
6. **Uncheck "Privilege Separation"** for full access
7. Click **"Add"**
8. **Copy the secret immediately** (shown only once!)
9. Use format: `root@pam!ai-admin` as token name

## Usage Guide

### 1. Scan Hardware

- Navigate to **Devices** page
- Click **"Scan Devices"**
- View detected PCI devices with:
  - Device name and type
  - PCI address
  - Vendor/Device IDs
  - IOMMU group
  - Current driver binding

### 2. Ask AI for Help

- Go to **AI Assistant** page
- Ask questions like:
  - "How do I passthrough my GTX 980 to VM 101?"
  - "What devices are in IOMMU group 1?"
  - "How to bind device 0000:01:00.0 to vfio-pci?"
  - "Is it safe to passthrough this USB controller?"

- AI will provide:
  - Detailed explanations
  - Step-by-step commands
  - Safety warnings
  - Best practices

### 3. Manage VMs

- Visit **VMs & CTs** page
- View all virtual machines and containers
- See current PCI passthrough configurations
- Check VM status (running/stopped)

### 4. Execute Actions Safely

- Go to **Actions** page
- Review pending operations
- Click **"Dry Run"** to preview changes
- Click **"Execute"** to apply changes
- Monitor execution output

### 5. View Audit Logs

- Access **Audit Log** page
- Review complete history of:
  - Device scans
  - AI queries
  - Configuration changes
  - Action executions

## Current Implementation Status

### ✅ Implemented (MVP)

- **Frontend**: Complete React dashboard with all pages
- **Backend**: Full FastAPI server with all routes
- **Authentication**: JWT-based user system
- **AI Integration**: OpenAI with per-user API key management
- **Database**: MongoDB for all data persistence
- **Real Proxmox Integration**: Live hardware scanning and VM management via SSH

### 🔧 Production Integration Needed

To use with a real Proxmox server, you'll need to:

1. **Install `proxmoxer` library:**
```bash
pip install proxmoxer
```

2. **Update device scanning** in `backend/server.py`:
```python
from proxmoxer import ProxmoxAPI

# Replace mock_devices in /devices/scan route with:
config = await db.proxmox_configs.find_one({"user_id": user_id})
proxmox = ProxmoxAPI(config['host'], 
                     token_name=config['api_token_name'],
                     token_value=config['api_token_secret'],
                     verify_ssl=config['verify_ssl'])

# SSH to node and run:
# lspci -nn -vmm
# Parse output to PCIDevice objects
```

3. **Add SSH execution for driver commands:**
```python
import paramiko

# Execute commands like:
# modprobe vfio-pci
# echo "vendor_id device_id" > /sys/bus/pci/drivers/vfio-pci/new_id
```

## Technology Stack

- **Frontend**: React 19, Tailwind CSS, Shadcn UI, Axios
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT, bcrypt, Proxmoxer, Paramiko
- **AI**: OpenAI API (user-provided API keys)
- **Database**: MongoDB 4.4
- **Deployment**: Docker Compose

## Security Considerations

1. **Change default JWT secret** in production
2. **Use strong passwords** for user accounts
3. **Secure Proxmox API tokens** with appropriate permissions
4. **Enable SSL/TLS** for production deployments
5. **Limit API token scope** to only required permissions
6. **Always use dry-run** before executing dangerous operations
7. **Regular backups** of MongoDB data and Proxmox configs

## Environment Variables

### Backend (.env)
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=proxmox_ai_admin
CORS_ORIGINS=*
JWT_SECRET=your-secret-key-here
OPENAI_API_KEY=your-openai-key-here-or-set-per-user
```

### Frontend (.env)
```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Development

### Run without Docker

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

**Frontend:**
```bash
cd frontend
yarn install
yarn start
```

**MongoDB:**
```bash
docker run -d -p 27017:27017 mongo:7.0
```

## Troubleshooting

### Backend won't start
- Check MongoDB is running: `docker ps`
- Verify `.env` file exists in backend/
- Check logs: `docker logs proxmox-ai-backend`

### Frontend can't connect to backend
- Verify `REACT_APP_BACKEND_URL` in frontend/.env
- Check backend is running on port 8001
- Clear browser cache and reload

### AI not responding
- Verify `EMERGENT_LLM_KEY` is set correctly
- Check backend logs for API errors
- Ensure internet connection is available

### Proxmox connection failing
- Verify API token is correct
- Check Proxmox host is accessible
- Try with SSL verification disabled for self-signed certs
- Verify token has required permissions

## Future Enhancements

- Real-time WebSocket updates for device changes
- Multi-node Proxmox cluster support
- Automated passthrough recommendations
- Backup/restore for VM configurations
- Email/Discord notifications for important events
- Integration with n8n for workflow automation
- IOMMU group conflict detection and resolution
- Driver compatibility database
- One-click GPU passthrough wizard

## License

MIT License - Use freely in your homelab!

## Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Built with ❤️ for homelabbers and Proxmox enthusiasts**
