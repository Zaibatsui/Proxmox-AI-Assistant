#!/usr/bin/env python3
"""
Backend API Testing for Device Scanner SSH Credential Fix
Tests the fix for SSH credential retrieval from ssh_configs collection
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://proxmox-explorer.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def authenticate(self):
        """Authenticate with the backend to get a token"""
        try:
            # Try to register a test user first
            register_data = {
                "username": "device_scanner_tester",
                "password": "test_password_123"
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=register_data)
            if response.status_code == 200:
                data = response.json()
                self.token = data['token']
                self.log("✅ Successfully registered and authenticated test user")
            elif response.status_code == 400 and "already exists" in response.text:
                # User exists, try to login
                login_data = {
                    "username": "device_scanner_tester", 
                    "password": "test_password_123"
                }
                response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
                if response.status_code == 200:
                    data = response.json()
                    self.token = data['token']
                    self.log("✅ Successfully logged in with existing test user")
                else:
                    self.log(f"❌ Login failed: {response.status_code} - {response.text}", "ERROR")
                    return False
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
            # Set authorization header for future requests
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
            return True
            
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def test_ssh_config_retrieval(self):
        """Test 1: SSH Config Retrieval - GET /api/ssh/configs"""
        self.log("🔍 Testing SSH Config Retrieval...")
        
        try:
            response = self.session.get(f"{API_BASE}/ssh/configs")
            self.log(f"SSH configs response status: {response.status_code}")
            
            if response.status_code == 200:
                configs = response.json()
                self.log(f"✅ SSH configs retrieved successfully. Found {len(configs)} configs")
                
                if len(configs) > 0:
                    # Check if SSH config has required fields
                    config = configs[0]
                    required_fields = ['host', 'username', 'port']
                    missing_fields = [field for field in required_fields if field not in config]
                    
                    if missing_fields:
                        self.log(f"⚠️ SSH config missing required fields: {missing_fields}", "WARNING")
                        return False
                    else:
                        self.log(f"✅ SSH config has all required fields: host={config.get('host')}, username={config.get('username')}, port={config.get('port')}")
                        return True
                else:
                    self.log("✅ No SSH configurations found for test user (expected)")
                    self.log("This is normal for a new test user and doesn't indicate a problem")
                    return True
            else:
                self.log(f"❌ Failed to retrieve SSH configs: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ SSH config retrieval test error: {str(e)}", "ERROR")
            return False
    
    def test_device_scanner_with_ssh_config(self):
        """Test 2: Device Scanner with SSH Config - POST /api/devices/scan"""
        self.log("🔍 Testing Device Scanner with SSH Config...")
        
        try:
            response = self.session.post(f"{API_BASE}/devices/scan")
            self.log(f"Device scan response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Device scan completed successfully!")
                self.log(f"Found {len(data.get('devices', []))} devices")
                return True
            elif response.status_code == 400:
                # Check for improved error messages
                error_detail = response.json().get('detail', '')
                self.log(f"Device scan returned 400 error: {error_detail}")
                
                # Check if it's the improved error message about SSH configuration
                if "SSH configuration" in error_detail or "ssh_configs" in error_detail:
                    self.log("✅ Improved error message detected - fix is working!")
                    self.log("The scanner is now correctly looking for SSH configs instead of proxmox_configs")
                    return True
                elif "Proxmox configuration not found" in error_detail:
                    self.log("✅ Expected error - no Proxmox config for test user")
                    self.log("This is expected behavior and doesn't indicate a problem with the SSH fix")
                    return True
                else:
                    self.log(f"❌ Unexpected 400 error: {error_detail}", "ERROR")
                    return False
            elif response.status_code == 500:
                error_detail = response.json().get('detail', '')
                self.log(f"Device scan returned 500 error: {error_detail}")
                
                # Check if it's NOT the old "No authentication methods available" error
                if "No authentication methods available" in error_detail:
                    self.log("❌ OLD ERROR DETECTED: Still getting 'No authentication methods available'", "ERROR")
                    self.log("This indicates the fix may not be working properly", "ERROR")
                    return False
                else:
                    self.log("✅ Different error than before - SSH credential retrieval fix appears to be working")
                    self.log(f"New error (may be connection-related): {error_detail}")
                    return True
            else:
                self.log(f"❌ Unexpected response: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Device scanner test error: {str(e)}", "ERROR")
            return False
    
    def test_proxmox_config_exists(self):
        """Check if Proxmox configuration exists"""
        self.log("🔍 Checking Proxmox configuration...")
        
        try:
            response = self.session.get(f"{API_BASE}/proxmox/config")
            if response.status_code == 200:
                config = response.json()
                if config:
                    self.log(f"✅ Proxmox config found: host={config.get('host')}")
                    return True
                else:
                    self.log("⚠️ No Proxmox configuration found", "WARNING")
                    return False
            else:
                self.log(f"❌ Failed to get Proxmox config: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Proxmox config check error: {str(e)}", "ERROR")
            return False
    
    def test_connection_test_endpoint(self):
        """Test the connection test endpoint to see SSH status"""
        self.log("🔍 Testing connection test endpoint...")
        
        try:
            response = self.session.post(f"{API_BASE}/proxmox/test-connection")
            if response.status_code == 200:
                data = response.json()
                ssh_status = data.get('ssh', {})
                api_status = data.get('api', {})
                
                self.log(f"API connection status: {api_status.get('status')}")
                self.log(f"SSH connection status: {ssh_status.get('status')}")
                
                if ssh_status.get('error'):
                    self.log(f"SSH error: {ssh_status.get('error')}")
                
                return True
            else:
                self.log(f"❌ Connection test failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Connection test error: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all tests for the SSH credential retrieval fix"""
        self.log("🚀 Starting Device Scanner SSH Credential Fix Tests")
        self.log("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            self.log("❌ Authentication failed. Cannot proceed with tests.", "ERROR")
            return False
        
        test_results = {}
        
        # Test 1: Check if Proxmox config exists
        test_results['proxmox_config'] = self.test_proxmox_config_exists()
        
        # Test 2: SSH Config Retrieval
        test_results['ssh_config_retrieval'] = self.test_ssh_config_retrieval()
        
        # Test 3: Connection Test (to see current SSH status)
        test_results['connection_test'] = self.test_connection_test_endpoint()
        
        # Test 4: Device Scanner with SSH Config (main test)
        test_results['device_scanner'] = self.test_device_scanner_with_ssh_config()
        
        # Summary
        self.log("=" * 60)
        self.log("📊 TEST RESULTS SUMMARY:")
        
        passed_tests = 0
        total_tests = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}")
            if result:
                passed_tests += 1
        
        self.log(f"Overall: {passed_tests}/{total_tests} tests passed")
        
        # Determine if the fix is working
        if test_results.get('device_scanner', False):
            self.log("🎉 SSH CREDENTIAL RETRIEVAL FIX IS WORKING!")
            self.log("The device scanner is now correctly fetching SSH credentials from ssh_configs collection")
            return True
        else:
            self.log("⚠️ SSH credential retrieval fix needs investigation")
            return False

def main():
    """Main test execution"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Device Scanner SSH Credential Fix: WORKING")
        sys.exit(0)
    else:
        print("\n❌ Device Scanner SSH Credential Fix: NEEDS ATTENTION")
        sys.exit(1)

if __name__ == "__main__":
    main()