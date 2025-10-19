# Proxmox Configuration Guide

This guide will help you configure Proxmox VE API access and SSH connectivity for the Proxmox AI Admin application.

## Table of Contents

1. [Overview](#overview)
2. [API Token Setup](#api-token-setup)
3. [Privilege Separation](#privilege-separation)
4. [Required Permissions](#required-permissions)
5. [SSH Configuration](#ssh-configuration)
6. [Testing Configuration](#testing-configuration)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Proxmox AI Admin requires two types of access to your Proxmox environment:

1. **API Access** (Required)
   - Used for: VM/CT management, status queries, system information
   - Method: API Token authentication
   - Port: 8006 (default) or 443 (with reverse proxy)

2. **SSH Access** (Optional but Recommended)
   - Used for: Hardware device scanning (GPUs, USB, NVMe)
   - Method: SSH with password or key-based authentication
   - Port: 22 (default)

---

## API Token Setup

### Step 1: Access Proxmox Web Interface

1. Open your Proxmox web interface: `https://your-proxmox-ip:8006`
2. Log in with root or admin credentials
3. Navigate to **Datacenter** → **Permissions** → **API Tokens**

### Step 2: Create API Token

1. Click **"Add"** button
2. Configure the token:
   - **User:** Select your user (e.g., `root@pam`)
   - **Token ID:** Give it a meaningful name (e.g., `ai-admin`)
   - **Privilege Separation:** **✅ ENABLE THIS** (Very Important!)
   - **Expire:** Never (or set expiration as needed)
   - **Comment:** "Proxmox AI Admin API access"

3. Click **"Add"**
4. **⚠️ IMPORTANT:** Copy both values immediately:
   - **Token ID:** Will look like `root@pam!ai-admin`
   - **Secret:** A long alphanumeric string (shown only once!)

**Example:**
```
Token ID: root@pam!ai-admin
Secret: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Step 3: Store Your Credentials

Save these values securely - you'll need them for the application configuration.

---

## Privilege Separation

**Why is Privilege Separation Important?**

When you enable "Privilege Separation" during token creation, the API token gets its own set of permissions separate from the user account. This is a security best practice and **required** for the token to work properly.

### Verify Privilege Separation is Enabled

1. Go to **Datacenter** → **Permissions** → **API Tokens**
2. Find your token (e.g., `root@pam!ai-admin`)
3. Check the **"Privilege Separation"** column - should show **"Yes"**

**If it shows "No":**
1. Delete the token
2. Create a new one with Privilege Separation enabled

---

## Required Permissions

After creating the token with Privilege Separation enabled, you must grant it the necessary permissions.

### Method 1: Grant Full Access (Easiest)

**⚠️ Use only in trusted environments**

1. Navigate to **Datacenter** → **Permissions**
2. Click **"Add"** → **"API Token Permission"**
3. Configure:
   - **Path:** `/` (root path - grants access to everything)
   - **API Token:** Select your token (e.g., `root@pam!ai-admin`)
   - **Role:** `Administrator`
   - **Propagate:** ✅ Checked
4. Click **"Add"**

### Method 2: Grant Minimal Required Permissions (Recommended)

For better security, grant only the permissions needed:

**For VM/CT Management:**

1. **Path:** `/`
   - **Role:** `PVEAuditor`
   - **Propagate:** ✅ Checked
   
2. **Path:** `/vms/*` (or specific VM IDs)
   - **Role:** `PVEVMAdmin`
   - **Propagate:** ✅ Checked

**Specific Permissions Required:**
- **VM.Audit** - View VM/CT configuration
- **VM.Monitor** - Access VM/CT status
- **VM.PowerMgmt** - Start, stop, restart VMs/CTs
- **Datastore.Audit** - View storage information
- **Sys.Audit** - View node information

### Verify Permissions

1. Go to **Datacenter** → **Permissions**
2. Look for entries with your API token
3. Ensure paths and roles are correct

**Example Permission Setup:**
```
Path: /
API Token: root@pam!ai-admin
Role: Administrator
Propagate: Yes
```

---

## SSH Configuration

SSH access is optional but recommended for hardware device scanning.

### Option 1: Password-Based Authentication (Easier)

**Step 1: Ensure SSH is enabled on Proxmox**

```bash
# On your Proxmox host
systemctl status ssh
```

If not running:
```bash
systemctl enable ssh
systemctl start ssh
```

**Step 2: Configure in Application**

In the **Settings** page:
1. Navigate to **"SSH Configuration"** section
2. Enter:
   - **SSH Username:** `root` (or another user with sudo access)
   - **SSH Password:** Your password
3. Click **"Save SSH Config"**
4. Click **"Test SSH"** to verify

### Option 2: Key-Based Authentication (More Secure)

**Step 1: Generate SSH key pair** (on the machine running Proxmox AI Admin)

```bash
# Generate key without passphrase
ssh-keygen -t rsa -b 4096 -f ~/.ssh/proxmox_ai_key -N ""
```

**Step 2: Copy public key to Proxmox**

```bash
# Copy to Proxmox
ssh-copy-id -i ~/.ssh/proxmox_ai_key.pub root@your-proxmox-ip

# Or manually:
cat ~/.ssh/proxmox_ai_key.pub | ssh root@your-proxmox-ip "cat >> ~/.ssh/authorized_keys"
```

**Step 3: Test SSH connection**

```bash
ssh -i ~/.ssh/proxmox_ai_key root@your-proxmox-ip
```

**Step 4: Configure in Application**

Currently, the application supports password authentication primarily. For key-based authentication:
1. Set up SSH agent on the Docker host
2. Or use password authentication as a simpler alternative

---

## Testing Configuration

### Test API Connection

**In the Application:**

1. Go to **Settings** page
2. **Proxmox API Configuration** section should show:
   - **Host:** `https://your-proxmox-ip:8006` (or without https if testing locally)
   - **API Token ID:** `root@pam!ai-admin`
   - **API Token Secret:** `your-secret-here`
   - **Verify SSL:** Unchecked (for self-signed certificates)
3. Click **"Test API"**
4. Should show: ✅ **"API Connection Successful! Connected to X nodes"**

**Manual Testing:**

```bash
# Test from command line
curl -k -H "Authorization: PVEAPIToken=root@pam!ai-admin=YOUR_SECRET" \
  https://your-proxmox-ip:8006/api2/json/nodes

# Should return JSON with node information
```

### Test SSH Connection

**In the Application:**

1. Go to **Settings** page
2. **SSH Configuration** section should show:
   - **SSH Username:** `root`
   - **SSH Password:** `your-password`
3. Click **"Test SSH"**
4. Should show: ✅ **"SSH connection test successful!"**

**Manual Testing:**

```bash
# Test SSH connection
ssh root@your-proxmox-ip

# Test command that scans devices
ssh root@your-proxmox-ip "lspci -vmm"
```

### Full Integration Test

1. **Navigate to "VM & Container Management"**
   - Click **"Load VMs & Containers"**
   - Should display all your VMs and containers
   - Try starting/stopping a VM

2. **Navigate to "Device Scanner"**
   - Click **"Scan Devices"**
   - Should display hardware devices (GPUs, USB, NVMe)
   - With SSH: Shows real devices
   - Without SSH: Shows sample/mock devices

3. **Navigate to "AI Assistant"**
   - Ask: "What VMs do I have running?"
   - AI should respond with actual VM information
   - Ask: "Show me my hardware devices"
   - AI should list detected devices

---

## Troubleshooting

### Issue: "API Connection Failed" / Authorization Error

**Symptoms:**
- Red error message when testing API
- "401 Unauthorized" or "403 Forbidden"

**Solutions:**

1. **Verify Privilege Separation is enabled:**
   ```
   Datacenter → Permissions → API Tokens
   Check "Privilege Separation" column shows "Yes"
   ```

2. **Check permissions are granted:**
   ```
   Datacenter → Permissions
   Look for entries with your API token
   Ensure "/" path has Administrator role
   ```

3. **Verify token format:**
   ```
   Token ID should be: username@realm!tokenname
   Example: root@pam!ai-admin
   NOT: root@pam or just ai-admin
   ```

4. **Check secret is correct:**
   - Secret is case-sensitive
   - No extra spaces or characters
   - If lost, create a new token

5. **Test with curl:**
   ```bash
   curl -k -H "Authorization: PVEAPIToken=root@pam!ai-admin=YOUR_SECRET" \
     https://your-proxmox-ip:8006/api2/json/nodes
   ```

### Issue: SSL Certificate Error

**Symptoms:**
- "SSL certificate verify failed"
- "Certificate validation error"

**Solutions:**

1. **In Settings, uncheck "Verify SSL"**
   - This is safe for self-signed certificates in private networks

2. **Or use HTTP instead of HTTPS (less secure):**
   - Host: `http://your-proxmox-ip:8006`
   - Only for testing/development

3. **Or install proper SSL certificate on Proxmox**

### Issue: SSH Connection Failed

**Symptoms:**
- "SSH connection test failed"
- "Authentication failed"
- Timeout errors

**Solutions:**

1. **Verify SSH is running on Proxmox:**
   ```bash
   # On Proxmox host
   systemctl status ssh
   ```

2. **Check firewall allows SSH:**
   ```bash
   # On Proxmox host
   ufw status
   iptables -L | grep ssh
   ```

3. **Test SSH manually:**
   ```bash
   # From Docker host
   ssh root@your-proxmox-ip
   ```

4. **Check password is correct:**
   - Passwords are case-sensitive
   - No extra spaces

5. **Verify user has sufficient privileges:**
   - User should be `root` or have sudo access
   - Required for `lspci`, `lsusb` commands

### Issue: Device Scanner Shows No Devices

**Symptoms:**
- Device scanner returns empty lists
- Only shows mock/sample data

**Solutions:**

1. **Verify SSH connection is working:**
   - Go to Settings
   - Test SSH connection
   - Must show ✅ Connected

2. **Check backend logs for errors:**
   ```bash
   docker logs proxmox-ai-backend | grep -i "ssh\|device\|scan"
   ```

3. **Manually test device scan commands:**
   ```bash
   # SSH into Proxmox
   ssh root@your-proxmox-ip
   
   # Test commands
   lspci -vmm
   lsusb
   nvme list
   ```

4. **Without SSH:**
   - App will show sample devices
   - This is expected behavior
   - Configure SSH for real device detection

### Issue: API Token Permissions Error

**Symptoms:**
- Can see VMs but can't start/stop them
- "Permission denied" errors in logs
- Some features work, others don't

**Solutions:**

1. **Re-check permissions:**
   ```
   Datacenter → Permissions
   Path: /
   Role: Administrator
   API Token: your-token
   Propagate: Yes
   ```

2. **Or grant specific VM permissions:**
   ```
   Datacenter → Permissions → Add → API Token Permission
   Path: /vms/100 (or /vms/* for all VMs)
   Role: PVEVMAdmin
   API Token: your-token
   ```

3. **Verify token is correct:**
   - Delete and recreate if necessary
   - Remember to enable Privilege Separation
   - Grant permissions after creation

### Issue: Different Port Numbers

**Proxmox uses custom ports:**

**Default ports:**
- API: `8006`
- API with SSL: `443` (if configured)
- SSH: `22`

**If using custom ports:**
- API Host: `https://proxmox-ip:CUSTOM_PORT`
- SSH Port: Specify in SSH configuration (if supported)

### Need More Help?

**Check logs:**
```bash
# Backend logs (shows API/SSH errors)
docker logs proxmox-ai-backend

# All logs
docker-compose logs
```

**Verify configuration:**
```bash
# Check environment variables
docker exec proxmox-ai-backend env | grep -i proxmox
```

**Reset configuration:**
1. Clear settings in application
2. Re-enter all values
3. Test each connection individually

---

## Security Best Practices

1. **Use Privilege Separation:** Always enable when creating tokens
2. **Minimal Permissions:** Grant only required permissions
3. **Secure Passwords:** Use strong passwords for SSH
4. **Key-Based SSH:** Prefer SSH keys over passwords
5. **SSL Verification:** Enable in production with proper certificates
6. **Regular Audits:** Review API token usage in audit logs
7. **Token Rotation:** Periodically regenerate API tokens
8. **Network Security:** Restrict access to Proxmox ports via firewall

---

## Quick Reference

### API Token Format
```
Token ID: username@realm!tokenname
Example: root@pam!ai-admin

Secret: alphanumeric string
Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Minimum Permission Setup
```
Path: /
API Token: root@pam!ai-admin
Role: Administrator
Propagate: Yes
```

### Test Commands
```bash
# Test API
curl -k -H "Authorization: PVEAPIToken=USER@REALM!TOKEN=SECRET" \
  https://PROXMOX-IP:8006/api2/json/nodes

# Test SSH
ssh root@PROXMOX-IP "lspci -vmm"
```

---

**Version 2.0** | Last Updated: January 2025
