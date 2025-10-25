#!/usr/bin/env python3
"""
Backend API Testing for Connection Profile SFTP File Operations
Testing the new SFTP connection profile implementation with file operations.
"""

import requests
import json
import os
import sys
import base64
from datetime import datetime

# Get backend URL from frontend env
BACKEND_URL = "https://filemind-1.preview.emergentagent.com/api"

class ConnectionProfileTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.test_results = []
        self.test_profile_id = None
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
    
    def authenticate(self):
        """Authenticate with test user or create one"""
        try:
            # Try to register a new test user first
            register_data = {
                "username": "sftp_tester", 
                "password": "TestPass123!"
            }
            response = requests.post(f"{self.base_url}/auth/register", json=register_data, timeout=10)
            
            if response.status_code == 200:
                self.token = response.json()["token"]
                self.log_result("Authentication", True, "Registered and logged in successfully")
                return True
            elif response.status_code == 400 and "already exists" in response.text:
                # User exists, try login
                login_data = {
                    "username": "sftp_tester", 
                    "password": "TestPass123!"
                }
                response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
                if response.status_code == 200:
                    self.token = response.json()["token"]
                    self.log_result("Authentication", True, "Logged in successfully")
                    return True
                else:
                    self.log_result("Authentication", False, f"Login failed: {response.status_code} - {response.text}")
                    return False
            else:
                self.log_result("Authentication", False, f"Registration failed: {response.status_code} - {response.text}")
                return False
            
        except Exception as e:
            self.log_result("Authentication", False, f"Auth error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_connection_profiles_list(self):
        """Test GET /api/connection-profiles"""
        try:
            response = requests.get(f"{self.base_url}/connection-profiles", headers=self.get_headers(), timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                profiles = data.get('profiles', [])
                
                self.log_result(
                    "Connection Profiles List", 
                    True, 
                    f"Successfully retrieved {len(profiles)} connection profiles",
                    {"profile_count": len(profiles)}
                )
                return profiles
            else:
                self.log_result("Connection Profiles List", False, f"Failed to get profiles: {response.status_code} - {response.text}")
                return []
                
        except Exception as e:
            self.log_result("Connection Profiles List", False, f"Error getting profiles: {str(e)}")
            return []
    
    def test_lxc_file_access(self):
        """Test LXC container file access (no SSH needed)"""
        try:
            file_list_data = {
                "path": "/root",
                "location": {
                    "type": "lxc",
                    "id": "121"
                }
            }
            
            response = requests.post(
                f"{self.base_url}/files/list", 
                json=file_list_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                files = response.json()
                self.log_result(
                    "LXC File Access Test", 
                    True, 
                    f"Successfully accessed LXC 121 files in /root",
                    {"file_count": len(files.get('files', [])), "path": "/root"}
                )
                return True
            else:
                error_msg = response.text
                self.log_result(
                    "LXC File Access Test", 
                    False, 
                    f"LXC file access failed: {response.status_code}",
                    {"error": error_msg}
                )
                return False
                
        except Exception as e:
            self.log_result("LXC File Access Test", False, f"LXC test error: {str(e)}")
            return False
    
    def test_vm_ssh_file_access(self):
        """Test VM SSH file access with provided credentials"""
        try:
            file_list_data = {
                "path": "/root",
                "location": {
                    "type": "vm",
                    "id": "121",
                    "ssh_username": "root",
                    "ssh_password": "10065609Xx!"
                }
            }
            
            response = requests.post(
                f"{self.base_url}/files/list", 
                json=file_list_data, 
                headers=self.get_headers(), 
                timeout=30  # Longer timeout for SSH
            )
            
            if response.status_code == 200:
                files = response.json()
                self.log_result(
                    "VM SSH File Access Test", 
                    True, 
                    f"Successfully accessed VM 121 via SSH",
                    {"file_count": len(files.get('files', [])), "path": "/root"}
                )
                return True
            else:
                error_msg = response.text
                self.log_result(
                    "VM SSH File Access Test", 
                    False, 
                    f"VM SSH access failed: {response.status_code}",
                    {"error": error_msg, "credentials_used": "root/10065609Xx!"}
                )
                return False
                
        except Exception as e:
            self.log_result("VM SSH File Access Test", False, f"VM SSH test error: {str(e)}")
            return False
    
    def check_backend_logs(self):
        """Check backend logs for SSH-related errors"""
        try:
            import subprocess
            
            # Check supervisor backend logs
            log_files = [
                "/var/log/supervisor/backend.err.log",
                "/var/log/supervisor/backend.out.log"
            ]
            
            ssh_errors = []
            
            for log_file in log_files:
                try:
                    result = subprocess.run(
                        ["tail", "-n", "50", log_file], 
                        capture_output=True, 
                        text=True, 
                        timeout=10
                    )
                    
                    if result.returncode == 0:
                        log_content = result.stdout
                        
                        # Look for SSH-related errors
                        ssh_keywords = [
                            "SSH connection failed",
                            "Could not determine IP",
                            "QEMU guest agent",
                            "VM 121",
                            "paramiko",
                            "Connection refused",
                            "Authentication failed"
                        ]
                        
                        for line in log_content.split('\n'):
                            for keyword in ssh_keywords:
                                if keyword.lower() in line.lower():
                                    ssh_errors.append(line.strip())
                                    
                except Exception as e:
                    print(f"Could not read {log_file}: {str(e)}")
            
            if ssh_errors:
                self.log_result(
                    "Backend Log Analysis", 
                    True, 
                    f"Found {len(ssh_errors)} SSH-related log entries",
                    {"errors": ssh_errors[:10]}  # Limit to first 10
                )
            else:
                self.log_result(
                    "Backend Log Analysis", 
                    True, 
                    "No SSH-related errors found in recent logs"
                )
                
        except Exception as e:
            self.log_result("Backend Log Analysis", False, f"Log analysis error: {str(e)}")
    
    def check_vms_via_ssh(self):
        """Check what VMs exist on Proxmox via direct SSH"""
        try:
            # Test direct SSH connection to list VMs
            ssh_test_data = {
                "path": "/etc/pve/qemu-server",
                "location": None  # Host location
            }
            
            response = requests.post(
                f"{self.base_url}/files/list", 
                json=ssh_test_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                files_data = response.json()
                vm_configs = []
                
                # Handle both list and dict responses
                files_list = files_data if isinstance(files_data, list) else files_data.get('files', [])
                
                for file_info in files_list:
                    if isinstance(file_info, dict) and file_info.get('name', '').endswith('.conf'):
                        vm_id = file_info.get('name', '').replace('.conf', '')
                        vm_configs.append(vm_id)
                    elif isinstance(file_info, str) and file_info.endswith('.conf'):
                        vm_id = file_info.replace('.conf', '')
                        vm_configs.append(vm_id)
                
                self.log_result(
                    "Direct VM Check via SSH", 
                    True, 
                    f"Found {len(vm_configs)} VM config files via SSH",
                    {"vm_ids": vm_configs}
                )
                
                # Check if 121.conf exists
                if "121" in vm_configs:
                    self.log_result("VM 121 Config Check", True, "VM 121 config file exists on Proxmox host")
                    return True
                else:
                    self.log_result("VM 121 Config Check", False, f"VM 121 config not found. Available VMs: {vm_configs}")
                    return False
            else:
                self.log_result("Direct VM Check via SSH", False, f"SSH file listing failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Direct VM Check via SSH", False, f"SSH VM check error: {str(e)}")
            return False
    
    def test_proxmox_connection(self):
        """Test if Proxmox connection is configured and working"""
        try:
            response = requests.get(f"{self.base_url}/proxmox/config", headers=self.get_headers(), timeout=10)
            
            if response.status_code == 200:
                config = response.json()
                if config:
                    self.log_result(
                        "Proxmox Configuration", 
                        True, 
                        f"Proxmox configured for host: {config.get('host', 'unknown')}"
                    )
                    
                    # Test the actual connection
                    test_response = requests.post(f"{self.base_url}/proxmox/test-connection", headers=self.get_headers(), timeout=30)
                    if test_response.status_code == 200:
                        test_result = test_response.json()
                        api_status = test_result.get('api', {}).get('status', 'unknown')
                        ssh_status = test_result.get('ssh', {}).get('status', 'unknown')
                        
                        if api_status == 'success':
                            self.log_result("Proxmox API Test", True, f"Proxmox API connection successful")
                        else:
                            api_error = test_result.get('api', {}).get('error', 'Unknown error')
                            self.log_result("Proxmox API Test", False, f"Proxmox API failed: {api_error}")
                        
                        if ssh_status == 'success':
                            self.log_result("Proxmox SSH Test", True, f"Proxmox SSH connection successful")
                        else:
                            ssh_error = test_result.get('ssh', {}).get('error', 'Unknown error')
                            self.log_result("Proxmox SSH Test", False, f"Proxmox SSH failed: {ssh_error}")
                    else:
                        self.log_result("Proxmox Connection Test", False, f"Connection test failed: {test_response.status_code} - {test_response.text}")
                else:
                    self.log_result(
                        "Proxmox Configuration", 
                        False, 
                        "No Proxmox configuration found - this may be why VM 121 cannot be accessed"
                    )
            else:
                self.log_result(
                    "Proxmox Configuration", 
                    False, 
                    f"Could not check Proxmox config: {response.status_code}"
                )
                
        except Exception as e:
            self.log_result("Proxmox Configuration", False, f"Proxmox config check error: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests for VM/Container 121"""
        print("=" * 60)
        print("TESTING VM/CONTAINER 121 SSH CONNECTION")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Check Proxmox configuration
        self.test_proxmox_connection()
        
        # Step 3: Find VM/Container 121
        vm_121 = self.test_vm_list_api()
        
        if vm_121:
            vm_type = vm_121.get('type', 'unknown')
            
            # Step 4: Test appropriate access method based on type
            if vm_type == "lxc":
                print(f"\n🔍 VM 121 is an LXC container - testing pct exec access...")
                self.test_lxc_file_access()
            elif vm_type == "qemu":
                print(f"\n🔍 VM 121 is a QEMU VM - testing SSH access...")
                self.test_vm_ssh_file_access()
            else:
                self.log_result("VM Type Test", False, f"Unknown VM type: {vm_type}")
        else:
            # VM 121 not found in list, but let's test both access methods anyway
            # since the API might be failing but the VM could still exist
            print(f"\n🔍 VM 121 not found in API list, but testing both access methods...")
            print(f"🔍 Testing LXC container access (pct exec)...")
            lxc_success = self.test_lxc_file_access()
            
            print(f"🔍 Testing QEMU VM SSH access...")
            vm_success = self.test_vm_ssh_file_access()
            
            if lxc_success:
                self.log_result("VM 121 Type Detection", True, "VM 121 is accessible as LXC container")
            elif vm_success:
                self.log_result("VM 121 Type Detection", True, "VM 121 is accessible as QEMU VM via SSH")
            else:
                self.log_result("VM 121 Type Detection", False, "VM 121 is not accessible via LXC or SSH methods")
        
        # Step 5: Check what VMs exist via SSH
        print(f"\n🔍 Checking what VMs exist via direct SSH...")
        vm_121_exists = self.check_vms_via_ssh()
        
        # Step 6: Check backend logs
        print(f"\n🔍 Checking backend logs for errors...")
        self.check_backend_logs()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Tests passed: {passed}/{total}")
        
        if passed < total:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/vm121_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/vm121_test_results.json")
    
    sys.exit(0 if success else 1)