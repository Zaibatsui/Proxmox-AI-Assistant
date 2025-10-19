# Proxmox AI Admin v2.0

<div align="center">
  <h3>🤖 AI-Powered Proxmox Management Assistant</h3>
  <p>Intelligent hardware passthrough, VM management, and environment monitoring</p>
</div>

## 🌟 Features

### 🤖 AI Assistant with Environment Awareness
- **Real-time Proxmox integration** - AI knows your actual environment
- **Function calling** - Queries your VMs, hardware, and node status
- **Smart recommendations** - GPU passthrough, driver binding, configuration
- **Executable actions** - AI can generate commands for you to execute

### 💻 VM & Container Management
- View all VMs and containers across nodes
- **Start, Stop, Restart, Force Stop** controls
- Organized by running/stopped status
- Alphabetically sorted for easy navigation
- Filter by node in multi-node setups

### 🔧 Hardware Device Scanner
- Detect all PCI devices (GPUs, storage, network, USB)
- View drivers and IOMMU groups
- Filter by device type and driver status
- Organized categories (GPUs, Storage, Network, USB, Other)

### 📊 Monitoring & Audit
- Action queue for staged operations
- Comprehensive audit log of all actions
- Real-time status updates

### 🎨 Customizable Interface
- Dark theme optimized
- Color customization (background, cards, borders, text)
- Collapsible sections for better organization
- Responsive design

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Proxmox VE 7.0+ with API access
- SSH access to Proxmox host (for device scanning)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd Proxmox-AI-Assistant
```

2. **Configure environment**
```bash
# Edit docker-compose.yml
# Update REACT_APP_BACKEND_URL to your server IP
REACT_APP_BACKEND_URL=http://YOUR_IP:8001
```

3. **Start services**
```bash
docker-compose up -d
```

4. **Access the application**
```
http://localhost:3000
```

5. **Create an account**
- Click "Create Account" on login page
- Enter credentials
- Login

---

## 📖 Setup Guides

### Essential Setup (Required)
1. **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete installation and configuration
2. **[PROXMOX_CONFIGURATION.md](./PROXMOX_CONFIGURATION.md)** - Proxmox API token and SSH setup

### Optional Setup
3. **[AI_CONFIGURATION.md](./AI_CONFIGURATION.md)** - OpenAI API key for AI assistant

---

## 🔧 Architecture

```
┌─────────────────────────────────────┐
│         React Frontend              │
│    (Port 3000 - User Interface)     │
└──────────────┬──────────────────────┘
               │ HTTP/REST API
               ▼
┌─────────────────────────────────────┐
│        FastAPI Backend              │
│  (Port 8001 - Business Logic)       │
└─────┬──────────────────────┬────────┘
      │                      │
      ▼                      ▼
┌──────────────┐      ┌─────────────────┐
│   MongoDB    │      │  Proxmox Server │
│  (Database)  │      │  (API + SSH)    │
└──────────────┘      └─────────────────┘
```

---

## 🛠️ Technology Stack

**Frontend:**
- React 19
- Tailwind CSS
- Shadcn UI Components
- Axios for API calls

**Backend:**
- FastAPI (Python)
- Motor (Async MongoDB)
- Proxmoxer (Proxmox API)
- Paramiko (SSH)
- OpenAI API

**Database:**
- MongoDB 4.4

**Deployment:**
- Docker & Docker Compose

---

## 📁 Project Structure

```
/app/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── requirements.txt   # Python dependencies
│   ├── Dockerfile
│   └── .env              # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── pages/        # React pages (Dashboard, VMs, Devices, AI, etc.)
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # Theme and state management
│   │   └── utils/        # Helper functions
│   ├── public/           # Static assets, favicon
│   ├── package.json
│   ├── Dockerfile
│   └── .env              # Frontend environment variables
├── docker-compose.yml     # Docker orchestration
├── README.md             # This file
├── SETUP_GUIDE.md        # Installation guide
├── PROXMOX_CONFIGURATION.md  # Proxmox setup
└── AI_CONFIGURATION.md   # AI assistant setup
```

---

## 🔐 Security Considerations

### API Tokens
- Use separate API tokens for different purposes
- Enable "Privilege Separation" when creating tokens
- Grant minimum required permissions
- Rotate tokens periodically

### SSH Access
- Use SSH keys instead of passwords when possible
- Restrict SSH access to specific IPs if possible
- Use non-standard SSH ports for internet-facing servers
- Implement fail2ban for brute-force protection

### Network Security
- Run behind reverse proxy with SSL/TLS in production
- Use firewall rules to restrict access
- Don't expose SSH or API ports unnecessarily
- Consider VPN for remote access

### Data Protection
- API tokens stored encrypted in MongoDB
- Passwords hashed with bcrypt
- JWT tokens for session management
- Audit log tracks all actions

---

## 🎯 Usage Examples

### AI Assistant Queries

**Environment Overview:**
```
"What's the status of my Proxmox environment?"
```
AI queries your nodes, VMs, and provides summary.

**Hardware Information:**
```
"Show me all my GPUs"
"List my storage devices"
```
AI scans your hardware and provides detailed info.

**VM Management:**
```
"Tell me about VM 101"
"Which VMs are using GPU passthrough?"
```
AI retrieves specific VM configurations.

**Guided Setup:**
```
"How do I passthrough my GPU to Windows VM?"
```
AI provides step-by-step instructions based on YOUR hardware.

### VM Control

**From VM Management Page:**
- **Start** - Power on stopped VMs
- **Stop** - Graceful shutdown
- **Force Stop** - Immediate shutdown (use when unresponsive)
- **Restart** - Reboot VM

### Device Scanning

1. Go to "Device Scanner" page
2. Click "Scan Devices"
3. View categorized hardware:
   - GPUs
   - Storage (NVMe, SATA)
   - Network controllers
   - USB controllers
   - Other devices
4. Use filters to find specific devices

---

## 🐛 Troubleshooting

### Frontend Issues

**Can't connect to backend:**
```bash
# Check REACT_APP_BACKEND_URL in docker-compose.yml
# Should be: http://YOUR_IP:8001 (not localhost if accessing remotely)
```

**Page not loading:**
```bash
docker logs proxmox-ai-frontend
```

### Backend Issues

**API token errors:**
- Verify "Privilege Separation" is enabled in Proxmox
- Check token has required permissions
- Ensure token hasn't expired

**SSH connection fails:**
- Verify SSH credentials in Settings
- Check SSH port is accessible
- Test SSH manually: `ssh user@host`

**No devices showing:**
- Run a device scan first (Device Scanner page)
- Check SSH connection is working
- Verify scan was successful in backend logs

### Database Issues

**MongoDB connection errors:**
```bash
docker logs proxmox-ai-mongodb
```

### Check Logs

```bash
# All services
docker-compose logs

# Specific service
docker logs proxmox-ai-backend
docker logs proxmox-ai-frontend
docker logs proxmox-ai-mongodb

# Follow logs in real-time
docker logs -f proxmox-ai-backend
```

---

## 📝 Version History

### v2.0 (Current)
- ✅ AI Assistant with environment awareness and function calling
- ✅ VM control buttons (Start, Stop, Force Stop, Restart)
- ✅ Enhanced markdown formatting for AI responses
- ✅ Device scanner with categorization and filters
- ✅ Collapsible sections for VMs and devices
- ✅ Per-user OpenAI API key management
- ✅ Improved theme customization
- ✅ Server icon favicon
- ✅ Comprehensive setup documentation

### v1.0
- Initial release with basic Proxmox integration

---

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Proxmox integration via [Proxmoxer](https://github.com/proxmoxer/proxmoxer)
- AI powered by [OpenAI](https://openai.com/)

---

## 📧 Support

For issues, questions, or feature requests, please check:
1. [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Installation help
2. [PROXMOX_CONFIGURATION.md](./PROXMOX_CONFIGURATION.md) - Proxmox setup
3. Troubleshooting section above

---

<div align="center">
  <p><strong>Made with ⚡ by Zaibatsui</strong></p>
  <p>Version 2.0</p>
</div>