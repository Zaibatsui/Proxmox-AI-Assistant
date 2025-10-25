#!/usr/bin/env python3
"""
Advanced Theme API Testing
Testing the extended theme API endpoints with new advanced appearance options.
"""

import requests
import json
import os
import sys
from datetime import datetime

# Get backend URL from frontend env
BACKEND_URL = "https://filemind-1.preview.emergentagent.com/api"

class ThemeAPITester:
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
        """Authenticate with test user"""
        try:
            # Try to register a new user for theme testing
            register_data = {
                "username": "theme_tester", 
                "password": "ThemeTest123!"
            }
            response = requests.post(f"{self.base_url}/auth/register", json=register_data, timeout=10)
            
            if response.status_code == 200:
                self.token = response.json()["token"]
                self.log_result("Authentication", True, "Registered and logged in successfully")
                return True
            elif response.status_code == 400 and "already exists" in response.text:
                # User exists, try login
                login_data = {
                    "username": "theme_tester", 
                    "password": "ThemeTest123!"
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
    
    def test_get_theme_default(self):
        """Test GET /api/theme when no theme exists - should return defaults"""
        try:
            response = requests.get(f"{self.base_url}/theme", headers=self.get_headers(), timeout=10)
            
            if response.status_code == 200:
                theme_data = response.json()
                
                # Check if all expected fields are present with default values
                expected_defaults = {
                    "theme_name": "cyan",
                    "background": "dark",
                    "card_style": "glass",
                    "accent_color": None,
                    "primary_color": None,
                    "secondary_color": None,
                    "sidebar_bg_color": None,
                    "header_bg_color": None,
                    "layout_density": "comfortable",
                    "border_radius": "rounded",
                    "shadow_intensity": "medium",
                    "sidebar_width": 256
                }
                
                missing_fields = []
                incorrect_defaults = []
                
                for field, expected_value in expected_defaults.items():
                    if field not in theme_data:
                        missing_fields.append(field)
                    elif theme_data[field] != expected_value:
                        incorrect_defaults.append({
                            "field": field,
                            "expected": expected_value,
                            "actual": theme_data[field]
                        })
                
                if missing_fields or incorrect_defaults:
                    self.log_result(
                        "GET Theme Defaults", 
                        False, 
                        f"Default theme values incorrect",
                        {
                            "missing_fields": missing_fields,
                            "incorrect_defaults": incorrect_defaults,
                            "received_data": theme_data
                        }
                    )
                    return False
                else:
                    self.log_result(
                        "GET Theme Defaults", 
                        True, 
                        "All default theme values correct",
                        {"theme_data": theme_data}
                    )
                    return True
            else:
                self.log_result("GET Theme Defaults", False, f"Failed to get theme: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET Theme Defaults", False, f"Error getting theme: {str(e)}")
            return False
    
    def test_post_theme_full(self):
        """Test POST /api/theme with all new advanced fields"""
        try:
            # Test data with all advanced appearance options
            theme_data = {
                "theme_name": "cyan",
                "background": "dark",
                "card_style": "glass",
                "accent_color": None,
                "primary_color": "59, 130, 246",
                "secondary_color": "99, 102, 241",
                "sidebar_bg_color": "15, 23, 42",
                "header_bg_color": "15, 23, 42",
                "layout_density": "comfortable",
                "border_radius": "rounded",
                "shadow_intensity": "medium",
                "sidebar_width": 256
            }
            
            response = requests.post(f"{self.base_url}/theme", json=theme_data, headers=self.get_headers(), timeout=10)
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check if response contains all the fields we sent
                missing_in_response = []
                for field in theme_data:
                    if field not in response_data:
                        missing_in_response.append(field)
                
                if missing_in_response:
                    self.log_result(
                        "POST Theme Full", 
                        False, 
                        f"Response missing fields: {missing_in_response}",
                        {"sent_data": theme_data, "response_data": response_data}
                    )
                    return False
                else:
                    self.log_result(
                        "POST Theme Full", 
                        True, 
                        "Successfully saved theme with all advanced fields",
                        {"response_data": response_data}
                    )
                    return True
            else:
                self.log_result("POST Theme Full", False, f"Failed to save theme: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST Theme Full", False, f"Error saving theme: {str(e)}")
            return False
    
    def test_get_theme_after_post(self):
        """Test GET /api/theme after POST - should return saved values"""
        try:
            response = requests.get(f"{self.base_url}/theme", headers=self.get_headers(), timeout=10)
            
            if response.status_code == 200:
                theme_data = response.json()
                
                # Expected values from the previous POST test
                expected_values = {
                    "theme_name": "cyan",
                    "background": "dark",
                    "card_style": "glass",
                    "accent_color": None,
                    "primary_color": "59, 130, 246",
                    "secondary_color": "99, 102, 241",
                    "sidebar_bg_color": "15, 23, 42",
                    "header_bg_color": "15, 23, 42",
                    "layout_density": "comfortable",
                    "border_radius": "rounded",
                    "shadow_intensity": "medium",
                    "sidebar_width": 256
                }
                
                mismatched_values = []
                for field, expected_value in expected_values.items():
                    if field not in theme_data:
                        mismatched_values.append({
                            "field": field,
                            "issue": "missing",
                            "expected": expected_value
                        })
                    elif theme_data[field] != expected_value:
                        mismatched_values.append({
                            "field": field,
                            "issue": "value_mismatch",
                            "expected": expected_value,
                            "actual": theme_data[field]
                        })
                
                if mismatched_values:
                    self.log_result(
                        "GET Theme After POST", 
                        False, 
                        f"Saved theme values don't match expected",
                        {
                            "mismatched_values": mismatched_values,
                            "received_data": theme_data
                        }
                    )
                    return False
                else:
                    self.log_result(
                        "GET Theme After POST", 
                        True, 
                        "All saved theme values match expected values",
                        {"theme_data": theme_data}
                    )
                    return True
            else:
                self.log_result("GET Theme After POST", False, f"Failed to get theme: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET Theme After POST", False, f"Error getting theme: {str(e)}")
            return False
    
    def test_post_theme_partial(self):
        """Test POST /api/theme with partial fields - should handle optional fields correctly"""
        try:
            # Test data with only some fields (testing optional field handling)
            partial_theme_data = {
                "theme_name": "purple",
                "background": "darker",
                "primary_color": "147, 51, 234",
                "layout_density": "compact",
                "border_radius": "very-rounded"
                # Missing: secondary_color, sidebar_bg_color, header_bg_color, shadow_intensity, sidebar_width
            }
            
            response = requests.post(f"{self.base_url}/theme", json=partial_theme_data, headers=self.get_headers(), timeout=10)
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check that provided fields are in response
                provided_fields_missing = []
                for field in partial_theme_data:
                    if field not in response_data:
                        provided_fields_missing.append(field)
                
                # Check that optional fields have default values
                expected_defaults_for_missing = {
                    "card_style": "glass",
                    "accent_color": None,
                    "secondary_color": None,
                    "sidebar_bg_color": None,
                    "header_bg_color": None,
                    "shadow_intensity": "medium",
                    "sidebar_width": 256
                }
                
                default_issues = []
                for field, expected_default in expected_defaults_for_missing.items():
                    if field in response_data and response_data[field] != expected_default:
                        default_issues.append({
                            "field": field,
                            "expected_default": expected_default,
                            "actual": response_data[field]
                        })
                
                if provided_fields_missing or default_issues:
                    self.log_result(
                        "POST Theme Partial", 
                        False, 
                        f"Partial theme save issues",
                        {
                            "provided_fields_missing": provided_fields_missing,
                            "default_issues": default_issues,
                            "sent_data": partial_theme_data,
                            "response_data": response_data
                        }
                    )
                    return False
                else:
                    self.log_result(
                        "POST Theme Partial", 
                        True, 
                        "Successfully handled partial theme data with correct defaults",
                        {"response_data": response_data}
                    )
                    return True
            else:
                self.log_result("POST Theme Partial", False, f"Failed to save partial theme: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST Theme Partial", False, f"Error saving partial theme: {str(e)}")
            return False
    
    def test_mongodb_persistence(self):
        """Test that theme data persists correctly in MongoDB by checking consistency"""
        try:
            # Save a specific theme
            test_theme = {
                "theme_name": "emerald",
                "background": "midnight",
                "card_style": "bordered",
                "primary_color": "16, 185, 129",
                "secondary_color": "5, 150, 105",
                "sidebar_bg_color": "6, 78, 59",
                "header_bg_color": "6, 78, 59",
                "layout_density": "spacious",
                "border_radius": "sharp",
                "shadow_intensity": "strong",
                "sidebar_width": 320
            }
            
            # POST the theme
            post_response = requests.post(f"{self.base_url}/theme", json=test_theme, headers=self.get_headers(), timeout=10)
            
            if post_response.status_code != 200:
                self.log_result("MongoDB Persistence", False, f"Failed to save test theme: {post_response.status_code}")
                return False
            
            # Wait a moment for database write
            import time
            time.sleep(1)
            
            # GET the theme back
            get_response = requests.get(f"{self.base_url}/theme", headers=self.get_headers(), timeout=10)
            
            if get_response.status_code != 200:
                self.log_result("MongoDB Persistence", False, f"Failed to retrieve theme: {get_response.status_code}")
                return False
            
            retrieved_theme = get_response.json()
            
            # Check if all values match exactly
            persistence_issues = []
            for field, expected_value in test_theme.items():
                if field not in retrieved_theme:
                    persistence_issues.append({
                        "field": field,
                        "issue": "missing_after_save",
                        "expected": expected_value
                    })
                elif retrieved_theme[field] != expected_value:
                    persistence_issues.append({
                        "field": field,
                        "issue": "value_changed",
                        "expected": expected_value,
                        "actual": retrieved_theme[field]
                    })
            
            if persistence_issues:
                self.log_result(
                    "MongoDB Persistence", 
                    False, 
                    f"Theme data not persisted correctly",
                    {
                        "persistence_issues": persistence_issues,
                        "saved_theme": test_theme,
                        "retrieved_theme": retrieved_theme
                    }
                )
                return False
            else:
                self.log_result(
                    "MongoDB Persistence", 
                    True, 
                    "Theme data persisted correctly in MongoDB",
                    {"verified_theme": retrieved_theme}
                )
                return True
                
        except Exception as e:
            self.log_result("MongoDB Persistence", False, f"Error testing persistence: {str(e)}")
            return False
    
    def test_field_validation(self):
        """Test field validation for advanced appearance options"""
        try:
            # Test invalid layout_density
            invalid_theme = {
                "theme_name": "test",
                "layout_density": "invalid_density"
            }
            
            response = requests.post(f"{self.base_url}/theme", json=invalid_theme, headers=self.get_headers(), timeout=10)
            
            # The API should either accept it (and use default) or reject it
            # Let's check what happens
            if response.status_code == 200:
                # Check if it used a default value
                response_data = response.json()
                if response_data.get("layout_density") in ["compact", "comfortable", "spacious"]:
                    self.log_result(
                        "Field Validation", 
                        True, 
                        "Invalid layout_density handled gracefully with default",
                        {"response": response_data}
                    )
                else:
                    self.log_result(
                        "Field Validation", 
                        False, 
                        f"Invalid layout_density accepted: {response_data.get('layout_density')}"
                    )
                    return False
            else:
                # API rejected invalid data - also acceptable
                self.log_result(
                    "Field Validation", 
                    True, 
                    f"Invalid data properly rejected: {response.status_code}",
                    {"error": response.text}
                )
            
            return True
                
        except Exception as e:
            self.log_result("Field Validation", False, f"Error testing validation: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all theme API tests"""
        print("=" * 70)
        print("TESTING ADVANCED THEME API ENDPOINTS")
        print("=" * 70)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Test GET /api/theme when no theme exists
        print(f"\n🔍 Testing GET /api/theme default values...")
        self.test_get_theme_default()
        
        # Step 3: Test POST /api/theme with all new fields
        print(f"\n🔍 Testing POST /api/theme with all advanced fields...")
        self.test_post_theme_full()
        
        # Step 4: Test GET /api/theme after POST
        print(f"\n🔍 Testing GET /api/theme after POST...")
        self.test_get_theme_after_post()
        
        # Step 5: Test POST /api/theme with partial fields
        print(f"\n🔍 Testing POST /api/theme with partial fields...")
        self.test_post_theme_partial()
        
        # Step 6: Test MongoDB persistence
        print(f"\n🔍 Testing MongoDB persistence...")
        self.test_mongodb_persistence()
        
        # Step 7: Test field validation
        print(f"\n🔍 Testing field validation...")
        self.test_field_validation()
        
        # Summary
        print("\n" + "=" * 70)
        print("THEME API TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Tests passed: {passed}/{total}")
        
        if passed < total:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return passed == total

if __name__ == "__main__":
    tester = ThemeAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/theme_api_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/theme_api_test_results.json")
    
    sys.exit(0 if success else 1)