#!/usr/bin/env python3
"""
Connection Profile Save Issue Test
Testing the specific "Failed to save connection profile" issue reported by the user.
"""

import requests
import json
import os
import sys
from datetime import datetime

# Get backend URL from frontend env
BACKEND_URL = "https://proxwizard.preview.emergentagent.com/api"

class ConnectionProfileSaveTest:
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
            print(f"   Details: {json.dumps(details, indent=2)}")
    
    def authenticate(self):
        """Authenticate with test user or create one"""
        try:
            # Try to register a new test user first
            register_data = {
                "username": "profile_save_tester", 
                "password": "SaveTest123!"
            }
            response = requests.post(f"{self.base_url}/auth/register", json=register_data, timeout=10)
            
            if response.status_code == 200:
                self.token = response.json()["token"]
                self.log_result("User Authentication", True, "Registered and logged in successfully")
                return True
            elif response.status_code == 400 and "already exists" in response.text:
                # User exists, try login
                login_data = {
                    "username": "profile_save_tester", 
                    "password": "SaveTest123!"
                }
                response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
                if response.status_code == 200:
                    self.token = response.json()["token"]
                    self.log_result("User Authentication", True, "Logged in successfully")
                    return True
                else:
                    self.log_result("User Authentication", False, f"Login failed: {response.status_code} - {response.text}")
                    return False
            else:
                self.log_result("User Authentication", False, f"Registration failed: {response.status_code} - {response.text}")
                return False
            
        except Exception as e:
            self.log_result("User Authentication", False, f"Auth error: {str(e)}")
            return False
    
    def get_headers(self):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_sftp_profile_creation(self):
        """Test creating SFTP connection profile with exact user-reported data"""
        try:
            # Exact data from the review request
            profile_data = {
                "name": "Test SFTP",
                "connection_type": "sftp",
                "host": "test.example.com",
                "port": 22,
                "username": "testuser",
                "password": "testpassword",
                "base_path": "/"
            }
            
            print(f"Creating SFTP profile with data: {json.dumps(profile_data, indent=2)}")
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=profile_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                profile_id = result.get('id')
                self.log_result(
                    "SFTP Profile Creation", 
                    True, 
                    f"Successfully created SFTP profile with ID: {profile_id}",
                    {"profile_id": profile_id, "response": result}
                )
                return profile_id
            else:
                self.log_result(
                    "SFTP Profile Creation", 
                    False, 
                    f"Failed to create SFTP profile: {response.status_code} - {response.text}",
                    {"status_code": response.status_code, "response_body": response.text}
                )
                return None
                
        except Exception as e:
            self.log_result("SFTP Profile Creation", False, f"SFTP profile creation error: {str(e)}")
            return None
    
    def test_ssh_profile_creation(self):
        """Test creating SSH connection profile"""
        try:
            profile_data = {
                "name": "Test SSH",
                "connection_type": "ssh",
                "host": "test.example.com",
                "port": 22,
                "username": "testuser",
                "password": "testpassword",
                "base_path": "/"
            }
            
            print(f"Creating SSH profile with data: {json.dumps(profile_data, indent=2)}")
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=profile_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                profile_id = result.get('id')
                self.log_result(
                    "SSH Profile Creation", 
                    True, 
                    f"Successfully created SSH profile with ID: {profile_id}",
                    {"profile_id": profile_id, "response": result}
                )
                return profile_id
            else:
                self.log_result(
                    "SSH Profile Creation", 
                    False, 
                    f"Failed to create SSH profile: {response.status_code} - {response.text}",
                    {"status_code": response.status_code, "response_body": response.text}
                )
                return None
                
        except Exception as e:
            self.log_result("SSH Profile Creation", False, f"SSH profile creation error: {str(e)}")
            return None
    
    def test_ftp_profile_creation(self):
        """Test creating FTP connection profile"""
        try:
            profile_data = {
                "name": "Test FTP",
                "connection_type": "ftp",
                "host": "test.example.com",
                "port": 21,
                "username": "testuser",
                "password": "testpassword",
                "base_path": "/"
            }
            
            print(f"Creating FTP profile with data: {json.dumps(profile_data, indent=2)}")
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=profile_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                profile_id = result.get('id')
                self.log_result(
                    "FTP Profile Creation", 
                    True, 
                    f"Successfully created FTP profile with ID: {profile_id}",
                    {"profile_id": profile_id, "response": result}
                )
                return profile_id
            else:
                self.log_result(
                    "FTP Profile Creation", 
                    False, 
                    f"Failed to create FTP profile: {response.status_code} - {response.text}",
                    {"status_code": response.status_code, "response_body": response.text}
                )
                return None
                
        except Exception as e:
            self.log_result("FTP Profile Creation", False, f"FTP profile creation error: {str(e)}")
            return None
    
    def verify_profile_creation(self, profile_id, expected_name):
        """Verify profile was created by listing all profiles"""
        try:
            response = requests.get(f"{self.base_url}/connection-profiles", headers=self.get_headers(), timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                profiles = data.get('profiles', [])
                
                # Look for our created profile
                found_profile = None
                for profile in profiles:
                    if profile.get('id') == profile_id:
                        found_profile = profile
                        break
                
                if found_profile:
                    self.log_result(
                        "Profile Verification", 
                        True, 
                        f"Successfully verified profile '{expected_name}' exists in database",
                        {"profile": found_profile}
                    )
                    return True
                else:
                    self.log_result(
                        "Profile Verification", 
                        False, 
                        f"Profile '{expected_name}' with ID {profile_id} not found in profile list",
                        {"total_profiles": len(profiles), "profile_ids": [p.get('id') for p in profiles]}
                    )
                    return False
            else:
                self.log_result("Profile Verification", False, f"Failed to get profiles: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Profile Verification", False, f"Profile verification error: {str(e)}")
            return False
    
    def test_invalid_data_validation(self):
        """Test validation with invalid data"""
        try:
            # Test missing required fields
            invalid_data = {
                "name": "Invalid Profile",
                # Missing connection_type, host, username
                "port": 22
            }
            
            response = requests.post(
                f"{self.base_url}/connection-profiles", 
                json=invalid_data, 
                headers=self.get_headers(), 
                timeout=15
            )
            
            if response.status_code == 422:  # Validation error
                self.log_result(
                    "Invalid Data Validation", 
                    True, 
                    "Correctly rejected invalid profile data with validation error",
                    {"status_code": response.status_code, "response": response.text}
                )
                return True
            else:
                self.log_result(
                    "Invalid Data Validation", 
                    False, 
                    f"Expected validation error (422) but got: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result("Invalid Data Validation", False, f"Validation test error: {str(e)}")
            return False
    
    def run_connection_profile_save_tests(self):
        """Run focused tests for connection profile save issue"""
        print("=" * 80)
        print("TESTING CONNECTION PROFILE SAVE ISSUE")
        print("=" * 80)
        print("Testing the specific 'Failed to save connection profile' issue reported by user")
        print()
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Test SFTP profile creation (exact user data)
        print(f"\n🔍 Testing SFTP profile creation with exact user data...")
        sftp_profile_id = self.test_sftp_profile_creation()
        
        # Step 3: Verify SFTP profile was saved
        if sftp_profile_id:
            print(f"\n🔍 Verifying SFTP profile was saved to database...")
            self.verify_profile_creation(sftp_profile_id, "Test SFTP")
        
        # Step 4: Test SSH profile creation
        print(f"\n🔍 Testing SSH profile creation...")
        ssh_profile_id = self.test_ssh_profile_creation()
        
        # Step 5: Verify SSH profile was saved
        if ssh_profile_id:
            print(f"\n🔍 Verifying SSH profile was saved to database...")
            self.verify_profile_creation(ssh_profile_id, "Test SSH")
        
        # Step 6: Test FTP profile creation
        print(f"\n🔍 Testing FTP profile creation...")
        ftp_profile_id = self.test_ftp_profile_creation()
        
        # Step 7: Verify FTP profile was saved
        if ftp_profile_id:
            print(f"\n🔍 Verifying FTP profile was saved to database...")
            self.verify_profile_creation(ftp_profile_id, "Test FTP")
        
        # Step 8: Test validation with invalid data
        print(f"\n🔍 Testing validation with invalid data...")
        self.test_invalid_data_validation()
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        failed = total - passed
        
        print(f"Tests passed: {passed}/{total}")
        
        if failed > 0:
            print(f"\n❌ FAILED TESTS ({failed}):")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
                    if result.get('details'):
                        print(f"    Details: {result['details']}")
        else:
            print("\n✅ All tests passed!")
        
        # Specific analysis for the user's issue
        print("\n" + "=" * 80)
        print("ISSUE ANALYSIS")
        print("=" * 80)
        
        sftp_success = any(r['test'] == 'SFTP Profile Creation' and r['success'] for r in self.test_results)
        ssh_success = any(r['test'] == 'SSH Profile Creation' and r['success'] for r in self.test_results)
        ftp_success = any(r['test'] == 'FTP Profile Creation' and r['success'] for r in self.test_results)
        
        if sftp_success and ssh_success and ftp_success:
            print("✅ Connection profile creation is working correctly for all types (SFTP, SSH, FTP)")
            print("✅ The 'Failed to save connection profile' issue is NOT reproducible")
            print("📋 Possible causes for user's issue:")
            print("   - Temporary network connectivity issue")
            print("   - Browser/frontend caching issue")
            print("   - Specific data validation issue not covered in tests")
        elif not sftp_success:
            print("❌ SFTP profile creation is failing - this matches the user's report")
            print("📋 Root cause analysis needed for SFTP profile save functionality")
        else:
            print(f"⚠️  Mixed results: SFTP={sftp_success}, SSH={ssh_success}, FTP={ftp_success}")
            print("📋 Issue may be specific to certain connection types or data combinations")
        
        return failed == 0

if __name__ == "__main__":
    tester = ConnectionProfileSaveTest()
    success = tester.run_connection_profile_save_tests()
    
    # Save detailed results
    with open('/app/connection_profile_save_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/connection_profile_save_test_results.json")
    
    sys.exit(0 if success else 1)