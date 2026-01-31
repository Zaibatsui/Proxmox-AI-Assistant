# Proxmox AI Admin v4.0.0

<div align="center">
  <h3>AI-Powered Proxmox Management Assistant</h3>
  <p>Intelligent VM/LXC management, file browsing, terminal access, and Docker container monitoring</p>
</div>

---

## What's New in v4.0.0

### VM/LXC Connection Routing (Major Fix)
- **All VM and LXC access now routes through the Proxmox host** - works exactly like the Proxmox web UI
- No need to be on the same local network as your VMs
- Uses QEMU Guest Agent for VMs and `pct exec` for LXC containers

### Interactive Terminal
- **Full terminal access** to VMs and LXC containers
- LXC: Uses `pct enter` for direct shell access
- VMs: SSHs from Proxmox host to VM using stored credentials
- Automatic credential lookup from location settings

### AI Assistant Improvements
- AI can now execute commands directly inside VMs/LXCs
- Docker container listing and management within VMs
- File operations work correctly on selected locations

---

## Features

### AI Assistant with Environment Awareness
- **Real-time Proxmox integration** - AI knows your actual environment
- **Function calling** - Queries your VMs, hardware, and node status
- **Execute commands** inside VMs and LXC containers via QEMU Guest Agent
- **Smart recommendations** - GPU passthrough, driver binding, configuration

### Dual-Pane File Browser
- Browse files on **Proxmox host, VMs, and LXC containers**
- File operations: view, edit, create, delete, rename
- Works through Proxmox host connection (no direct VM network access needed)

### Interactive Terminal
- **LXC Containers**: Direct shell via `pct enter`
- **VMs**: SSH from Proxmox host using stored credentials
- **Host**: Direct SSH to Proxmox host
- Automatic credential lookup per VM/LXC

### Docker Container Monitoring
- View Docker containers running inside VMs
- Container status, images, and details
- Works via QEMU Guest Agent

### VM & Container Management
- View all VMs and containers across nodes
- **Start, Stop, Restart, Force Stop** controls
- Filter by node in multi-node setups
- Organized by running/stopped status

### Hardware Device Scanner
- Detect all PCI devices (GPUs, storage, network, USB)
- View drivers and IOMMU groups
- Filter by device type and driver status

### Customizable Interface
- Multiple themes with dark mode support
- Customizable colors, backgrounds, and card styles
- Responsive design

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  FastAPI Backend │────▶│  Proxmox Host   │
│    (React)      │     │    (Python)      │     │     (SSH)       │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                    ┌─────────────────────┼─────────────────────┐
                                    │                     │                     │
                                    ▼                     ▼                     ▼
                              ┌──────────┐         ┌──────────┐         ┌──────────┐
                              │   LXC    │         │    VM    │         │    VM    │
                              │ pct exec │         │ qm guest │         │   SSH    │
                              └──────────┘         │   exec   │         └──────────┘
                                                   └──────────┘
```

**Key Concept**: All VM/LXC access is **proxied through the Proxmox host**. This means:
- No direct network access to VMs required
- Works from anywhere (cloud-hosted, different networks)
- Same approach as Proxmox web UI

---

## Prerequisites

- **Proxmox VE 7.0+** with API access
- **SSH access** to Proxmox host
- **QEMU Guest Agent** installed in VMs (for file/command operations)
- Docker & Docker Compose (for self-hosting)
- MongoDB

### QEMU Guest Agent Installation (for VMs)

```bash
# Debian/Ubuntu
apt install qemu-guest-agent
systemctl enable --now qemu-guest-agent

# RHEL/CentOS  
yum install qemu-guest-agent
systemctl enable --now qemu-guest-agent
```

Then enable in Proxmox: **VM → Options → QEMU Guest Agent → Enable**

---

## Quick Start

### Environment Variables

**Backend (.env)**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=proxmox_ai_admin
JWT_SECRET=your-secret-key
OPENAI_API_KEY=your-openai-key
```

**Frontend (.env)**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Running with Docker Compose

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongo:27017
      - DB_NAME=proxmox_ai_admin
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://localhost:8001

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

```bash
docker-compose up -d
```

---

## Configuration

### 1. Proxmox API Setup

1. Create API token in Proxmox: **Datacenter → Permissions → API Tokens**
2. Grant appropriate permissions (VM.Audit, VM.PowerMgmt, Sys.Audit)
3. Add configuration in app: **Settings → Proxmox Configuration**

### 2. SSH Configuration

1. Add Proxmox host SSH credentials: **Settings → SSH Configuration**
2. For VM terminal access, add VM credentials: **Settings → Location Credentials**

### 3. Location Credentials (for VMs)

Store SSH credentials per VM for terminal access:
- **Location Type**: vm
- **Location ID**: VM ID (e.g., 119)
- **SSH Username**: User to SSH as
- **SSH Password**: Password for SSH

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User authentication |
| `/api/auth/register` | POST | User registration |
| `/api/proxmox-locations` | GET | List VMs/LXCs/host |
| `/api/files/list` | POST | List files at location |
| `/api/files/read` | POST | Read file content |
| `/api/files/write` | POST | Write file content |
| `/api/terminal/ws` | WS | Terminal WebSocket |
| `/api/ai/query` | POST | AI assistant queries |
| `/api/docker/containers` | POST | List Docker containers |

---

## Changelog

### v4.0.0 (January 2026)
- **Major**: Fixed VM/LXC connection routing - all access now proxied through Proxmox host
- **Major**: Terminal now properly connects to VMs via SSH from host
- **Major**: AI assistant can execute commands inside VMs/LXCs
- Fixed Docker container listing for VMs using qm guest exec JSON parsing
- Added automatic credential lookup for VM terminal sessions
- LXC terminal uses `pct enter` for direct access

### v3.2.0
- Version bump and code cleanup
- Terminal workarounds for xterm.js issues
- Device scanner fixes

### v3.1.0
- Added file browser with dual-pane interface
- Docker container monitoring
- Theme customization

---

## Troubleshooting

### VM commands not working
- Ensure QEMU Guest Agent is installed and running in the VM
- Enable Guest Agent in Proxmox VM options
- Check: `qm agent <vmid> ping`

### Terminal shows Proxmox host instead of VM
- Verify location credentials are set for the VM
- Check that Guest Agent can provide VM IP: `qm agent <vmid> network-get-interfaces`

### LXC access issues
- LXC containers don't need Guest Agent
- Uses `pct exec` directly - should work for all running containers

---

## License

MIT License

---

## Contributing

Contributions welcome! Please submit issues and pull requests on GitHub.
