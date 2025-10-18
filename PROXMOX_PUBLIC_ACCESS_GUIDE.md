# Proxmox Public Access Configuration Guide

## Understanding the Issue

Your Proxmox server `proxmox.zaibatsui.co.uk` is accessible publicly, but there's a port configuration issue:

### Current Setup:
- **Public URL:** `https://proxmox.zaibatsui.co.uk/` (accessible on port 443)
- **Standard Proxmox Port:** 8006 (NOT accessible publicly - times out)
- **SSH Port:** 22 (may not be exposed publicly)

### What's Happening:
Your Proxmox is behind a reverse proxy that:
- ✅ Forwards HTTPS traffic from port 443 to internal port 8006
- ❌ Does NOT expose port 8006 directly
- ❌ May not expose SSH port 22

## Solution Options

### Option 1: Use Port 443 (Recommended for Public Access)

**Configure in the App:**
```
Proxmox Host: https://proxmox.zaibatsui.co.uk
```
**Important:** Do NOT add `:8006` at the end

The app will automatically use port 8006, but since your public instance uses port 443, you need to tell the app explicitly.

**Steps:**
1. Go to Settings
2. **Proxmox Host:** Enter `https://proxmox.zaibatsui.co.uk` (no port)
3. The app will try port 8006 by default
4. If that fails, manually specify: `https://proxmox.zaibatsui.co.uk:443`

### Option 2: Configure Reverse Proxy to Support Port 8006

If you control your reverse proxy (Nginx/Apache/Caddy):

**Nginx Configuration Example:**
```nginx
# Port 8006 passthrough
server {
    listen 8006 ssl;
    server_name proxmox.zaibatsui.co.uk;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass https://internal-proxmox:8006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Firewall:**
```bash
# Allow port 8006
ufw allow 8006/tcp
```

### Option 3: VPN Access (Most Secure)

For production use, consider:
1. **Tailscale/WireGuard:** Create a VPN to your network
2. Access Proxmox via private IP: `192.168.1.218:8006`
3. Full access to all services (SSH, API, etc.)

## SSH Access for Device Scanning

Device scanning requires SSH access to run `lspci` commands. Options:

### Option 1: Expose SSH Port (Security Risk)
```bash
# On your firewall/router
# Forward external port (e.g., 2222) to internal port 22

# In the app
SSH Username: root
SSH Password: your-password
```

⚠️ **Security Warning:** Exposing SSH to the internet is risky. Use strong passwords and consider:
- Fail2ban
- SSH key authentication only
- Non-standard port
- IP whitelisting

### Option 2: API-Only Mode (No Device Scanning)
- Use the app without SSH access
- Device scanner will show mock data
- VM management will still work via API
- AI assistant will still function

### Option 3: SSH Tunnel
```bash
# Create SSH tunnel on local machine
ssh -L 2222:localhost:22 your-jumphost

# In the app
SSH Host: localhost:2222
```

## Recommended Production Setup

```
┌─────────────────┐
│  Internet       │
└────────┬────────┘
         │
    Port 443 (HTTPS)
    Port 2222 (SSH - optional)
         │
┌────────▼────────┐
│  Reverse Proxy  │
│  (Nginx/Caddy)  │
└────────┬────────┘
         │
    ├─ Port 443 → 8006 (Proxmox API)
    └─ Port 2222 → 22 (SSH)
         │
┌────────▼────────┐
│  Proxmox Server │
│  192.168.1.218  │
└─────────────────┘
```

## Testing Your Configuration

### Test 1: API Connection
```bash
# Should return 401 (needs auth)
curl -k https://proxmox.zaibatsui.co.uk/api2/json/nodes

# With port 8006 (will timeout if not exposed)
curl -k https://proxmox.zaibatsui.co.uk:8006/api2/json/nodes
```

### Test 2: SSH Connection
```bash
# Test SSH access
ssh root@proxmox.zaibatsui.co.uk

# If using custom port
ssh -p 2222 root@proxmox.zaibatsui.co.uk
```

## App Configuration Examples

### Example 1: Port 443 (Current Public Setup)
```
Proxmox Host: https://proxmox.zaibatsui.co.uk
API Token Name: root@pam!ProxmoxAI
API Token Secret: xxxxxx
Verify SSL: ✓ (if you have valid cert)
SSH Username: root
SSH Password: (leave empty if SSH not accessible)
```

### Example 2: Custom SSH Port
```
Proxmox Host: https://proxmox.zaibatsui.co.uk
SSH Username: root
SSH Password: your-password

# Note: App assumes SSH is on standard port 22
# If using custom port, you may need SSH tunnel
```

### Example 3: Local Network Access
```
Proxmox Host: https://192.168.1.218:8006
API Token Name: root@pam!ProxmoxAI
API Token Secret: xxxxxx
Verify SSL: ✗ (self-signed cert)
SSH Username: root
SSH Password: your-password
```

## Troubleshooting

### Error: "Connection timed out"
- **Cause:** Port is not accessible
- **Fix:** Use port 443 or configure firewall/proxy

### Error: "Connection refused"
- **Cause:** Service not running or wrong port
- **Fix:** Verify Proxmox is running, check port number

### Error: "SSL certificate verify failed"
- **Cause:** Self-signed certificate
- **Fix:** Disable "Verify SSL" in settings

### Error: "Authentication failed"
- **Cause:** Wrong credentials
- **Fix:** Verify API token in Proxmox web interface

### SSH Times Out
- **Cause:** SSH port not accessible publicly
- **Fix:** 
  - Use VPN
  - Configure SSH forwarding
  - Or accept mock device data (API-only mode)

## Security Best Practices

1. **Never expose SSH directly to internet**
   - Use VPN or SSH keys only
   - Implement fail2ban
   - Use non-standard ports

2. **API Token Permissions**
   - Create tokens with minimal required permissions
   - Separate tokens for different purposes

3. **SSL/TLS**
   - Always use valid SSL certificates in production
   - Keep certificates updated

4. **Firewall Rules**
   - Only expose necessary ports
   - Implement IP whitelisting when possible

5. **Monitoring**
   - Monitor failed login attempts
   - Set up alerts for suspicious activity

## Need Help?

Check the app's "Test Connection" feature to see exactly what's failing:
- ✅ Green checkmark = Working
- ❌ Red X = Connection failed (check port/firewall)
- ⚠️ Orange ! = Authentication failed (check credentials)
