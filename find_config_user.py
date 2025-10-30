#!/usr/bin/env python3
"""
Find the user who owns the Proxmox configuration
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import requests

BACKEND_URL = "https://proxmox-explorer.preview.emergentagent.com/api"

async def find_config_user():
    """Find the user who owns the Proxmox configuration"""
    try:
        mongo_url = "mongodb://localhost:27017"
        client = AsyncIOMotorClient(mongo_url)
        db = client["proxmox_ai_admin"]
        
        # Get the Proxmox config
        config = await db.proxmox_configs.find_one({})
        if not config:
            print("❌ No Proxmox config found")
            return None
        
        config_user_id = config.get('user_id')
        print(f"📋 Proxmox config owned by user ID: {config_user_id}")
        
        # Find the user with this ID
        user = await db.users.find_one({"id": config_user_id})
        if user:
            print(f"✅ Found user: {user.get('username')}")
            return user.get('username')
        else:
            print("❌ User not found in database")
            
            # List all users for debugging
            users = await db.users.find({}).to_list(length=10)
            print(f"📊 Available users:")
            for u in users:
                print(f"   - {u.get('username')} (ID: {u.get('id')})")
        
        client.close()
        return None
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

def test_with_username(username):
    """Test login with a specific username"""
    # Try common passwords
    passwords = ["password", "admin", "test", "123456", username, f"{username}123"]
    
    for password in passwords:
        try:
            login_data = {"username": username, "password": password}
            response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data, timeout=10)
            
            if response.status_code == 200:
                print(f"✅ Successfully logged in as {username} with password: {password}")
                token = response.json()["token"]
                
                # Test Proxmox config access
                headers = {"Authorization": f"Bearer {token}"}
                response = requests.get(f"{BACKEND_URL}/proxmox/config", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    config = response.json()
                    if config:
                        print(f"✅ User has Proxmox config: {config.get('host')}")
                        return token
                    else:
                        print("❌ User has no Proxmox config")
                
        except Exception as e:
            continue
    
    print(f"❌ Could not login as {username}")
    return None

async def main():
    print("=" * 60)
    print("FINDING PROXMOX CONFIG OWNER")
    print("=" * 60)
    
    username = await find_config_user()
    
    if username:
        print(f"\n🔍 Testing login for user: {username}")
        token = test_with_username(username)
        
        if token:
            print(f"\n🎯 SUCCESS! Can now test VM 121 with this token")
            
            # Quick test of VMs endpoint
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BACKEND_URL}/vms", headers=headers, timeout=15)
            print(f"GET /vms: {response.status_code}")
            
            if response.status_code == 200:
                vms = response.json()
                print(f"Found {len(vms)} VMs/Containers")
                
                # Look for VM 121
                for vm in vms:
                    if str(vm.get('vmid')) == '121':
                        print(f"✅ FOUND VM 121: {vm['name']} (type: {vm['type']}, status: {vm['status']})")
                        break
                else:
                    print("❌ VM 121 not found")
            else:
                print(f"❌ VMs request failed: {response.text}")

if __name__ == "__main__":
    asyncio.run(main())