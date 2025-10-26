# Proxmox AI Assistant - Version 3.0.0

## Release Notes - v3.0.0

### Major Features Added

#### Docker Container Management
- **Container Listing with Fallback**: Dual-method container listing using Portainer Agent API with automatic fallback to direct Docker commands via SSH
- **File Browser for Containers**: Browse, read, and manage files inside Docker containers
- **Container Terminal**: Execute commands inside containers with integrated terminal view
- **"View Containers" Button**: Quick access to Docker containers from file browser

#### AI Assistant Container Access
- **AI Container File Operations**: AI can now list, read, and propose edits to files inside Docker containers
- **AI Container Commands**: AI can propose and execute commands inside containers with confirmation workflow
- **Risk Assessment**: Automatic risk evaluation for container operations (low/medium/high/critical)
- **Confirmation Workflow**: User approval required for destructive or high-risk operations

#### Enhanced File Browser
- **Dual-Pane Interface**: Side-by-side file browsing with left/right pane navigation
- **Terminal Toggle**: Switch between file browser and terminal modes in right pane
- **Expandable Panes**: Resize panes for better viewing
- **Multiple Connection Types**: Support for SSH, SFTP, FTP, Reverse Proxy, Proxmox Host, VMs, LXC containers, and Docker containers
- **Editable Path Bar**: Manually enter file paths with "Go" button
- **Guest Agent Warnings**: Visual indicators when guest agent is missing

#### Configuration Improvements
- **Separated Configs**: Distinct Proxmox API and SSH configuration sections
- **SSH Configuration Test**: Test SSH credentials before saving
- **Validation Fixes**: Improved validation for API token updates (no longer requires re-entering secrets)
- **Advanced Appearance**: Custom color schemes, layout density, border radius, shadow intensity, sidebar width

#### Connection Management
- **Global Connection Context**: Unified connection state across all pages
- **Connection Profiles**: Save and manage multiple connection profiles (SSH, SFTP, FTP, Reverse Proxy)
- **Connection Selector**: Global dropdown for switching between connections

### Technical Improvements
- Enhanced SSH client management for LXC containers with direct connection support
- Improved error handling and logging throughout the application
- MongoDB ObjectId serialization fixes
- Optimized API calls for better performance
- Fixed frontend URL prefixing issues (/api prefix)

### Infrastructure
- Clean deployment-ready codebase
- All test files removed
- Version bumped to 3.0.0 (frontend and backend)
- Clean test_result.md for new testing cycles

### Known Limitations
- SSH port 22 access may be restricted from container environment (network policy)
- Port 8006 (Proxmox API) is accessible and recommended for primary operations
- Docker container access requires SSH connectivity to work properly

### Breaking Changes
None - this release is backward compatible with existing configurations.

---

**Note**: For local testing and deployment, ensure SSH access is available on your network. The application supports both Portainer Agent and direct Docker socket access methods.
