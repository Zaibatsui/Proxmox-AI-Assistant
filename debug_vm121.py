#!/usr/bin/env python3
"""
Debug script to investigate VM 121 connection issues
"""

import requests
import json
import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BACKEND_URL = "https://proxai-assistant.preview.emergentagent.com/api"

async def check_database():
    """Check MongoDB for existing configurations"""
    try:
        # Connect to MongoDB
        mongo_url = "mongodb://localhost:27017"
        client = AsyncIOMotorClient(mongo_url)
        db = client["proxmox_ai_admin"]
        
        print("🔍 Checking MongoDB for existing configurations...")
        
        # Check users
        users = await db.users.find({}).to_list(length=10)
        print(f"📊 Found {len(users)} users in database")
        
        # Check Proxmox configs
        configs = await db.proxmox_configs.find({}).to_list(length=10)
        print(f"📊 Found {len(configs)} Proxmox configurations")
        
        for config in configs:
            print(f"   - Host: {config.get('host', 'unknown')}")
            print(f"   - User ID: {config.get('user_id', 'unknown')}")
            print(f"   - Token Name: {config.get('api_token_name', 'unknown')}")
        
        client.close()
        return len(configs) > 0
        
    except Exception as e:
        print(f"❌ Database check error: {str(e)}")
        return False

def test_direct_api_calls():
    """Test API calls without authentication to see raw errors"""
    print("\n🔍 Testing direct API calls...")
    
    try:
        # Test without auth to see what happens
        response = requests.get(f"{BACKEND_URL}/vms", timeout=10)
        print(f"GET /vms (no auth): {response.status_code} - {response.text[:200]}")
        
        # Test file list without auth
        response = requests.post(f"{BACKEND_URL}/files/list", 
                               json={"path": "/root", "location": {"type": "lxc", "id": "121"}}, 
                               timeout=10)
        print(f"POST /files/list (no auth): {response.status_code} - {response.text[:200]}")
        
    except Exception as e:
        print(f"❌ Direct API test error: {str(e)}")

def authenticate_and_test():
    """Authenticate and test with proper token"""
    try:
        # Register/login
        register_data = {"username": "debug_user", "password": "DebugPass123!"}
        
        response = requests.post(f"{BACKEND_URL}/auth/register", json=register_data, timeout=10)
        if response.status_code == 400:
            # Try login
            response = requests.post(f"{BACKEND_URL}/auth/login", json=register_data, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Auth failed: {response.status_code} - {response.text}")
            return None
            
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"✅ Authenticated successfully")
        
        # Test Proxmox config endpoint
        response = requests.get(f"{BACKEND_URL}/proxmox/config", headers=headers, timeout=10)
        print(f"GET /proxmox/config: {response.status_code} - {response.text}")
        
        # Test VMs endpoint
        response = requests.get(f"{BACKEND_URL}/vms", headers=headers, timeout=10)
        print(f"GET /vms: {response.status_code} - {response.text}")
        
        return headers
        
    except Exception as e:
        print(f"❌ Auth test error: {str(e)}")
        return None

async def main():
    print("=" * 60)
    print("DEBUG: VM/Container 121 Connection Issues")
    print("=" * 60)
    
    # Check database
    has_configs = await check_database()
    
    # Test API calls
    test_direct_api_calls()
    
    # Test with authentication
    headers = authenticate_and_test()
    
    print("\n" + "=" * 60)
    print("DIAGNOSIS SUMMARY")
    print("=" * 60)
    
    if not has_configs:
        print("❌ ROOT CAUSE: No Proxmox configuration found in database")
        print("   - The system cannot connect to any Proxmox server")
        print("   - VM/Container 121 cannot be accessed without Proxmox connection")
        print("   - User needs to configure Proxmox settings first")
    else:
        print("✅ Proxmox configurations exist - investigating connection issues...")
    
    print("\n📋 RECOMMENDED ACTIONS:")
    print("1. Configure Proxmox connection in Settings")
    print("2. Verify Proxmox server is accessible")
    print("3. Check API token permissions")
    print("4. Verify VM/Container 121 exists on the Proxmox server")

if __name__ == "__main__":
    asyncio.run(main())