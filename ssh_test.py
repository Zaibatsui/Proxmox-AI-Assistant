#!/usr/bin/env python3
"""
Simple SSH connection test for CT 104
"""

import paramiko
import sys

def test_ssh_connection():
    """Test SSH connection to various targets"""
    
    # Test credentials
    username = "zaibatsui"
    password = "10065609Xx!"
    
    # Test targets
    targets = [
        "proxmox.zaibatsui.co.uk",
        "145.40.178.205",  # IP from the logs
        "ct104.local",
        "104.proxmox.zaibatsui.co.uk"
    ]
    
    for target in targets:
        print(f"\n🔍 Testing SSH connection to {target}...")
        try:
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh_client.connect(
                target,
                username=username,
                password=password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
            
            # Test a simple command
            stdin, stdout, stderr = ssh_client.exec_command('whoami')
            result = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            
            print(f"✅ SUCCESS: Connected to {target}")
            print(f"   whoami result: {result}")
            if error:
                print(f"   stderr: {error}")
            
            # Test Docker command
            stdin, stdout, stderr = ssh_client.exec_command('docker --version')
            docker_result = stdout.read().decode().strip()
            docker_error = stderr.read().decode().strip()
            
            if docker_result:
                print(f"   Docker version: {docker_result}")
            elif docker_error:
                print(f"   Docker error: {docker_error}")
            else:
                print(f"   Docker: No output")
            
            ssh_client.close()
            return target  # Return successful target
            
        except Exception as e:
            print(f"❌ FAILED: {target} - {str(e)}")
    
    return None

if __name__ == "__main__":
    successful_target = test_ssh_connection()
    if successful_target:
        print(f"\n🎉 Successfully connected to: {successful_target}")
    else:
        print(f"\n❌ All SSH connection attempts failed")
    
    sys.exit(0 if successful_target else 1)