"""
SSH Tunnel Manager for Portainer Agent connections.
Manages SSH tunnel lifecycle and connection pooling.
"""
import os
from typing import Dict, Optional, Tuple
from sshtunnel import SSHTunnelForwarder
import logging

logger = logging.getLogger(__name__)

class PortainerTunnelManager:
    """
    Manages SSH tunnels to remote Portainer Agent instances.
    Handles connection pooling and lifecycle management.
    """
    
    def __init__(self):
        self.tunnels: Dict[str, SSHTunnelForwarder] = {}
        self.tunnel_ports: Dict[str, int] = {}
    
    def _get_tunnel_key(self, host: str, port: int = 22) -> str:
        """Generate a unique key for tunnel identification."""
        return f"{host}:{port}"
    
    def create_tunnel(
        self, 
        remote_host: str,
        ssh_username: str,
        ssh_password: Optional[str] = None,
        ssh_private_key: Optional[str] = None,
        ssh_port: int = 22,
        portainer_port: int = 9001
    ) -> Tuple[str, int]:
        """
        Create or retrieve existing SSH tunnel to remote Portainer Agent.
        
        Args:
            remote_host: IP address or hostname of the remote VM
            ssh_username: SSH username
            ssh_password: SSH password (optional if using key)
            ssh_private_key: SSH private key content (optional)
            ssh_port: SSH port on the remote VM (default 22)
            portainer_port: Portainer Agent port on remote VM (default 9001)
        
        Returns:
            Tuple of (local_bind_address, local_bind_port)
        """
        tunnel_key = self._get_tunnel_key(remote_host, ssh_port)
        
        # Return existing tunnel if already established
        if tunnel_key in self.tunnels and self.tunnels[tunnel_key].is_active:
            return ("127.0.0.1", self.tunnel_ports[tunnel_key])
        
        try:
            # Determine authentication method
            ssh_auth = {
                "ssh_username": ssh_username
            }
            
            if ssh_private_key:
                # Write private key to temp file for paramiko
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.key') as key_file:
                    key_file.write(ssh_private_key)
                    key_path = key_file.name
                ssh_auth["ssh_pkey"] = key_path
                auth_method = "key"
            elif ssh_password:
                ssh_auth["ssh_password"] = ssh_password
                auth_method = "password"
            else:
                raise ValueError("Either SSH password or private key must be provided")
            
            logger.info(
                f"Creating SSH tunnel to {remote_host}:{ssh_port} "
                f"using {auth_method} authentication"
            )
            
            # Create tunnel with OS-assigned local port
            tunnel = SSHTunnelForwarder(
                (remote_host, ssh_port),
                remote_bind_address=("127.0.0.1", portainer_port),
                local_bind_address=("127.0.0.1", 0),  # OS assigns available port
                **ssh_auth
            )
            
            tunnel.start()
            local_port = tunnel.local_bind_port
            
            # Store tunnel for reuse
            self.tunnels[tunnel_key] = tunnel
            self.tunnel_ports[tunnel_key] = local_port
            
            logger.info(
                f"Tunnel to {remote_host} established at "
                f"127.0.0.1:{local_port}"
            )
            
            return ("127.0.0.1", local_port)
        
        except Exception as e:
            logger.error(f"Failed to create tunnel to {remote_host}: {str(e)}")
            raise
    
    def get_tunnel_endpoint(
        self, 
        remote_host: str,
        ssh_port: int = 22
    ) -> str:
        """Get the local endpoint URL for accessing remote Portainer Agent."""
        tunnel_key = self._get_tunnel_key(remote_host, ssh_port)
        
        if tunnel_key in self.tunnel_ports:
            local_port = self.tunnel_ports[tunnel_key]
            return f"http://127.0.0.1:{local_port}"
        
        raise ValueError(f"No tunnel established to {remote_host}")
    
    def close_tunnel(self, remote_host: str, ssh_port: int = 22) -> None:
        """Close SSH tunnel to specified host."""
        tunnel_key = self._get_tunnel_key(remote_host, ssh_port)
        
        if tunnel_key in self.tunnels:
            try:
                self.tunnels[tunnel_key].stop()
                del self.tunnels[tunnel_key]
                del self.tunnel_ports[tunnel_key]
                logger.info(f"Closed tunnel to {remote_host}")
            except Exception as e:
                logger.error(f"Error closing tunnel to {remote_host}: {str(e)}")
    
    def close_all_tunnels(self) -> None:
        """Close all active SSH tunnels."""
        for tunnel_key in list(self.tunnels.keys()):
            try:
                self.tunnels[tunnel_key].stop()
            except Exception as e:
                logger.warning(f"Error closing tunnel {tunnel_key}: {str(e)}")
        
        self.tunnels.clear()
        self.tunnel_ports.clear()
        logger.info("All tunnels closed")
    
    def __del__(self):
        """Ensure tunnels are closed on object destruction."""
        self.close_all_tunnels()

# Global tunnel manager instance
tunnel_manager = PortainerTunnelManager()
