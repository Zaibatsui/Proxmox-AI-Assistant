# AI-Powered Action Execution Guide

Your AI Assistant can now **actually execute actions**, not just suggest them! 🚀

## How It Works

### 1. Ask AI to DO Something

Instead of asking "How do I passthrough a GPU?", ask:

**✅ Action Requests (AI will execute):**
- "Setup GPU passthrough for my GTX 980 on Windows-11 VM"
- "Bind device 0000:01:00.0 to vfio-pci driver"
- "Attach my NVIDIA GPU to VM 101"
- "Configure passthrough for all devices in IOMMU group 1"

**ℹ️ Questions (AI will just explain):**
- "What is IOMMU group isolation?"
- "How does vfio-pci work?"
- "Should I passthrough my GPU?"

### 2. AI Creates Actions

When you ask AI to DO something, it will:
1. Analyze your hardware (devices, IOMMU groups, VMs)
2. Create a step-by-step action plan
3. **Automatically add actions to your Action Queue**
4. Show a button: "View & Execute Actions"

### 3. Review & Execute

Go to the **Actions** page to see:
- All steps the AI created
- Detailed parameters for each action
- Option to dry-run first (safe preview)
- Execute button to apply changes

## Example Workflow

### Scenario: Passthrough GTX 980 to Windows 11

**Step 1: Scan Your Hardware**
```
Go to Devices → Click "Scan Devices"
```

**Step 2: Ask AI to Setup Passthrough**
```
AI Assistant: "Setup GPU passthrough for my GTX 980 on windows-11 VM"
```

**Step 3: AI Creates Actions**
AI will analyze and create actions like:
1. Unbind GTX 980 from current driver (i915)
2. Bind GTX 980 to vfio-pci driver
3. Unbind NVIDIA Audio (same IOMMU group)
4. Bind Audio to vfio-pci
5. Attach both devices to windows-11 VM

**Step 4: Execute Actions**
```
Go to Actions page
Click "Dry Run" to preview
Click "Execute" to apply
```

**Step 5: Start VM**
```
Your GPU is now passed through!
```

## Action Types

### 1. Bind Driver
**What it does:** Changes the driver for a PCI device

**Example:**
```json
{
  "type": "bind_driver",
  "pci_address": "0000:01:00.0",
  "driver": "vfio-pci",
  "vendor_id": "10de",
  "device_id": "13c0"
}
```

**Executes:**
```bash
# Unbind from current driver
echo '0000:01:00.0' > /sys/bus/pci/devices/0000:01:00.0/driver/unbind

# Load vfio-pci
modprobe vfio-pci
echo '10de 13c0' > /sys/bus/pci/drivers/vfio-pci/new_id

# Bind to vfio-pci
echo '0000:01:00.0' > /sys/bus/pci/drivers/vfio-pci/bind
```

### 2. Attach to VM
**What it does:** Adds PCI device to VM configuration

**Example:**
```json
{
  "type": "attach_to_vm",
  "vmid": "101",
  "pci_address": "0000:01:00.0",
  "pcie": true
}
```

**Executes:**
- Updates `/etc/pve/qemu-server/101.conf`
- Adds: `hostpci0: 0000:01:00.0,pcie=1`

### 3. Detach from VM
**What it does:** Removes PCI device from VM

**Example:**
```json
{
  "type": "detach_from_vm",
  "vmid": "101",
  "hostpci_id": "hostpci0"
}
```

## Safety Features

### Dry Run Mode
- **Always run dry-run first!**
- Shows exactly what will happen
- No changes are made
- Safe to test

### Automatic Validation
- Checks if VM is stopped (can't modify running VMs)
- Verifies Proxmox connection
- Validates PCI addresses
- Logs all changes

### IOMMU Group Warnings
AI will warn you about:
- Devices in the same IOMMU group (must pass all together)
- Potential conflicts
- Required BIOS settings

## Smart AI Features

### Context-Aware
AI knows about:
- Your scanned devices
- Your VMs
- Current driver bindings
- IOMMU groups

**Example:**
```
You: "Setup passthrough for windows-11"

AI: I see you have:
- windows-11 VM (ID: 101) - currently stopped ✓
- GTX 980 GPU at 0000:01:00.0 (IOMMU group 1)
- Audio device at 0000:01:00.1 (same IOMMU group 1)

Since both devices are in IOMMU group 1, I'll passthrough both.
Creating actions...
```

### Multi-Step Plans
AI breaks complex tasks into steps:
1. Unbind devices from host
2. Bind to vfio-pci
3. Attach to VM
4. (Optional) Blacklist drivers permanently

### Error Handling
If execution fails, AI explains:
- What went wrong
- How to fix it
- Alternative approaches

## Advanced Examples

### 1. Passthrough Multiple GPUs
```
"Setup passthrough for both my GTX 980 and GTX 1080 on gaming-vm"
```

### 2. USB Controller Passthrough
```
"Attach USB controller 0000:02:00.0 to VM 103"
```

### 3. NVMe Drive Passthrough
```
"Give VM 100 direct access to my Samsung NVMe SSD"
```

### 4. Undo Passthrough
```
"Remove GPU from windows-11 and return it to host"
```

### 5. Swap GPU Between VMs
```
"Move the GTX 980 from VM 101 to VM 102"
```

## Troubleshooting

### "Actions not created"
**Check:**
- Did you ask AI to DO something (not just explain)?
- Is your question specific enough?
- Try: "Setup GPU passthrough for [device] on [VM name]"

### "SSH connection failed"
**Setup SSH keys:**
```bash
ssh-keygen -t ed25519 -N ""
ssh-copy-id root@YOUR_PROXMOX_IP
```

### "VM is running"
**Stop VM first:**
```bash
qm stop VMID
```

Or through Proxmox web UI.

### "Device busy"
**Check if device is in use:**
```bash
lsof | grep /dev/vfio
```

### "IOMMU group conflict"
**AI will warn you** and suggest passing all devices in the group together.

## Requirements for Action Execution

### ✅ SSH Access Required
Actions that modify drivers need SSH:
```bash
ssh root@proxmox-host "command"
```

### ✅ Proxmox API Access Required
VM configuration changes use API tokens.

### ✅ VM Must Be Stopped
Can't modify PCI devices on running VMs.

### ✅ IOMMU Must Be Enabled
Check with: `dmesg | grep -i iommu`

Enable in `/etc/default/grub`:
```bash
GRUB_CMDLINE_LINUX_DEFAULT="quiet intel_iommu=on iommu=pt"
```

## What Gets Executed

### Safe Operations (Dry Run First)
- ✅ Driver binding/unbinding
- ✅ VM config updates
- ✅ Module loading

### Persistent Changes
- ⚠️ VM configurations (saved to disk)
- ⚠️ Driver bindings (lost on reboot unless blacklisted)

### NOT Modified
- ❌ BIOS/UEFI settings
- ❌ Kernel parameters (requires manual grub update)
- ❌ Driver blacklist (AI suggests, you apply manually)

## Best Practices

### 1. Always Scan First
```
Devices → Scan Devices
```
This gives AI current hardware info.

### 2. Use Dry Run
```
Actions → Dry Run → Review → Execute
```

### 3. Stop VMs
Before passthrough changes:
```bash
qm stop VMID
```

### 4. Backup VM Config
```bash
cp /etc/pve/qemu-server/VMID.conf /etc/pve/qemu-server/VMID.conf.backup
```

### 5. Check IOMMU Groups
```
Ask AI: "Show me IOMMU group 1"
```

### 6. Test One Device First
Before passing through multiple devices, test with one.

## Future Capabilities (Coming Soon)

- ⏳ Permanent driver blacklisting
- ⏳ ROM file management for GPUs
- ⏳ Automatic VM restart after changes
- ⏳ Conflict resolution for IOMMU groups
- ⏳ Performance tuning suggestions
- ⏳ Multi-node cluster support

## Example AI Conversations

### Simple Passthrough
```
You: Setup GPU passthrough on windows-11

AI: I found your GTX 980 GPU at 0000:01:00.0 in IOMMU group 1.
     Also found Audio device at 0000:01:00.1 in same group.
     
     Creating 4 actions:
     1. Bind GPU to vfio-pci
     2. Bind Audio to vfio-pci
     3. Attach GPU to windows-11
     4. Attach Audio to windows-11
     
     [Actions Created! View & Execute Actions →]
```

### Complex Scenario
```
You: I want to give VM 100 the NVMe drive and VM 101 the GTX 980

AI: Got it! I'll:
     
     For VM 100 (NVMe):
     - Bind 0000:03:00.0 to vfio-pci
     - Attach to VM 100
     
     For VM 101 (GPU):
     - Bind 0000:01:00.0 to vfio-pci
     - Bind 0000:01:00.1 to vfio-pci (same IOMMU group)
     - Attach both to VM 101
     
     [6 Actions Created! View & Execute Actions →]
```

## Getting Started Right Now

1. **Scan your hardware:**
   - Devices → Scan Devices

2. **Ask AI to setup passthrough:**
   - AI Assistant → "Setup GPU passthrough for [your GPU] on [VM name]"

3. **Execute actions:**
   - Actions → Review → Dry Run → Execute

4. **Start your VM:**
   - Your device is now passed through!

---

**Need Help?**
- Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
- Ask AI: "What went wrong with my last action?"
- Review action output in Actions page
