# Proxmox Real Device Scanning Setup

The application now supports **real device scanning** from your Proxmox server! Here's what you need to know:

## How It Works

When you click "Scan Devices", the system will:

1. **Connect to Proxmox API** using your configured token
2. **SSH to your Proxmox node** to run hardware detection commands
3. **Execute `lspci -nnk`** to get all PCI devices
4. **Read IOMMU groups** from `/sys/kernel/iommu_groups/`
5. **Parse and display** all detected hardware

## Setup Requirements

### Option 1: SSH Key Authentication (Recommended)

For real device scanning to work, the container/VM running this app needs SSH access to your Proxmox host.

**Steps:**

1. **Generate SSH key in the container:**
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
   ```

2. **Copy public key to Proxmox host:**
   ```bash
   ssh-copy-id root@YOUR_PROXMOX_IP
   ```
   
   Or manually add the public key to `/root/.ssh/authorized_keys` on your Proxmox host.

3. **Test SSH connection:**
   ```bash
   ssh root@YOUR_PROXMOX_IP "lspci -nnk"
   ```
   
   You should see PCI device list without password prompt.

4. **Scan devices** in the app - it should now show your real hardware!

### Option 2: Running Inside Proxmox (Easiest)

If you're running this app **inside a Proxmox VM or LXC container**, you can:

1. **Configure SSH to localhost** on the Proxmox host
2. OR **Install lspci tools** in the container and scan locally
3. OR **Mount `/sys`** from the host into the container

**For LXC containers:**
```bash
# On Proxmox host, add to container config:
lxc.cgroup2.devices.allow: a
lxc.cap.drop:
lxc.mount.entry: /sys/kernel/iommu_groups sys/kernel/iommu_groups none bind,optional,create=dir
```

Then restart container:
```bash
pct stop VMID && pct start VMID
```

## Current Behavior

### ✅ With SSH Access
- Shows **real hardware** from your Proxmox server
- Displays **actual IOMMU groups**
- Lists **current driver bindings**
- Shows **real VM configurations**

### ⚠️ Without SSH Access
- Falls back to **mock device data** (for demo)
- Shows sample GTX 980, USB controller, NVMe drive
- Logs warning in backend: `SSH connection failed. Returning mock data.`

## Troubleshooting

### "SSH connection failed" in logs

**Check backend logs:**
```bash
tail -f /var/log/supervisor/backend.err.log
```

**Verify SSH access:**
```bash
# From container
ssh -v root@YOUR_PROXMOX_IP
```

**Common issues:**
- SSH keys not configured → Follow Option 1 above
- Firewall blocking port 22 → Allow SSH from container IP
- Wrong hostname in Proxmox config → Use IP address instead

### "Proxmox configuration not found"

You need to configure Proxmox connection first:
1. Go to **Settings** page
2. Enter your Proxmox host URL (e.g., `https://192.168.1.100:8006`)
3. Create an **API Token** in Proxmox (see README.md)
4. Save configuration

### Devices show but no IOMMU groups

Your system may not have IOMMU enabled:

**Check IOMMU:**
```bash
dmesg | grep -i iommu
```

**Enable IOMMU** in Proxmox:
```bash
# Edit /etc/default/grub
# For Intel:
GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt"

# For AMD:
GRUB_CMDLINE_LINUX_DEFAULT="quiet amd_iommu=on iommu=pt"

# Update grub and reboot
update-grub
reboot
```

## Security Notes

- **SSH access as root** is required for full hardware access
- Consider creating a **dedicated user** with sudo privileges
- Use **SSH key authentication** (never password)
- **Restrict SSH** to specific IPs if possible
- **API tokens** should have minimum required permissions

## Advanced: Custom SSH Configuration

If you need non-standard SSH setup:

**Edit backend to use custom SSH:**
```python
# In server.py, update SSH connection:
ssh_client.connect(
    host,
    username='proxmox-admin',  # Custom user
    port=2222,                  # Custom port
    key_filename='/path/to/key' # Custom key
)
```

## Testing Your Setup

1. **Configure Proxmox API** in Settings
2. **Click "Scan Devices"** on Devices page
3. **Check toast notification:**
   - ✅ "Scan complete! Found X devices" → Working!
   - ❌ Error message → Check logs

4. **Verify real data:**
   - Device names match your hardware
   - IOMMU groups are populated
   - Driver names are correct

5. **Check VMs page:**
   - Shows your actual VMs/containers
   - Displays real VM IDs and names
   - Lists any existing PCI passthroughs

## What's Next?

Once scanning works, you can:
- ✅ Ask AI about your actual hardware
- ✅ Plan GPU passthrough configurations
- ✅ Check IOMMU group isolation
- ⏳ Execute driver binding changes (requires additional SSH commands)
- ⏳ Attach devices to VMs automatically

The action execution (bind/unbind drivers, attach to VMs) requires additional implementation but the scanning foundation is now in place!

---

**Need help?** Check the backend logs for detailed error messages:
```bash
tail -f /var/log/supervisor/backend.err.log | grep -i "error\|warning"
```
