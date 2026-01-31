# Proxmox AI Admin Assistant - Product Requirements Document

## Original Problem Statement
Build a comprehensive Proxmox management assistant that provides:
- File browser with dual-pane interface for managing files across Proxmox hosts, VMs, and LXC containers
- Interactive terminal sessions for remote management
- AI-powered assistant for Proxmox administration
- PCI device passthrough management
- Theme customization

### Critical Architecture Requirement
**All VM/LXC access must be proxied through the Proxmox host connection.**
- The application may not be on the same local network as VMs/LXCs
- Direct SSH to VM internal IPs (e.g., 192.168.x.x) will fail from cloud-hosted environments
- Must use Proxmox CLI tools (`pct enter`, `qm terminal`, `pct exec`, `qm guest exec`) from the host

## Current Version
4.0.0

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn UI
- **Backend**: FastAPI, Python, Paramiko (SSH)
- **Database**: MongoDB
- **Proxmox Integration**: Proxmoxer library, SSH via Paramiko
- **AI**: OpenAI (via Emergent LLM Key)

## Core Features

### Implemented
- [x] User authentication (JWT)
- [x] Proxmox API configuration
- [x] SSH configuration management
- [x] Dual-pane file browser
- [x] File operations (list, read, write, delete, rename)
- [x] Interactive terminal via WebSocket
- [x] PCI device scanner
- [x] AI assistant with conversation history
- [x] Theme customization (multiple themes, backgrounds, card styles)
- [x] Docker container browsing within VMs/LXCs
- [x] Health check endpoints

### In Progress
- [ ] **P0: Connection routing via Proxmox host proxy** - FIXED in v3.2.0
  - Terminal now uses `pct enter <ctid>` for LXCs via Proxmox host
  - Terminal now uses `qm terminal <vmid>` for VMs via Proxmox host
  - File operations use wrapper classes that execute via `pct exec`/`qm guest exec`

### Pending/Backlog
- [ ] P1: Restore xterm.js terminal (replace SimpleTerminal)
- [ ] P2: Backup/restore UI
- [ ] P3: Chunked file upload/download improvements

## Key API Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/proxmox-locations` - List available VMs/LXCs/host
- `POST /api/files/list` - List files (with location context)
- `POST /api/files/read` - Read file content
- `POST /api/files/write` - Write file content
- `WS /api/terminal/ws` - WebSocket terminal session
- `POST /api/ai/query` - AI assistant queries

## Architecture Notes

### Connection Proxy Pattern
```
User Browser → App Backend → Proxmox Host SSH → pct/qm commands → VM/LXC
```

For terminals:
- LXC: SSH to host → `pct enter <ctid>` → interactive shell
- VM: SSH to host → `qm terminal <vmid>` → serial console (or qm guest exec)

For file operations:
- LXC: SSH to host → `pct exec <ctid> -- <command>`
- VM: SSH to host → `qm guest exec <vmid> -- <command>` (requires QEMU guest agent)

### Key Files
- `/app/backend/server.py` - Main backend with all endpoints
- `/app/frontend/src/pages/FileBrowserNew.js` - Dual-pane file browser
- `/app/frontend/src/components/TerminalWebSocket.js` - Terminal component
- `/app/frontend/src/components/ConnectionManager.js` - Connection selection

## Recent Changes (v3.2.0)
- **FIXED**: Connection routing - all VM/LXC access now proxied through Proxmox host
- Removed dead code attempting direct SSH to VM IPs
- Simplified `exec_in_location` to use wrapper classes
- Terminal WebSocket now connects to host and runs `pct enter`/`qm terminal`
- Updated `get_location_ssh_client` to return wrapper objects for VMs/LXCs

## Known Limitations
- VM terminal requires serial console setup OR qemu-guest-agent
- For VMs without guest agent, file operations won't work
- xterm.js temporarily replaced with SimpleTerminal due to rendering issues

## Testing Notes
- Backend testing must be done by user (agent cannot reach user's Proxmox server)
- User should test: selecting a VM/LXC, opening terminal, verifying commands execute in correct context
