#!/usr/bin/env python3
"""
Backend API Testing for VM/Container 121 SSH Connection
Testing VM/Container SSH Connection for ID 121 as requested in review.
"""

import requests
import json
import os
import sys
from datetime import datetime

# Get backend URL from frontend env
BACKEND_URL = "https://vm-ai-manager.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.test_results = []
        
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
        """Authenticate with test user (Proxmox config already copied via database)"""
        try:
            # User exists, try login
            login_data = {
                "username": "vm121_tester", 
                "password": "TestPass123!"
            }
            response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
            if response.status_code == 200:
                self.token = response.json()["token"]
                self.log_result("Authentication", True, "Logged in successfully (Proxmox config pre-configured with port 8006)")
                return True
            else:
                self.log_result("Authentication", False, f"Login failed: {response.status_code} - {response.text}")
                return False
            
        except Exception as e:
            self.log_result("Authentication", False, f"Auth error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_vm_list_api(self):
        """Test GET /api/vms to find VM/Container 121"""
        try:
            response = requests.get(f"{self.base_url}/vms", headers=self.get_headers(), timeout=15)
            
            if response.status_code == 200:
                vms = response.json()
                vm_121 = None
                
                # Look for VM/Container 121
                for vm in vms:
                    if str(vm.get('vmid')) == '121':
                        vm_121 = vm
                        break
                
                if vm_121:
                    vm_type = vm_121.get('type', 'unknown')
                    vm_name = vm_121.get('name', 'Unknown')
                    vm_status = vm_121.get('status', 'unknown')
                    
                    self.log_result(
                        "VM 121 Detection", 
                        True, 
                        f"Found VM/Container 121: {vm_name} (type: {vm_type}, status: {vm_status})",
                        {
                            "vmid": "121",
                            "type": vm_type,
                            "name": vm_name,
                            "status": vm_status,
                            "node": vm_121.get('node', 'unknown')
                        }
                    )
                    return vm_121
                else:
                    self.log_result("VM 121 Detection", False, "VM/Container 121 not found in the system")
                    return None
            else:
                self.log_result("VM 121 Detection", False, f"Failed to get VMs list: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log_result("VM 121 Detection", False, f"Error getting VMs: {str(e)}")
            return None
    
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
    
    def test_proxmox_connection(self):
        """Test if Proxmox connection is configured"""
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
        
        # Step 5: Check backend logs
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