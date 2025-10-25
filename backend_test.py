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
    
    def test_create_ssh_profile(self):
        """Test creating an SSH connection profile"""
        try:
            profile_data = {
                "name": "Test SSH Profile",
                "connection_type": "ssh",
                "host": "test.example.com",
                "port": 22,
                "username": "testuser",
                "password": "testpass",
                "base_path": "/home/testuser",
                "notes": "Test SSH profile for SFTP operations testing"
            }
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=profile_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                self.test_profile_id = result.get('id')
                self.log_result(
                    "Create SSH Profile", 
                    True, 
                    f"Successfully created SSH profile with ID: {self.test_profile_id}",
                    {"profile_id": self.test_profile_id, "name": profile_data["name"]}
                )
                return True
            else:
                self.log_result("Create SSH Profile", False, f"Failed to create profile: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Create SSH Profile", False, f"Profile creation error: {str(e)}")
            return False
    
    def test_create_sftp_profile(self):
        """Test creating an SFTP connection profile"""
        try:
            profile_data = {
                "name": "Test SFTP Profile",
                "connection_type": "sftp",
                "host": "sftp.example.com",
                "port": 22,
                "username": "sftpuser",
                "password": "sftppass",
                "base_path": "/uploads",
                "notes": "Test SFTP profile for file operations testing"
            }
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=profile_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                sftp_profile_id = result.get('id')
                self.log_result(
                    "Create SFTP Profile", 
                    True, 
                    f"Successfully created SFTP profile with ID: {sftp_profile_id}",
                    {"profile_id": sftp_profile_id, "name": profile_data["name"]}
                )
                return sftp_profile_id
            else:
                self.log_result("Create SFTP Profile", False, f"Failed to create SFTP profile: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Create SFTP Profile", False, f"SFTP profile creation error: {str(e)}")
            return None
    
    def test_profile_connection(self, profile_id):
        """Test connection profile connectivity"""
        try:
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/test", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                status = result.get('status', 'unknown')
                message = result.get('message', 'No message')
                
                if status == 'success':
                    self.log_result(
                        "Profile Connection Test", 
                        True, 
                        f"Connection test successful: {message}",
                        {"profile_id": profile_id, "status": status}
                    )
                    return True
                else:
                    self.log_result(
                        "Profile Connection Test", 
                        False, 
                        f"Connection test failed: {message}",
                        {"profile_id": profile_id, "status": status}
                    )
                    return False
            else:
                self.log_result("Profile Connection Test", False, f"Connection test request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Profile Connection Test", False, f"Connection test error: {str(e)}")
            return False
    
    def test_file_operations(self, profile_id):
        """Test file operations using connection profile"""
        if not profile_id:
            self.log_result("File Operations Test", False, "No profile ID provided")
            return False
            
        try:
            # Test 1: List files
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/list?path=/", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                files = response.json()
                self.log_result(
                    "File List Operation", 
                    True, 
                    f"Successfully listed files in root directory",
                    {"file_count": len(files) if isinstance(files, list) else "unknown"}
                )
            else:
                self.log_result("File List Operation", False, f"File listing failed: {response.status_code} - {response.text}")
                return False
            
            # Test 2: Create directory
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/mkdir?path=/test_dir", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result("Directory Create Operation", True, "Successfully created test directory")
            else:
                self.log_result("Directory Create Operation", False, f"Directory creation failed: {response.status_code} - {response.text}")
            
            # Test 3: Write file
            test_content = "This is a test file created by the SFTP connection profile test."
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/write?path=/test_dir/test_file.txt&content={test_content}", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result("File Write Operation", True, "Successfully wrote test file")
            else:
                self.log_result("File Write Operation", False, f"File write failed: {response.status_code} - {response.text}")
            
            # Test 4: Read file
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/read?path=/test_dir/test_file.txt", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                file_data = response.json()
                content = file_data.get('content', '')
                if test_content in content:
                    self.log_result("File Read Operation", True, "Successfully read test file with correct content")
                else:
                    self.log_result("File Read Operation", False, f"File content mismatch. Expected: {test_content}, Got: {content}")
            else:
                self.log_result("File Read Operation", False, f"File read failed: {response.status_code} - {response.text}")
            
            # Test 5: Rename file
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/rename?old_path=/test_dir/test_file.txt&new_name=renamed_file.txt", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result("File Rename Operation", True, "Successfully renamed test file")
            else:
                self.log_result("File Rename Operation", False, f"File rename failed: {response.status_code} - {response.text}")
            
            # Test 6: Delete file
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/delete?path=/test_dir/renamed_file.txt", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result("File Delete Operation", True, "Successfully deleted test file")
            else:
                self.log_result("File Delete Operation", False, f"File delete failed: {response.status_code} - {response.text}")
            
            return True
                
        except Exception as e:
            self.log_result("File Operations Test", False, f"File operations error: {str(e)}")
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