#!/usr/bin/env python3

import requests
import json
from datetime import datetime, timezone

class AdminFilterDetailedTester:
    def __init__(self, base_url="https://admin-filter-dash.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        
    def login_admin(self):
        """Login as admin"""
        url = f"{self.base_url}/auth/login"
        data = {"username": "admin", "password": "admin123"}
        
        try:
            response = requests.post(url, json=data, timeout=30)
            if response.status_code == 200:
                result = response.json()
                self.token = result['token']
                print("✅ Admin login successful")
                return True
            else:
                print(f"❌ Admin login failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Admin login error: {e}")
            return False
    
    def test_endpoint_with_filters(self, endpoint_name, endpoint_path):
        """Test an endpoint with all filter variations"""
        print(f"\n🔍 Testing {endpoint_name} ({endpoint_path})")
        
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        
        # Test cases: owner_filter=all, owner_filter=mine, no filter (default)
        test_cases = [
            ("owner_filter=all", f"{endpoint_path}?owner_filter=all"),
            ("owner_filter=mine", f"{endpoint_path}?owner_filter=mine"),
            ("default (no filter)", endpoint_path)
        ]
        
        results = {}
        
        for test_name, url_path in test_cases:
            url = f"{self.base_url}/{url_path}"
            try:
                response = requests.get(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    # Count items in response
                    if isinstance(data, list):
                        count = len(data)
                    elif isinstance(data, dict):
                        if 'campaigns' in data:
                            count = len(data['campaigns'])
                        elif 'users' in data:
                            count = len(data['users'])
                        else:
                            count = len(data) if hasattr(data, '__len__') else 1
                    else:
                        count = 1
                    
                    results[test_name] = {
                        'status': 'SUCCESS',
                        'status_code': response.status_code,
                        'count': count
                    }
                    print(f"  ✅ {test_name}: {response.status_code} - {count} items")
                else:
                    results[test_name] = {
                        'status': 'FAILED',
                        'status_code': response.status_code,
                        'error': response.text[:100]
                    }
                    print(f"  ❌ {test_name}: {response.status_code} - {response.text[:100]}")
                    
            except Exception as e:
                results[test_name] = {
                    'status': 'ERROR',
                    'error': str(e)
                }
                print(f"  ❌ {test_name}: Error - {e}")
        
        return results
    
    def run_comprehensive_test(self):
        """Run comprehensive test of all admin filter endpoints"""
        print("🚀 Starting Comprehensive Admin Filter Test")
        print("=" * 60)
        
        if not self.login_admin():
            return False
        
        # Test all endpoints mentioned in the review request
        endpoints = [
            ("Campaigns Paginated", "campaigns/paginated"),
            ("Templates", "templates"),
            ("Connections", "connections"),
            ("Plans", "plans"),
            ("Admin All Users", "admin/all-users"),
            ("Invite Links", "invite-links")
        ]
        
        all_results = {}
        total_tests = 0
        passed_tests = 0
        
        for endpoint_name, endpoint_path in endpoints:
            results = self.test_endpoint_with_filters(endpoint_name, endpoint_path)
            all_results[endpoint_name] = results
            
            # Count results
            for test_name, result in results.items():
                total_tests += 1
                if result.get('status') == 'SUCCESS':
                    passed_tests += 1
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 60)
        
        for endpoint_name, results in all_results.items():
            print(f"\n{endpoint_name}:")
            for test_name, result in results.items():
                status_icon = "✅" if result.get('status') == 'SUCCESS' else "❌"
                print(f"  {status_icon} {test_name}: {result.get('status_code', 'N/A')}")
        
        print(f"\n🎯 OVERALL RESULTS: {passed_tests}/{total_tests} tests passed")
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if passed_tests == total_tests:
            print("🎉 ALL ADMIN FILTER TESTS PASSED!")
            return True
        else:
            print(f"⚠️ {total_tests - passed_tests} tests failed")
            return False

def main():
    tester = AdminFilterDetailedTester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())