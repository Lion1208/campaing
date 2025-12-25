#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone
import time

class WhatsAppCampaignTester:
    def __init__(self, base_url="https://chatbot-hub-33.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", error=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")
        if error:
            print(f"    Error: {error}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    self.log_test(name, True, f"Status: {response.status_code}", "")
                    return True, response_data
                except:
                    self.log_test(name, True, f"Status: {response.status_code} (no JSON)", "")
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status {response.status_code}')
                except:
                    error_msg = f'Status {response.status_code}'
                
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}", error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, "", str(e))
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.admin_user = response['user']
            return True
        return False

    def test_auth_me(self):
        """Test auth/me endpoint"""
        success, response = self.run_test("Get Current User", "GET", "auth/me", 200)
        return success and response.get('username') == 'admin'

    def test_dashboard_stats(self):
        """Test dashboard stats"""
        success, response = self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)
        
        if success:
            required_fields = ['total_connections', 'active_connections', 'total_campaigns', 'pending_campaigns', 'completed_campaigns', 'total_groups', 'total_messages_sent']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                self.log_test("Dashboard Stats Fields", False, "", f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Dashboard Stats Fields", True, "All required fields present", "")
        
        return success

    def test_connections_crud(self):
        """Test connections CRUD operations"""
        # List connections (should be empty initially)
        success, connections = self.run_test("List Connections", "GET", "connections", 200)
        if not success:
            return False

        # Create connection
        success, connection = self.run_test(
            "Create Connection",
            "POST",
            "connections",
            200,
            data={"name": "Test Connection"}
        )
        if not success:
            return False

        connection_id = connection.get('id')
        if not connection_id:
            self.log_test("Create Connection ID", False, "", "No connection ID returned")
            return False

        # Get specific connection
        success, _ = self.run_test(
            "Get Connection",
            "GET",
            f"connections/{connection_id}",
            200
        )
        if not success:
            return False

        # Connect WhatsApp (generate QR)
        success, qr_response = self.run_test(
            "Connect WhatsApp",
            "POST",
            f"connections/{connection_id}/connect",
            200
        )
        if not success:
            return False

        # Simulate connection
        success, sim_response = self.run_test(
            "Simulate Connection",
            "POST",
            f"connections/{connection_id}/simulate-connect",
            200
        )
        if not success:
            return False

        # List groups (should have some after simulation)
        success, groups = self.run_test(
            "List Groups for Connection",
            "GET",
            f"connections/{connection_id}/groups",
            200
        )
        if success and len(groups) > 0:
            self.log_test("Groups Created After Simulation", True, f"Found {len(groups)} groups", "")
        else:
            self.log_test("Groups Created After Simulation", False, "", "No groups found after simulation")

        # Disconnect
        success, _ = self.run_test(
            "Disconnect WhatsApp",
            "POST",
            f"connections/{connection_id}/disconnect",
            200
        )
        if not success:
            return False

        # Delete connection
        success, _ = self.run_test(
            "Delete Connection",
            "DELETE",
            f"connections/{connection_id}",
            200
        )
        
        return success

    def test_campaigns_crud(self):
        """Test campaigns CRUD operations"""
        # First create a connection and simulate it
        success, connection = self.run_test(
            "Create Connection for Campaign",
            "POST",
            "connections",
            200,
            data={"name": "Campaign Test Connection"}
        )
        if not success:
            return False

        connection_id = connection.get('id')
        
        # Simulate connection to get groups
        success, _ = self.run_test(
            "Simulate Connection for Campaign",
            "POST",
            f"connections/{connection_id}/simulate-connect",
            200
        )
        if not success:
            return False

        # Get groups
        success, groups = self.run_test(
            "Get Groups for Campaign",
            "GET",
            f"connections/{connection_id}/groups",
            200
        )
        if not success or len(groups) == 0:
            self.log_test("Groups Available for Campaign", False, "", "No groups available")
            return False

        group_ids = [group['id'] for group in groups[:2]]  # Use first 2 groups

        # Create campaign
        campaign_data = {
            "title": "Test Campaign",
            "connection_id": connection_id,
            "group_ids": group_ids,
            "message": "Test message for campaign",
            "scheduled_time": datetime.now(timezone.utc).isoformat(),
            "delay_seconds": 5
        }

        success, campaign = self.run_test(
            "Create Campaign",
            "POST",
            "campaigns",
            200,
            data=campaign_data
        )
        if not success:
            return False

        campaign_id = campaign.get('id')

        # List campaigns
        success, campaigns = self.run_test("List Campaigns", "GET", "campaigns", 200)
        if not success:
            return False

        # Get specific campaign
        success, _ = self.run_test(
            "Get Campaign",
            "GET",
            f"campaigns/{campaign_id}",
            200
        )
        if not success:
            return False

        # Wait a bit for campaign to potentially execute
        time.sleep(2)

        # Delete campaign
        success, _ = self.run_test(
            "Delete Campaign",
            "DELETE",
            f"campaigns/{campaign_id}",
            200
        )
        if not success:
            return False

        # Clean up connection
        self.run_test(
            "Delete Campaign Connection",
            "DELETE",
            f"connections/{connection_id}",
            200
        )

        return True

    def test_admin_users_crud(self):
        """Test admin user management"""
        # List users
        success, users = self.run_test("List Users", "GET", "admin/users", 200)
        if not success:
            return False

        # Create user
        user_data = {
            "username": f"testuser_{int(time.time())}",
            "password": "testpass123",
            "max_connections": 2
        }

        success, user = self.run_test(
            "Create User",
            "POST",
            "admin/users",
            200,
            data=user_data
        )
        if not success:
            return False

        user_id = user.get('id')

        # Update user
        update_data = {
            "max_connections": 3,
            "active": True
        }

        success, _ = self.run_test(
            "Update User",
            "PUT",
            f"admin/users/{user_id}",
            200,
            data=update_data
        )
        if not success:
            return False

        # Delete user
        success, _ = self.run_test(
            "Delete User",
            "DELETE",
            f"admin/users/{user_id}",
            200
        )

        return success

    def test_admin_stats(self):
        """Test admin stats"""
        success, response = self.run_test("Admin Stats", "GET", "admin/stats", 200)
        
        if success:
            required_fields = ['total_users', 'active_users', 'total_connections', 'active_connections', 'total_campaigns']
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                self.log_test("Admin Stats Fields", False, "", f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Admin Stats Fields", True, "All required fields present", "")
        
        return success

    def run_all_tests(self):
        """Run all tests"""
        print(f"🚀 Starting WhatsApp Campaign Manager API Tests")
        print(f"📡 Base URL: {self.base_url}")
        print("=" * 60)

        # Basic connectivity
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return False

        # Authentication
        if not self.test_admin_login():
            print("❌ Admin login failed - stopping tests")
            return False

        if not self.test_auth_me():
            print("❌ Auth verification failed")
            return False

        # Dashboard
        self.test_dashboard_stats()

        # Core functionality
        self.test_connections_crud()
        self.test_campaigns_crud()

        # Admin functionality
        self.test_admin_users_crud()
        self.test_admin_stats()

        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

    def get_test_results(self):
        """Get detailed test results"""
        return {
            "summary": {
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "failed_tests": self.tests_run - self.tests_passed,
                "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
            },
            "test_results": self.test_results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

def main():
    tester = WhatsAppCampaignTester()
    success = tester.run_all_tests()
    
    # Save results
    results = tester.get_test_results()
    with open('/app/test_reports/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())