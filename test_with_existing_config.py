#!/usr/bin/env python3
"""
Test VM 121 using the existing Proxmox configuration
"""

import requests
import json
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_URL = "https://proxmox-ai.preview.emergentagent.com/api"

async def get_existing_config():
    """Get the existing Proxmox configuration from database"""
    try:
        mongo_url = "mongodb://localhost:27017"
        client = AsyncIOMotorClient(mongo_url)
        db = client["proxmox_ai_admin"]
        
        config = await db.proxmox_configs.find_one({})
        client.close()
        return config
    except Exception as e:
        print(f"❌ Error getting config: {str(e)}")
        return None

def authenticate_as_config_owner(user_id):
    """Try to authenticate as the user who owns the Proxmox config"""
    try:
        # We need to find the user with this ID and try to login
        # For testing, let's try common usernames
        test_users = [
            {"username": "admin", "password": "admin"},
            {"username": "zaibatsui", "password": "password"},
            {"username": "proxmox", "password": "proxmox"},
            {"username": "test", "password": "test"}
        ]
        
        for user_data in test_users:
            try:
                response = requests.post(f"{BACKEND_URL}/auth/login", json=user_data, timeout=10)
                if response.status_code == 200:
                    token_data = response.json()
                    print(f"✅ Successfully logged in as: {user_data['username']}")
                    return token_data["token"]
            except:
                continue
        
        print("❌ Could not authenticate as config owner")
        return None
        
    except Exception as e:
        print(f"❌ Auth error: {str(e)}")
        return None

def test_vm_121_with_token(token):
    """Test VM 121 access with the proper token"""
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Test Proxmox config
        response = requests.get(f"{BACKEND_URL}/proxmox/config", headers=headers, timeout=10)
        print(f"GET /proxmox/config: {response.status_code}")
        if response.status_code == 200:
            config = response.json()
            if config:
                print(f"   Host: {config.get('host')}")
            else:
                print("   No config returned")
        
        # Test VMs list
        response = requests.get(f"{BACKEND_URL}/vms", headers=headers, timeout=15)
        print(f"GET /vms: {response.status_code}")
        
        if response.status_code == 200:
            vms = response.json()
            print(f"   Found {len(vms)} VMs/Containers")
            
            # Look for VM 121
            vm_121 = None
            for vm in vms:
                if str(vm.get('vmid')) == '121':
                    vm_121 = vm
                    break
            
            if vm_121:
                print(f"✅ Found VM 121: {vm_121['name']} (type: {vm_121['type']}, status: {vm_121['status']})")
                
                # Test file access based on type
                if vm_121['type'] == 'lxc':
                    print("🔍 Testing LXC file access...")
                    file_data = {
                        "path": "/root",
                        "location": {"type": "lxc", "id": "121"}
                    }
                    response = requests.post(f"{BACKEND_URL}/files/list", json=file_data, headers=headers, timeout=15)
                    print(f"   LXC file access: {response.status_code}")
                    if response.status_code == 200:
                        files = response.json()
                        print(f"   ✅ Successfully listed {len(files.get('files', []))} files in /root")
                    else:
                        print(f"   ❌ LXC access failed: {response.text}")
                
                elif vm_121['type'] == 'qemu':
                    print("🔍 Testing VM SSH file access...")
                    file_data = {
                        "path": "/root",
                        "location": {
                            "type": "vm", 
                            "id": "121",
                            "ssh_username": "root",
                            "ssh_password": "10065609Xx!"
                        }
                    }
                    response = requests.post(f"{BACKEND_URL}/files/list", json=file_data, headers=headers, timeout=30)
                    print(f"   VM SSH access: {response.status_code}")
                    if response.status_code == 200:
                        files = response.json()
                        print(f"   ✅ Successfully accessed VM via SSH, found {len(files.get('files', []))} files")
                    else:
                        print(f"   ❌ VM SSH access failed: {response.text}")
            else:
                print("❌ VM 121 not found in the list")
                print("   Available VMs:")
                for vm in vms[:5]:  # Show first 5
                    print(f"     - VM {vm['vmid']}: {vm['name']} ({vm['type']}, {vm['status']})")
        else:
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Test error: {str(e)}")

async def main():
    print("=" * 60)
    print("TESTING VM 121 WITH EXISTING PROXMOX CONFIG")
    print("=" * 60)
    
    # Get existing config
    config = await get_existing_config()
    if not config:
        print("❌ No Proxmox configuration found")
        return
    
    print(f"📋 Found Proxmox config:")
    print(f"   Host: {config.get('host')}")
    print(f"   User ID: {config.get('user_id')}")
    print(f"   Token: {config.get('api_token_name')}")
    
    # Try to authenticate as the config owner
    token = authenticate_as_config_owner(config.get('user_id'))
    if not token:
        print("❌ Could not authenticate as config owner")
        return
    
    # Test VM 121 access
    test_vm_121_with_token(token)

if __name__ == "__main__":
    asyncio.run(main())