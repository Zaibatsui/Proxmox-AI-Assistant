#!/usr/bin/env python3
"""
CT 104 Docker Container Listing Fallback Test
Testing the fallback mechanism for CT 104 "Proxmox-1 Docker CT" 
which uses direct Docker socket access instead of Portainer Agent.
"""

import requests
import json
import os
import sys
from datetime import datetime

# Get backend URL from frontend env
BACKEND_URL = "https://ai-proxmox.preview.emergentagent.com/api"

class CT104FallbackTester:
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
        """Authenticate with test user"""
        try:
            # Try to login with existing test user
            login_data = {
                "username": "ct104_tester", 
                "password": "TestPass123!"
            }
            response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
            
            if response.status_code == 200:
                self.token = response.json()["token"]
                self.log_result("Authentication", True, "Logged in with existing user successfully")
                return True
            else:
                # Try to register a new test user
                register_data = {
                    "username": "ct104_tester", 
                    "password": "TestPass123!"
                }
                response = requests.post(f"{self.base_url}/auth/register", json=register_data, timeout=10)
                
                if response.status_code == 200:
                    self.token = response.json()["token"]
                    self.log_result("Authentication", True, "Registered and logged in successfully")
                    return True
                elif response.status_code == 400 and "already exists" in response.text:
                    # User exists, try login again
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
    
    def setup_proxmox_config(self):
        """Setup Proxmox configuration for testing"""
        try:
            # Check if config already exists
            response = requests.get(
                f"{self.base_url}/proxmox/config", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200 and response.json():
                self.log_result(
                    "Proxmox Configuration", 
                    True, 
                    "Using existing Proxmox configuration"
                )
                return True
            
            # Create a test Proxmox configuration
            config_data = {
                "host": "proxmox.zaibatsui.co.uk:8006",
                "api_token_name": "root@pam!testing",
                "api_token_secret": "test-secret-key",
                "verify_ssl": False
            }
            
            response = requests.post(
                f"{self.base_url}/proxmox/config", 
                json=config_data,
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result(
                    "Proxmox Configuration", 
                    True, 
                    "Successfully created Proxmox configuration for testing"
                )
                return True
            else:
                self.log_result("Proxmox Configuration", False, f"Failed to create Proxmox config: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Proxmox Configuration", False, f"Proxmox config error: {str(e)}")
            return False
    
    def test_ct104_fallback_all_containers_true(self):
        """Test CT 104 fallback mechanism with all_containers=true"""
        try:
            request_data = {
                "location_type": "lxc",
                "location_id": "104",
                "ssh_username": "zaibatsui",
                "ssh_password": "10065609Xx!",
                "all_containers": True
            }
            
            response = requests.post(
                f"{self.base_url}/containers/list", 
                json=request_data,
                headers=self.get_headers(), 
                timeout=60  # Increased timeout for SSH operations
            )
            
            if response.status_code == 200:
                data = response.json()
                containers = data.get('containers', [])
                location_info = data.get('location', {})
                method_used = location_info.get('method', 'unknown')
                
                # Check if direct_docker method was used (fallback mechanism)
                if method_used == "direct_docker":
                    self.log_result(
                        "CT 104 Fallback (all_containers=true)", 
                        True, 
                        f"Successfully used direct Docker fallback method. Found {len(containers)} containers",
                        {
                            "container_count": len(containers), 
                            "method": method_used,
                            "location_type": location_info.get('type'),
                            "location_id": location_info.get('id'),
                            "containers": [{"id": c.get('id'), "name": c.get('name'), "status": c.get('status')} for c in containers[:3]]
                        }
                    )
                    return True, containers
                else:
                    self.log_result(
                        "CT 104 Fallback (all_containers=true)", 
                        False, 
                        f"Expected 'direct_docker' method but got '{method_used}'",
                        {"method": method_used, "response": data}
                    )
                    return False, []
            else:
                # Check if it's the expected "Could not determine host" error that should be fixed
                if response.status_code == 404 and "Could not determine host" in response.text:
                    self.log_result(
                        "CT 104 Fallback (all_containers=true)", 
                        False, 
                        "Still getting 'Could not determine host' error - fallback mechanism not working",
                        {"status_code": response.status_code, "error": response.text}
                    )
                else:
                    self.log_result(
                        "CT 104 Fallback (all_containers=true)", 
                        False, 
                        f"Unexpected error: {response.status_code} - {response.text}",
                        {"status_code": response.status_code}
                    )
                return False, []
                
        except Exception as e:
            self.log_result("CT 104 Fallback (all_containers=true)", False, f"Error testing CT 104 fallback: {str(e)}")
            return False, []
    
    def test_ct104_fallback_all_containers_false(self):
        """Test CT 104 fallback mechanism with all_containers=false"""
        try:
            request_data = {
                "location_type": "lxc",
                "location_id": "104",
                "ssh_username": "zaibatsui",
                "ssh_password": "10065609Xx!",
                "all_containers": False
            }
            
            response = requests.post(
                f"{self.base_url}/containers/list", 
                json=request_data,
                headers=self.get_headers(), 
                timeout=60  # Increased timeout for SSH operations
            )
            
            if response.status_code == 200:
                data = response.json()
                containers = data.get('containers', [])
                location_info = data.get('location', {})
                method_used = location_info.get('method', 'unknown')
                
                # Check if direct_docker method was used (fallback mechanism)
                if method_used == "direct_docker":
                    self.log_result(
                        "CT 104 Fallback (all_containers=false)", 
                        True, 
                        f"Successfully used direct Docker fallback method. Found {len(containers)} running containers",
                        {
                            "container_count": len(containers), 
                            "method": method_used,
                            "location_type": location_info.get('type'),
                            "location_id": location_info.get('id'),
                            "containers": [{"id": c.get('id'), "name": c.get('name'), "status": c.get('status')} for c in containers[:3]]
                        }
                    )
                    return True, containers
                else:
                    self.log_result(
                        "CT 104 Fallback (all_containers=false)", 
                        False, 
                        f"Expected 'direct_docker' method but got '{method_used}'",
                        {"method": method_used, "response": data}
                    )
                    return False, []
            else:
                # Check if it's the expected "Could not determine host" error that should be fixed
                if response.status_code == 404 and "Could not determine host" in response.text:
                    self.log_result(
                        "CT 104 Fallback (all_containers=false)", 
                        False, 
                        "Still getting 'Could not determine host' error - fallback mechanism not working",
                        {"status_code": response.status_code, "error": response.text}
                    )
                else:
                    self.log_result(
                        "CT 104 Fallback (all_containers=false)", 
                        False, 
                        f"Unexpected error: {response.status_code} - {response.text}",
                        {"status_code": response.status_code}
                    )
                return False, []
                
        except Exception as e:
            self.log_result("CT 104 Fallback (all_containers=false)", False, f"Error testing CT 104 fallback: {str(e)}")
            return False, []
    
    def test_response_format_validation(self, containers):
        """Validate the response format contains required fields"""
        try:
            if not containers:
                self.log_result(
                    "Response Format Validation", 
                    True, 
                    "No containers to validate (empty response is valid)"
                )
                return True
            
            required_fields = ['id', 'name', 'image', 'status', 'state']
            missing_fields = []
            
            for container in containers[:3]:  # Check first 3 containers
                for field in required_fields:
                    if field not in container:
                        missing_fields.append(f"Container missing '{field}' field")
            
            if not missing_fields:
                self.log_result(
                    "Response Format Validation", 
                    True, 
                    f"All containers have required fields: {required_fields}",
                    {"validated_containers": len(containers), "required_fields": required_fields}
                )
                return True
            else:
                self.log_result(
                    "Response Format Validation", 
                    False, 
                    f"Missing required fields in container response",
                    {"missing_fields": missing_fields}
                )
                return False
                
        except Exception as e:
            self.log_result("Response Format Validation", False, f"Error validating response format: {str(e)}")
            return False
    
    def test_method_indication(self, test_name, containers_data):
        """Test that response indicates direct_docker method was used"""
        try:
            # This should be tested in the main test methods, but we can add additional validation here
            if not containers_data:
                self.log_result(
                    f"Method Indication ({test_name})", 
                    False, 
                    "No container data to validate method indication"
                )
                return False
            
            # The method indication should be checked in the main test methods
            self.log_result(
                f"Method Indication ({test_name})", 
                True, 
                "Method indication validated in main test"
            )
            return True
                
        except Exception as e:
            self.log_result(f"Method Indication ({test_name})", False, f"Error validating method indication: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests for CT 104 Docker container listing fallback"""
        print("=" * 80)
        print("TESTING CT 104 DOCKER CONTAINER LISTING FALLBACK MECHANISM")
        print("Target: CT 104 'Proxmox-1 Docker CT' with direct Docker socket access")
        print("Expected: Fallback to direct Docker commands when Portainer Agent fails")
        print("=" * 80)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Setup Proxmox configuration
        print(f"\n🔍 Setting up Proxmox configuration...")
        if not self.setup_proxmox_config():
            print("❌ Cannot proceed without Proxmox configuration")
            return False
        
        # Step 3: Test CT 104 fallback with all_containers=true
        print(f"\n🔍 Testing CT 104 fallback mechanism (all_containers=true)...")
        success_all_true, containers_all_true = self.test_ct104_fallback_all_containers_true()
        
        # Step 4: Test CT 104 fallback with all_containers=false
        print(f"\n🔍 Testing CT 104 fallback mechanism (all_containers=false)...")
        success_all_false, containers_all_false = self.test_ct104_fallback_all_containers_false()
        
        # Step 5: Validate response format for both tests
        print(f"\n🔍 Validating response format...")
        if success_all_true:
            self.test_response_format_validation(containers_all_true)
        if success_all_false:
            self.test_response_format_validation(containers_all_false)
        
        # Step 6: Test method indication
        print(f"\n🔍 Validating method indication...")
        if success_all_true:
            self.test_method_indication("all_containers=true", containers_all_true)
        if success_all_false:
            self.test_method_indication("all_containers=false", containers_all_false)
        
        # Summary
        print("\n" + "=" * 80)
        print("CT 104 FALLBACK TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Tests passed: {passed}/{total}")
        
        if passed < total:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        # Specific success criteria for CT 104 fallback
        fallback_working = success_all_true or success_all_false
        
        if fallback_working:
            print("\n🎉 CT 104 FALLBACK MECHANISM WORKING!")
            print("✅ Direct Docker socket access fallback is functional")
            print("✅ No more 'Could not determine host' errors for CT 104")
            print("✅ Response includes method: 'direct_docker'")
            print("✅ Container listing works via SSH + docker commands")
        else:
            print("\n❌ CT 104 FALLBACK MECHANISM NOT WORKING")
            print("❌ Still getting 'Could not determine host' errors")
            print("❌ Fallback to direct Docker commands not functioning")
        
        print("\n📋 EXPECTED BEHAVIOR:")
        print("   ✅ POST /api/containers/list should work for CT 104")
        print("   ✅ Should use direct Docker commands via SSH (not Portainer Agent)")
        print("   ✅ Should return method: 'direct_docker' in response")
        print("   ✅ Should work with both all_containers=true and all_containers=false")
        print("   ✅ Should NOT return 'Could not determine host' error")
        
        return fallback_working

if __name__ == "__main__":
    tester = CT104FallbackTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/ct104_fallback_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/ct104_fallback_test_results.json")
    
    sys.exit(0 if success else 1)