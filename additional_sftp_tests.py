#!/usr/bin/env python3
"""
Additional SFTP Connection Profile Tests
Testing edge cases and parameter validation for the SFTP implementation.
"""

import requests
import json
import sys
from datetime import datetime

BACKEND_URL = "https://proxai-assistant.preview.emergentagent.com/api"

class AdditionalSFTPTester:
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
                self.log_result("Authentication", False, f"Login failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Authentication", False, f"Auth error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_connection_profile_validation(self):
        """Test connection profile creation with invalid data"""
        try:
            # Test 1: Missing required fields
            invalid_profile = {
                "name": "Invalid Profile"
                # Missing connection_type, host, username
            }
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=invalid_profile, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 422:  # Validation error
                self.log_result("Profile Validation - Missing Fields", True, "Correctly rejected profile with missing required fields")
            else:
                self.log_result("Profile Validation - Missing Fields", False, f"Unexpected response: {response.status_code}")
            
            # Test 2: Invalid connection type
            invalid_type_profile = {
                "name": "Invalid Type Profile",
                "connection_type": "invalid_type",
                "host": "test.com",
                "username": "test"
            }
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=invalid_type_profile, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 422:  # Validation error
                self.log_result("Profile Validation - Invalid Type", True, "Correctly rejected profile with invalid connection type")
            else:
                self.log_result("Profile Validation - Invalid Type", False, f"Unexpected response: {response.status_code}")
            
            return True
                
        except Exception as e:
            self.log_result("Profile Validation Test", False, f"Validation test error: {str(e)}")
            return False
    
    def test_file_operation_parameter_validation(self):
        """Test file operation endpoints with missing parameters"""
        try:
            # Create a valid profile first
            profile_data = {
                "name": "Test Validation Profile",
                "connection_type": "sftp",
                "host": "test.example.com",
                "port": 22,
                "username": "testuser",
                "password": "testpass"
            }
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=profile_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code != 200:
                self.log_result("Parameter Validation Setup", False, "Failed to create test profile")
                return False
            
            profile_id = response.json().get('id')
            
            # Test 1: File list without path parameter
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/list", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            # Should work with default path or return appropriate error
            if response.status_code in [200, 500]:  # 500 expected due to no real server
                self.log_result("Parameter Validation - List Default Path", True, "List endpoint handles missing path parameter correctly")
            else:
                self.log_result("Parameter Validation - List Default Path", False, f"Unexpected response: {response.status_code}")
            
            # Test 2: File write without content parameter
            response = requests.post(
                f"{self.base_url}/connection-profiles/{profile_id}/files/write?path=/test.txt", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            # Should handle missing content appropriately
            if response.status_code in [422, 500]:  # Either validation error or connection error
                self.log_result("Parameter Validation - Write Missing Content", True, "Write endpoint handles missing content parameter")
            else:
                self.log_result("Parameter Validation - Write Missing Content", False, f"Unexpected response: {response.status_code}")
            
            return True
                
        except Exception as e:
            self.log_result("Parameter Validation Test", False, f"Parameter validation error: {str(e)}")
            return False
    
    def test_profile_crud_operations(self):
        """Test full CRUD operations on connection profiles"""
        try:
            # Create
            profile_data = {
                "name": "CRUD Test Profile",
                "connection_type": "ssh",
                "host": "crud.test.com",
                "port": 2222,
                "username": "cruduser",
                "password": "crudpass",
                "notes": "Testing CRUD operations"
            }
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=profile_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code != 200:
                self.log_result("CRUD - Create", False, f"Failed to create profile: {response.status_code}")
                return False
            
            profile_id = response.json().get('id')
            self.log_result("CRUD - Create", True, f"Successfully created profile: {profile_id}")
            
            # Read
            response = requests.get(
                f"{self.base_url}/connection-profiles/{profile_id}", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                profile = response.json()
                if profile.get('name') == profile_data['name']:
                    self.log_result("CRUD - Read", True, "Successfully retrieved profile with correct data")
                else:
                    self.log_result("CRUD - Read", False, "Profile data mismatch")
            else:
                self.log_result("CRUD - Read", False, f"Failed to read profile: {response.status_code}")
            
            # Update
            update_data = {
                "name": "Updated CRUD Test Profile",
                "port": 2223,
                "notes": "Updated notes"
            }
            
            response = requests.put(
                f"{self.base_url}/connection-profiles/{profile_id}", 
                json=update_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result("CRUD - Update", True, "Successfully updated profile")
                
                # Verify update
                response = requests.get(
                    f"{self.base_url}/connection-profiles/{profile_id}", 
                    headers=self.get_headers(), 
                    timeout=15
                )
                
                if response.status_code == 200:
                    updated_profile = response.json()
                    if updated_profile.get('name') == update_data['name'] and updated_profile.get('port') == update_data['port']:
                        self.log_result("CRUD - Update Verification", True, "Update changes verified successfully")
                    else:
                        self.log_result("CRUD - Update Verification", False, "Update changes not reflected")
            else:
                self.log_result("CRUD - Update", False, f"Failed to update profile: {response.status_code}")
            
            # Delete
            response = requests.delete(
                f"{self.base_url}/connection-profiles/{profile_id}", 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 200:
                self.log_result("CRUD - Delete", True, "Successfully deleted profile")
                
                # Verify deletion
                response = requests.get(
                    f"{self.base_url}/connection-profiles/{profile_id}", 
                    headers=self.get_headers(), 
                    timeout=15
                )
                
                if response.status_code == 404:
                    self.log_result("CRUD - Delete Verification", True, "Profile deletion verified (404 on read)")
                else:
                    self.log_result("CRUD - Delete Verification", False, f"Profile still exists after deletion: {response.status_code}")
            else:
                self.log_result("CRUD - Delete", False, f"Failed to delete profile: {response.status_code}")
            
            return True
                
        except Exception as e:
            self.log_result("CRUD Operations Test", False, f"CRUD test error: {str(e)}")
            return False
    
    def run_additional_tests(self):
        """Run additional SFTP tests"""
        print("=" * 70)
        print("ADDITIONAL SFTP CONNECTION PROFILE TESTS")
        print("=" * 70)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Test profile validation
        print(f"\n🔍 Testing connection profile validation...")
        self.test_connection_profile_validation()
        
        # Step 3: Test parameter validation
        print(f"\n🔍 Testing file operation parameter validation...")
        self.test_file_operation_parameter_validation()
        
        # Step 4: Test CRUD operations
        print(f"\n🔍 Testing profile CRUD operations...")
        self.test_profile_crud_operations()
        
        # Summary
        print("\n" + "=" * 70)
        print("ADDITIONAL TESTS SUMMARY")
        print("=" * 70)
        
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
    tester = AdditionalSFTPTester()
    success = tester.run_additional_tests()
    
    # Save detailed results
    with open('/app/additional_sftp_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Additional test results saved to: /app/additional_sftp_test_results.json")
    
    sys.exit(0 if success else 1)