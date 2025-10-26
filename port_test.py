#!/usr/bin/env python3
"""
Test port connectivity
"""

import socket
import sys

def test_port(host, port, timeout=5):
    """Test if a port is open"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception as e:
        print(f"Error testing {host}:{port} - {str(e)}")
        return False

def main():
    host = "145.40.178.205"
    ports = [22, 2222, 8022, 22222, 8006, 443, 80]
    
    print(f"Testing connectivity to {host}...")
    
    for port in ports:
        if test_port(host, port):
            print(f"✅ Port {port} is OPEN")
        else:
            print(f"❌ Port {port} is CLOSED or filtered")

if __name__ == "__main__":
    main()