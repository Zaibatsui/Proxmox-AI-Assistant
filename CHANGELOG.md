# Proxmox AI Assistant - Changelog

## Version 4.0.0 (January 2026)

### Major Changes - VM/LXC Connection Routing

This release fixes the fundamental architecture for accessing VMs and LXC containers. All access is now **proxied through the Proxmox host**, matching how the Proxmox web UI works.

#### Connection Architecture (Breaking Fix)
- **All VM/LXC access routes through Proxmox host** - no direct network access to VMs required
- Works from anywhere (cloud-hosted, different networks, VPNs)
- Uses QEMU Guest Agent (`qm guest exec`) for VM command execution
- Uses `pct exec` for LXC container command execution

#### Terminal Improvements
- **LXC Containers**: Uses `pct enter` for direct shell access
- **VMs**: SSHs from Proxmox host to VM using stored credentials from `location_credentials`
- **Automatic credential lookup**: Terminal finds stored SSH username per VM/LXC
- Clear status messages showing connection method and credentials used

#### AI Assistant Fixes
- AI can now properly execute commands inside VMs and LXCs
- Docker container listing works correctly via `qm guest exec` JSON parsing
- File operations work on selected locations (not just host)

#### Technical Changes
- Rewrote `get_location_ssh_client()` to return wrapper objects for VMs/LXCs
- Added `VMCommandWrapper` and `LXCCommandWrapper` classes that proxy commands
- Fixed `qm guest exec` JSON output parsing (base64 decoding)
- Fixed `execute_command_on_location()` to detect wrapper clients and avoid double-wrapping
- Terminal WebSocket now looks up credentials from `location_credentials` collection
- Removed dead code attempting direct SSH to VM IPs

#### Database Collections Used
- `location_credentials`: Per-VM/LXC SSH credentials (ssh_username, ssh_host, ssh_port)
- `ssh_configs`: Proxmox host SSH credentials
- `proxmox_configs`: Proxmox API configuration

### Upgrade Notes

**From v3.2.0 to v4.0.0:**
1. Update code from GitHub
2. Restart backend and frontend
3. No database migrations required
4. Ensure QEMU Guest Agent is installed in VMs for full functionality

**Requirements for VM Access:**
- QEMU Guest Agent installed and running in VMs
- Guest Agent enabled in Proxmox VM options
- SSH server running in VM (for terminal access)
- Location credentials configured per VM

---

## Version 3.2.0

### Major Features Added

#### Persistent Terminal Sessions
- **WebSocket-Based Terminal**: True persistent shell sessions using WebSocket connections
- **xterm.js Integration**: Professional terminal emulator with full escape sequence support
- **Connection Status Indicators**: Visual feedback for Connected/Connecting/Disconnected states
- **Session Persistence**: Terminal sessions persist across navigation and pane switching

#### Enhanced Connection Management
- **Unified Caching System**: Centralized connection data caching across all components
- **Auto-Refresh**: Connections automatically tested and updated on page load
- **Connection Selector Improvements**: 
  - Instant visual feedback with loading spinners
  - Toast notifications for connection changes
  - Debounced search/filter functionality
  - Refresh button for manual cache updates
- **Status Indicators**: Color-coded badges (green=running, red=stopped/failed)
- **Alphabetical Sorting**: Organized connection lists with running/stopped grouping
- **Collapsible Sections**: Clean UI with expandable groups for better organization

#### Docker Integration Enhancements
- **Global Selector Integration**: Docker containers appear in global connection dropdown
- **Visual Differentiation**: Purple Box icons for Docker containers
- **Container File Browser**: Direct file browsing within Docker containers
- **SSH Credential Management**: Save, edit, and delete SSH credentials for VMs/LXCs

#### Settings Page Overhaul
- **Connections Management Section**: Comprehensive connection overview as first section
- **Real-Time Status**: Auto-test connections on page load with visual status
- **Badge Standardization**: Consistent badge sizes across all sections
- **Header Alignment**: Properly aligned section headers

### UI/UX Improvements
- Immediate visual feedback for all connection operations
- Retry logic with exponential backoff for network operations
- Enhanced error handling with descriptive messages
- Consistent styling and theming throughout
- Delete functionality for connection profiles and action queue items
- "Clear All Completed" bulk action for queue management

### Technical Improvements
- Replaced legacy Terminal component with modern WebSocket implementation
- Implemented centralized ConnectionContext for state management
- Fixed SSH password persistence issues
- Enhanced Docker container listing with better error handling
- Improved credential lookup across multiple config collections
- Optimized API calls with caching and retry mechanisms
- Code cleanup and removal of deprecated components

### Infrastructure
- **Version Bump**: Updated to 3.1.0 across frontend and backend
- **Codebase Cleanup**: Removed all test files, backup files, and junk
- **Clean .gitignore**: Updated to exclude test results and temporary files
- **GitHub Ready**: Prepared for fresh export with minimum junk
- **Documentation Updates**: Updated test_result.md and configuration docs

### Bug Fixes
- Fixed Docker containers not appearing due to SSH credential mismatches
- Resolved SSH password non-persistence in VM/LXC credential updates
- Corrected field name mismatch (password vs ssh_password)
- Fixed duplicate sections and syntax errors in ConnectionSelector
- Resolved cache invalidation issues across components

### Breaking Changes
None - this release is backward compatible with v3.0.0 configurations.

---


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
