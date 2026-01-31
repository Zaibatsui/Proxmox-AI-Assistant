# Proxmox AI Assistant - Version 3.2.0

## Release Notes - v3.2.0

### Critical Fixes

#### SSH Credential Integration (Complete)
- **File Browser Connection Fix**: Fixed critical bug where File Browser connected to Proxmox host instead of selected VM/LXC
- **AI Assistant Integration**: AI tools now automatically fetch SSH credentials from database for VM/LXC operations
- **Terminal WebSocket Integration**: Terminal connections now fetch credentials from database instead of requiring manual input
- **Global Credential Enrichment**: Created `enrich_location_with_credentials()` function used across all endpoints

#### Terminal Component Replacement
- **SimpleTerminal**: Replaced xterm-based terminal with SimpleTerminal component
- **Zero Dependencies**: No external terminal packages required (xterm, @xterm/addon-fit, etc.)
- **Universal Compatibility**: Works in all environments without build issues
- **Features**: Command history (↑↓), real-time output, WebSocket SSH integration, status indicators

### Major Improvements

**SSH Credential Flow:**
- Credentials saved once in Settings → SSH Configuration
- Automatically used by: File Browser, AI Assistant, Terminal, Container operations
- No repeated credential entry required
- Fetches from `ssh_configs` MongoDB collection

**File Browser:**
- ✅ Correctly connects to selected VM/LXC (not host)
- ✅ Shows actual VM/LXC filesystem
- ✅ File operations execute on correct location
- ✅ Container button lists Docker containers from VM/LXC

**AI Assistant:**
- ✅ Can list files in VMs/LXCs without asking for credentials
- ✅ Can read files from VMs/LXCs
- ✅ Can execute commands (with user confirmation)
- ✅ Enhanced logging for troubleshooting

**Terminal:**
- ✅ Connects to VMs/LXCs automatically
- ✅ Shows correct hostname in prompt
- ✅ Line-based input with command history
- ✅ No build dependencies

### Technical Changes

**Backend (`server.py`):**
- Added global `enrich_location_with_credentials()` function (line 4861)
- Updated `/files/list` endpoint to enrich location credentials
- Updated `/files/read` endpoint to enrich location credentials
- Updated `/files/write` endpoint to enrich location credentials
- Updated `/api/terminal/ws` WebSocket endpoint to fetch credentials
- Enhanced logging throughout SSH connection handling

**Frontend:**
- Replaced `TerminalWebSocket.js` with `SimpleTerminal.js`
- Removed xterm.js dependencies
- Updated version display to 3.2.0

**Database Schema:**
- No changes - uses existing `ssh_configs` collection
- No changes - uses existing `proxmox_configs` collection

### Bug Fixes

- Fixed File Browser connecting to host instead of VM/LXC
- Fixed AI Assistant requiring manual SSH credentials
- Fixed Terminal WebSocket requiring manual credentials
- Fixed Container button not working for VMs/LXCs
- Fixed dimension errors in terminal component
- Fixed build issues with xterm package dependencies

### Removed

- xterm.js and related addons (no longer needed)
- TerminalWebSocket_xterm_backup.js (old implementation)
- Environment variable dependencies (PROXMOX_HOST, PROXMOX_SSH_USER, PROXMOX_SSH_PASSWORD)

### Known Limitations

**SimpleTerminal:**
- Plain text only (no ANSI colors displayed)
- Not suitable for interactive editors (vim, nano)
- No TUI program support (htop, less)
- Line-based input (not character-by-character)

**Workaround:** Use external SSH client for interactive programs requiring full terminal emulation.

### Upgrade Notes

**From v3.1.0 to v3.2.0:**
1. Update code from GitHub
2. Restart backend and frontend
3. No database migrations required
4. Existing SSH configs continue to work
5. Terminal will use new SimpleTerminal automatically

**Breaking Changes:**
- None - fully backward compatible

---


# Proxmox AI Assistant - Version 3.1.0

## Release Notes - v3.1.0

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
