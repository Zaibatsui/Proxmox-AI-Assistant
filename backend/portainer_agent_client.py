"""
Portainer Agent API client for Docker container management.
Provides async HTTP client for interacting with Portainer Agent through SSH tunnels.
"""
import httpx
import io
import tarfile
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from portainer_tunnel_manager import tunnel_manager
import logging

logger = logging.getLogger(__name__)

@dataclass
class Container:
    """Container representation from Portainer Agent."""
    id: str
    name: str
    image: str
    status: str
    state: str
    
    @classmethod
    def from_docker_api(cls, data: Dict) -> "Container":
        """Create Container from Docker API response."""
        names = data.get("Names", [])
        container_name = names[0].lstrip("/") if names else "unknown"
        
        return cls(
            id=data.get("Id", "")[:12],
            name=container_name,
            image=data.get("Image", ""),
            status=data.get("Status", ""),
            state=data.get("State", "")
        )

class PortainerAgentClient:
    """
    Async HTTP client for Portainer Agent API.
    Handles both Docker API proxy endpoints and agent-specific file browse endpoints.
    """
    
    def __init__(
        self,
        remote_host: str,
        ssh_username: str,
        ssh_password: Optional[str] = None,
        ssh_private_key: Optional[str] = None,
        ssh_port: int = 22
    ):
        self.remote_host = remote_host
        self.ssh_username = ssh_username
        self.ssh_password = ssh_password
        self.ssh_private_key = ssh_private_key
        self.ssh_port = ssh_port
        self._client: Optional[httpx.AsyncClient] = None
        self._local_port: Optional[int] = None
    
    async def _ensure_tunnel(self) -> int:
        """Ensure SSH tunnel exists and return local port."""
        if self._local_port is None:
            _, local_port = tunnel_manager.create_tunnel(
                self.remote_host,
                self.ssh_username,
                self.ssh_password,
                self.ssh_private_key,
                self.ssh_port
            )
            self._local_port = local_port
        return self._local_port
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            # Create client with longer timeout for file operations
            self._client = httpx.AsyncClient(
                timeout=30.0,
                verify=False  # Self-signed certs from Portainer Agent
            )
        return self._client
    
    async def get_endpoint_url(self) -> str:
        """Get the full endpoint URL for API calls."""
        local_port = await self._ensure_tunnel()
        return f"http://127.0.0.1:{local_port}"
    
    async def list_containers(
        self,
        all_containers: bool = True
    ) -> List[Container]:
        """
        List all containers on the remote Docker daemon.
        
        Args:
            all_containers: Include stopped containers if True
        
        Returns:
            List of Container objects
        """
        try:
            client = await self._get_client()
            endpoint_url = await self.get_endpoint_url()
            
            # Portainer Agent /docker endpoint acts as a transparent proxy
            url = f"{endpoint_url}/docker/containers/json"
            params = {"all": "true" if all_containers else "false"}
            
            logger.debug(f"Listing containers from {self.remote_host}")
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            containers_data = response.json()
            containers = [
                Container.from_docker_api(data) 
                for data in containers_data
            ]
            
            logger.info(
                f"Retrieved {len(containers)} containers "
                f"from {self.remote_host}"
            )
            return containers
        
        except Exception as e:
            logger.error(f"Failed to list containers: {str(e)}")
            raise
    
    async def get_container_details(self, container_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific container."""
        try:
            client = await self._get_client()
            endpoint_url = await self.get_endpoint_url()
            
            url = f"{endpoint_url}/docker/containers/{container_id}/json"
            response = await client.get(url)
            response.raise_for_status()
            
            return response.json()
        
        except Exception as e:
            logger.error(
                f"Failed to get container {container_id} details: {str(e)}"
            )
            raise
    
    async def list_directory(self, path: str) -> List[Dict[str, Any]]:
        """
        Browse directory contents using Portainer Agent browse endpoint.
        
        Args:
            path: Absolute path to browse
        
        Returns:
            List of file/directory information
        """
        try:
            client = await self._get_client()
            endpoint_url = await self.get_endpoint_url()
            
            url = f"{endpoint_url}/browse/ls"
            params = {"path": path}
            
            logger.debug(f"Listing directory: {path}")
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            files = response.json()
            logger.info(f"Retrieved {len(files)} items from {path}")
            return files
        
        except Exception as e:
            logger.error(f"Failed to list directory {path}: {str(e)}")
            raise
    
    async def get_file(self, path: str) -> bytes:
        """
        Download a file from the remote host.
        
        Args:
            path: Absolute path to file
        
        Returns:
            File contents as bytes
        """
        try:
            client = await self._get_client()
            endpoint_url = await self.get_endpoint_url()
            
            url = f"{endpoint_url}/browse/get"
            params = {"path": path}
            
            logger.debug(f"Downloading file: {path}")
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            logger.info(f"Downloaded {len(response.content)} bytes from {path}")
            return response.content
        
        except Exception as e:
            logger.error(f"Failed to download file {path}: {str(e)}")
            raise
    
    async def extract_file_from_container(
        self,
        container_id: str,
        container_path: str
    ) -> bytes:
        """
        Extract file from container filesystem using Docker cp mechanism.
        Returns a tar archive containing the file.
        
        Args:
            container_id: Container ID or name
            container_path: Path inside container
        
        Returns:
            Tar archive contents as bytes
        """
        try:
            client = await self._get_client()
            endpoint_url = await self.get_endpoint_url()
            
            # Docker API endpoint for getting file archive from container
            url = (
                f"{endpoint_url}/docker/containers/{container_id}/"
                f"archive"
            )
            params = {"path": container_path}
            
            logger.debug(f"Extracting {container_path} from container {container_id}")
            response = await client.get(url, params=params)
            response.raise_for_status()
            
            logger.info(f"Extracted {len(response.content)} bytes from container")
            return response.content
        
        except Exception as e:
            logger.error(
                f"Failed to extract {container_path} from container: {str(e)}"
            )
            raise
    
    async def put_file_in_container(
        self,
        container_id: str,
        container_path: str,
        file_content: bytes,
        filename: str
    ) -> Dict[str, Any]:
        """
        Copy file into container using Docker cp mechanism.
        
        Args:
            container_id: Container ID or name
            container_path: Destination directory path inside container
            file_content: File contents as bytes
            filename: Name of file
        
        Returns:
            Response from operation
        """
        try:
            client = await self._get_client()
            endpoint_url = await self.get_endpoint_url()
            
            # Create tar archive with the file
            tar_buffer = io.BytesIO()
            with tarfile.open(fileobj=tar_buffer, mode="w") as tar:
                tar_info = tarfile.TarInfo(name=filename)
                tar_info.size = len(file_content)
                tar.addfile(tar_info, io.BytesIO(file_content))
            
            tar_buffer.seek(0)
            
            # Docker API endpoint for putting file in container
            url = (
                f"{endpoint_url}/docker/containers/{container_id}/"
                f"archive"
            )
            params = {"path": container_path}
            
            logger.debug(
                f"Copying {filename} to {container_path} in container {container_id}"
            )
            response = await client.put(
                url,
                params=params,
                content=tar_buffer.getvalue(),
                headers={"Content-Type": "application/x-tar"}
            )
            response.raise_for_status()
            
            logger.info(f"Successfully copied file to container")
            return {"status": "success"}
        
        except Exception as e:
            logger.error(
                f"Failed to copy file to container: {str(e)}"
            )
            raise
    
    async def list_container_directory(
        self,
        container_id: str,
        container_path: str
    ) -> List[Dict[str, Any]]:
        """
        List directory contents inside a container by extracting and reading tar archive.
        
        Args:
            container_id: Container ID or name
            container_path: Directory path inside container
        
        Returns:
            List of file/directory information
        """
        try:
            # Extract tar archive of the directory
            tar_data = await self.extract_file_from_container(container_id, container_path)
            
            # Parse tar archive to get file list
            files = []
            tar_buffer = io.BytesIO(tar_data)
            
            with tarfile.open(fileobj=tar_buffer, mode="r") as tar:
                for member in tar.getmembers():
                    # Skip the root directory itself
                    if member.name == ".":
                        continue
                    
                    files.append({
                        "name": member.name.split("/")[-1],  # Get basename
                        "path": member.name,
                        "size": member.size,
                        "isDir": member.isdir(),
                        "mode": member.mode,
                        "mtime": member.mtime
                    })
            
            logger.info(f"Listed {len(files)} items from container directory")
            return files
        
        except Exception as e:
            logger.error(f"Failed to list container directory: {str(e)}")
            raise
    
    async def read_container_file(
        self,
        container_id: str,
        file_path: str
    ) -> bytes:
        """
        Read a single file from container.
        
        Args:
            container_id: Container ID or name
            file_path: File path inside container
        
        Returns:
            File contents as bytes
        """
        try:
            # Extract tar archive containing the file
            tar_data = await self.extract_file_from_container(container_id, file_path)
            
            # Extract file content from tar
            tar_buffer = io.BytesIO(tar_data)
            with tarfile.open(fileobj=tar_buffer, mode="r") as tar:
                # Get the first member (should be our file)
                members = tar.getmembers()
                if not members:
                    raise ValueError(f"File not found in archive: {file_path}")
                
                file_member = members[0]
                extracted_file = tar.extractfile(file_member)
                
                if extracted_file is None:
                    raise ValueError(f"Cannot read file: {file_path}")
                
                content = extracted_file.read()
                logger.info(f"Read {len(content)} bytes from container file")
                return content
        
        except Exception as e:
            logger.error(f"Failed to read container file: {str(e)}")
            raise
    
    async def close(self) -> None:
        """Close HTTP client and SSH tunnel."""
        if self._client:
            await self._client.aclose()
        tunnel_manager.close_tunnel(self.remote_host, self.ssh_port)
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
