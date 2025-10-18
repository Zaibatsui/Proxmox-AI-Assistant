# Fixing Proxmox API Token Permissions

## Problem
Your API token `zaibatsui@pve!ProxmoxAI` can connect to Proxmox but **cannot see any VMs or containers** even though you have 21 of them.

**Root Cause:** The API token lacks permissions to read VM/container data.

## Solution: Grant Permissions to Your API Token

### Method 1: Grant Administrator Role (Quick & Full Access)

**Steps:**
1. Log into Proxmox web interface
2. Go to **Datacenter** → **Permissions**
3. Click **Add** → **API Token Permission**
4. Configure:
   - **Path:** `/` (root - grants access to everything)
   - **API Token:** `zaibatsui@pve!ProxmoxAI`
   - **Role:** `Administrator`
   - **Propagate:** ✓ Check this box
5. Click **Add**

**Result:** Token will have full access to all resources.

---

### Method 2: Grant Minimum Required Permissions (Recommended for Security)

**Steps:**
1. Log into Proxmox web interface
2. Go to **Datacenter** → **Permissions**
3. Add **multiple permissions** for the token:

**Permission 1: VM Monitoring**
- **Path:** `/`
- **API Token:** `zaibatsui@pve!ProxmoxAI`
- **Role:** `VM.Monitor`
- **Propagate:** ✓

**Permission 2: VM Auditing**
- **Path:** `/`
- **API Token:** `zaibatsui@pve!ProxmoxAI`
- **Role:** `VM.Audit`
- **Propagate:** ✓

**Permission 3: Datastore Access**
- **Path:** `/`
- **API Token:** `zaibatsui@pve!ProxmoxAI`
- **Role:** `Datastore.Audit`
- **Propagate:** ✓

**Permission 4: System Audit (for hardware scanning)**
- **Path:** `/`
- **API Token:** `zaibatsui@pve!ProxmoxAI`
- **Role:** `Sys.Audit`
- **Propagate:** ✓

---

### Method 3: Create a Custom Role (Most Flexible)

**Step 1: Create Custom Role**
1. Go to **Datacenter** → **Permissions** → **Roles**
2. Click **Create**
3. Name: `ProxmoxAI-Role`
4. Select these privileges:
   ```
   VM.Monitor        - View VM status
   VM.Audit          - View VM configuration
   VM.Config.*       - Modify VM configuration (if AI needs to make changes)
   Datastore.Audit   - View storage
   Sys.Audit         - View system info
   Sys.Console       - Access console (if needed)
   Pool.Audit        - View resource pools
   ```
5. Click **Create**

**Step 2: Assign Role to Token**
1. Go to **Datacenter** → **Permissions**
2. Click **Add** → **API Token Permission**
3. Configure:
   - **Path:** `/`
   - **API Token:** `zaibatsui@pve!ProxmoxAI`
   - **Role:** `ProxmoxAI-Role`
   - **Propagate:** ✓
4. Click **Add**

---

## Verifying Permissions

After adding permissions, test in the app:

1. **Go to Settings** → Click "Test API"
2. **Should show:** ✅ API: Connected (2 node(s) found)
3. **Go to VM Management** → Should show your 21 VMs/containers
4. **Go to Device Scanner** → Click "Scan Devices"

---

## Common Proxmox Roles Explained

| Role | What It Does | Needed For |
|------|--------------|------------|
| `Administrator` | Full access to everything | Everything (overkill) |
| `VM.Monitor` | View VM status, CPU, memory | Seeing if VMs are running |
| `VM.Audit` | View VM configuration | Seeing VM settings |
| `VM.Config.*` | Modify VM config | Making changes (GPU passthrough) |
| `Datastore.Audit` | View storage info | Storage monitoring |
| `Sys.Audit` | View system info | Hardware detection |
| `Sys.Console` | Access VM console | Direct VM access |

---

## Troubleshooting

### Issue: "Permission denied" errors
**Fix:** Make sure "Propagate" is checked when adding permissions

### Issue: Still seeing 0 VMs after adding permissions
**Fix:** 
1. Clear browser cache
2. In the app, click "Test API" again
3. Refresh VM Management page
4. Check Proxmox audit log to see if token is accessing resources

### Issue: Token has Administrator but still no VMs
**Fix:** 
1. Check if token is attached to correct user (`zaibatsui@pve`)
2. Verify user `zaibatsui` has permissions
3. Check if VMs are in a separate pool/datacenter

---

## Security Best Practices

### ✅ Do:
- Use **Method 2** (minimum permissions) for production
- Create separate tokens for different purposes
- Set token expiration dates
- Monitor token usage in audit logs

### ❌ Don't:
- Give Administrator role unless necessary
- Share token secrets
- Use tokens without privilege separation
- Leave unused tokens active

---

## Quick Reference: Permission Paths

- **All resources:** `/`
- **Specific node:** `/nodes/proxmox`
- **Specific VM:** `/vms/100`
- **Specific storage:** `/storage/local-lvm`
- **Specific pool:** `/pool/production`

**Note:** Using `/` with Propagate checked grants access to everything below.

---

## Expected Result After Fix

Once permissions are added:

**VM Management Page:**
```
✅ Beszel (110) - running
✅ CasaOS (101) - running
✅ Docker (104) - running
✅ FileBrowser-Quantum (117) - running
... (all 21 VMs/containers)
```

**API Test:**
```
✅ API: Connected
   2 node(s) found
   21 VMs/containers discovered
```

---

## Need Help?

If you're still not seeing VMs after following these steps:

1. Check Proxmox logs: `/var/log/pve/tasks/`
2. Test with a different token that has Administrator role
3. Verify your user account has access to the VMs
4. Check if VMs are in a pool that requires separate permissions
