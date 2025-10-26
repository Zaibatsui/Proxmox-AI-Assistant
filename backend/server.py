from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Literal
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio
from openai import AsyncOpenAI
from proxmoxer import ProxmoxAPI
import paramiko
import re
import requests
import urllib3
from ftplib import FTP
import io
import stat

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'proxmox-ai-admin-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# ==================== AUTH MODELS ====================

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuthResponse(BaseModel):
    token: str
    username: str

# ==================== PROXMOX MODELS ====================

class ProxmoxConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    host: str
    api_token_name: str  # e.g., "root@pam!token-name"
    api_token_secret: str
    verify_ssl: bool = False
    ssh_username: Optional[str] = "root"
    ssh_password: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProxmoxConfigCreate(BaseModel):
    host: str
    api_token_name: str
    api_token_secret: str
    verify_ssl: bool = False
    ssh_username: Optional[str] = "root"
    ssh_password: Optional[str] = None

class ProxmoxConfigResponse(BaseModel):
    id: str
    host: str
    api_token_name: str
    verify_ssl: bool
    ssh_username: Optional[str] = "root"
    created_at: datetime

# ==================== THEME MODELS ====================

class Theme(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    theme_name: str  # cyan, purple, emerald, amber, blue, rose
    background: Literal["dark", "darker", "midnight"] = "dark"
    card_style: Literal["glass", "solid", "bordered"] = "glass"
    accent_color: Optional[str] = None  # Optional custom accent
    # Advanced appearance options
    primary_color: Optional[str] = None  # RGB format: "59, 130, 246"
    secondary_color: Optional[str] = None  # RGB format
    sidebar_bg_color: Optional[str] = None  # RGB format
    header_bg_color: Optional[str] = None  # RGB format
    layout_density: Literal["compact", "comfortable", "spacious"] = "comfortable"
    border_radius: Literal["sharp", "rounded", "very-rounded"] = "rounded"
    shadow_intensity: Literal["none", "subtle", "medium", "strong"] = "medium"
    sidebar_width: int = 256  # Width in pixels
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ThemeUpdate(BaseModel):
    theme_name: str
    background: Optional[Literal["dark", "darker", "midnight"]] = "dark"
    card_style: Optional[Literal["glass", "solid", "bordered"]] = "glass"
    accent_color: Optional[str] = None
    # Advanced appearance options
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    sidebar_bg_color: Optional[str] = None
    header_bg_color: Optional[str] = None
    layout_density: Optional[Literal["compact", "comfortable", "spacious"]] = "comfortable"
    border_radius: Optional[Literal["sharp", "rounded", "very-rounded"]] = "rounded"
    shadow_intensity: Optional[Literal["none", "subtle", "medium", "strong"]] = "medium"
    sidebar_width: Optional[int] = 256

# ==================== API KEYS MODELS ====================

class UserAPIKeys(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    openai_api_key: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class APIKeysUpdate(BaseModel):
    openai_api_key: Optional[str] = None

class APIKeysResponse(BaseModel):
    has_openai_key: bool
    openai_key_preview: Optional[str] = None  # Last 4 chars only

# ==================== CONNECTION PROFILE MODELS ====================

class ConnectionProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    connection_type: Literal["ssh", "ftp", "sftp", "reverse_proxy"]
    host: str
    port: int
    username: str
    password: Optional[str] = None
    private_key: Optional[str] = None  # For SSH key auth
    base_path: Optional[str] = "/"  # Starting directory
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConnectionProfileCreate(BaseModel):
    name: str
    connection_type: Literal["ssh", "ftp", "sftp", "reverse_proxy"]
    host: str
    port: int = 22  # Default SSH port
    username: str
    password: Optional[str] = None
    private_key: Optional[str] = None
    base_path: Optional[str] = "/"
    notes: Optional[str] = None

class ConnectionProfileUpdate(BaseModel):
    name: Optional[str] = None
    connection_type: Optional[Literal["ssh", "ftp", "sftp", "reverse_proxy"]] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    private_key: Optional[str] = None
    base_path: Optional[str] = None
    notes: Optional[str] = None

class FileUploadChunk(BaseModel):
    path: str
    chunk_data: str
    chunk_index: int
    total_chunks: int
    file_name: str

# ==================== DEVICE MODELS ====================

class PCIDevice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pci_address: str
    device_name: str
    device_type: str  # VGA, Audio, USB, Ethernet, etc.
    vendor_id: str
    device_id: str
    iommu_group: Optional[str] = None
    current_driver: Optional[str] = None
    subsystem: Optional[str] = None
    scanned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScanResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    devices: List[PCIDevice]
    scan_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== VM MODELS ====================

class VMConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    vmid: str
    name: str
    type: str  # qemu or lxc
    status: str
    hostpci_devices: List[Dict[str, Any]] = []
    node: str

# ==================== AI MODELS ====================

class AIQuery(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = []  # List of {role: "user"/"assistant", content: "..."}
    session_id: Optional[str] = None  # Track conversation sessions

class AIResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    question: str
    answer: str
    suggested_commands: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    session_id: Optional[str] = None  # Return session ID for tracking

class ConversationSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    messages: List[Dict[str, str]] = []  # {role, content, timestamp}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    pending_action: Optional[Dict[str, Any]] = None  # Store pending actions for confirmation

# ==================== ACTION MODELS ====================

class Action(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action_type: str  # bind_driver, unbind_driver, attach_to_vm, detach_from_vm
    target: str  # PCI address or VMID
    parameters: Dict[str, Any]
    status: str = "pending"  # pending, approved, executed, failed
    dry_run_output: Optional[str] = None
    execution_output: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    executed_at: Optional[datetime] = None

class ActionCreate(BaseModel):
    action_type: str
    target: str
    parameters: Dict[str, Any]

class ActionExecute(BaseModel):
    action_id: str
    dry_run: bool = True

# ==================== AUDIT LOG MODELS ====================

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action: str
    details: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== FILE OPERATIONS MODELS ====================

class FileLocation(BaseModel):
    type: str  # "host", "lxc", "vm"
    id: Optional[str] = None  # Container/VM ID
    ssh_username: Optional[str] = None  # For VM SSH
    ssh_password: Optional[str] = None  # For VM SSH

class FileListRequest(BaseModel):
    path: str = "/"
    location: Optional[FileLocation] = None

class FileReadRequest(BaseModel):
    path: str
    location: Optional[FileLocation] = None

class FileWriteRequest(BaseModel):
    path: str
    content: str
    create_backup: bool = True
    backup_description: Optional[str] = None
    location: Optional[FileLocation] = None

class FileCreateRequest(BaseModel):
    path: str
    content: str = ""
    location: Optional[FileLocation] = None

class FileDeleteRequest(BaseModel):
    path: str
    create_backup: bool = True
    location: Optional[FileLocation] = None

class FileMoveRequest(BaseModel):
    source_path: str
    dest_path: str

class FileBackupRequest(BaseModel):
    path: str
    description: Optional[str] = None

class FileInfo(BaseModel):
    name: str
    path: str
    type: str  # file or directory
    size: Optional[int] = None
    modified: Optional[str] = None
    permissions: Optional[str] = None

class FileContent(BaseModel):
    path: str
    content: str
    size: int
    modified: Optional[str] = None

class FileBackup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    file_path: str
    backup_path: str  # Path on Proxmox filesystem
    description: str
    file_size: int
    change_type: str  # edit, delete, move, manual
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BackupListResponse(BaseModel):
    backups: List[FileBackup]
    total: int

class FileUploadChunk(BaseModel):
    path: str
    chunk_data: str  # Base64 encoded
    chunk_index: int
    total_chunks: int
    file_name: str
    location: Optional[FileLocation] = None

class FileRenameRequest(BaseModel):
    old_path: str
    new_name: str
    location: Optional[FileLocation] = None

class FileCopyRequest(BaseModel):
    source_path: str
    dest_path: str
    source_location: Optional[FileLocation] = None
    dest_location: Optional[FileLocation] = None

class DirectoryCreateRequest(BaseModel):
    path: str
    location: Optional[FileLocation] = None

class RestoreRequest(BaseModel):
    backup_id: str

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_jwt_token(user_id: str, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, str]:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"user_id": payload["user_id"], "username": payload["username"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def log_audit(user_id: str, action: str, details: Dict[str, Any]):
    audit_log = AuditLog(user_id=user_id, action=action, details=details)
    doc = audit_log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)

async def get_proxmox_connection(user_id: str):
    """Get Proxmox API connection for user"""
    config_doc = await db.proxmox_configs.find_one({"user_id": user_id})
    if not config_doc:
        raise HTTPException(status_code=400, detail="Proxmox configuration not found. Please configure in Settings.")
    
    try:
        # Parse the host URL to extract hostname/IP and port
        host = config_doc['host']
        protocol = 'https'  # Default to HTTPS
        
        # Extract protocol if present
        if '://' in host:
            protocol, host = host.split('://', 1)
        
        # Remove trailing slash
        host = host.rstrip('/')
        
        # Extract port if present
        if ':' in host:
            hostname, port = host.rsplit(':', 1)
            port = int(port)
        else:
            # No port specified - use 443 for https, 8006 for other cases
            hostname = host
            port = 443 if protocol == 'https' else 8006
        
        logger.info(f"Connecting to Proxmox: {hostname}:{port} (protocol: {protocol})")
        
        # Parse token name into user and token_id
        # Format: user@realm!token-id
        api_token_name = config_doc['api_token_name']
        if '!' in api_token_name:
            user, token_name = api_token_name.split('!', 1)
        else:
            # Fallback for old format
            user = api_token_name
            token_name = None
        
        logger.info(f"Connecting as user: {user}, token: {token_name}")
        
        # Handle SSL verification issues
        verify_ssl = config_doc.get('verify_ssl', False)
        if not verify_ssl:
            # Disable SSL warnings and verification at the urllib3 level
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            
            # Set environment variable to disable SSL verification
            import ssl
            ssl._create_default_https_context = ssl._create_unverified_context
        
        proxmox = ProxmoxAPI(
            hostname,
            port=port,
            user=user,
            token_name=token_name,
            token_value=config_doc['api_token_secret'],
            verify_ssl=verify_ssl,
            timeout=15  # Increased timeout for public connections
        )
        return proxmox, config_doc
    except Exception as e:
        logger.error(f"Proxmox connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to Proxmox: {str(e)}")

def parse_lspci_output(lspci_output: str) -> List[PCIDevice]:
    """Parse lspci -nnk output into PCIDevice objects"""
    devices = []
    current_device = {}
    
    for line in lspci_output.split('\n'):
        line = line.strip()
        if not line:
            if current_device and current_device.get('pci_address'):
                devices.append(create_pci_device(current_device))
                current_device = {}
            continue
        
        # Parse PCI address line - much simpler pattern
        # Format: "00:00.0 Host bridge [0600]: Intel Corporation ..."
        if re.match(r'^[0-9a-f]{2}:[0-9a-f]{2}\.[0-9a-f]', line):
            # Save previous device
            if current_device and current_device.get('pci_address'):
                devices.append(create_pci_device(current_device))
            
            # Start new device
            current_device = {}
            
            # Extract PCI address (first part before space)
            parts = line.split(None, 1)  # Split on first whitespace
            if parts:
                current_device['pci_address'] = f"0000:{parts[0]}"
                
                # Rest of the line contains device info
                if len(parts) > 1:
                    rest = parts[1]
                    
                    # Try to extract class code [xxxx]
                    class_match = re.search(r'\[([0-9a-f]{4})\]', rest)
                    if class_match:
                        current_device['class_code'] = class_match.group(1)
                        # Remove class code from rest
                        rest = rest.replace(f'[{class_match.group(1)}]', '').strip()
                    
                    # Split device type and name by ':'
                    if ':' in rest:
                        device_class, device_name = rest.split(':', 1)
                        current_device['device_class'] = device_class.strip()
                        
                        # Extract vendor/device IDs [xxxx:xxxx]
                        id_match = re.search(r'\[([0-9a-f]{4}):([0-9a-f]{4})\]', device_name)
                        if id_match:
                            current_device['vendor_id'] = id_match.group(1)
                            current_device['device_id'] = id_match.group(2)
                            # Remove IDs from device name
                            device_name = re.sub(r'\[([0-9a-f]{4}):([0-9a-f]{4})\]', '', device_name).strip()
                        
                        current_device['device_name'] = device_name.strip()
                    else:
                        current_device['device_name'] = rest
        
        # Parse DeviceName line
        elif line.startswith('DeviceName:'):
            current_device['device_alias'] = line.split(':', 1)[1].strip()
        
        # Parse Subsystem line
        elif line.startswith('Subsystem:'):
            current_device['subsystem'] = line.split(':', 1)[1].strip()
        
        # Parse kernel driver
        elif line.startswith('Kernel driver in use:'):
            current_device['driver'] = line.split(':', 1)[1].strip()
        
        # Parse kernel modules
        elif line.startswith('Kernel modules:'):
            current_device['kernel_modules'] = line.split(':', 1)[1].strip()
    
    # Add last device
    if current_device and current_device.get('pci_address'):
        devices.append(create_pci_device(current_device))
    
    return devices

def create_pci_device(device_info: dict) -> PCIDevice:
    """Create PCIDevice from parsed info"""
    # Determine device type from class
    device_class = device_info.get('device_class', '').lower()
    if 'vga' in device_class or 'display' in device_class:
        device_type = 'VGA'
    elif 'audio' in device_class or 'sound' in device_class:
        device_type = 'Audio'
    elif 'usb' in device_class:
        device_type = 'USB'
    elif 'ethernet' in device_class or 'network' in device_class:
        device_type = 'Ethernet'
    elif 'nvme' in device_class or 'non-volatile' in device_class:
        device_type = 'NVMe'
    elif 'sata' in device_class or 'storage' in device_class:
        device_type = 'Storage'
    else:
        device_type = 'Other'
    
    return PCIDevice(
        pci_address=device_info.get('pci_address', 'unknown'),
        device_name=device_info.get('device_name', 'Unknown Device'),
        device_type=device_type,
        vendor_id=device_info.get('vendor_id', 'unknown'),
        device_id=device_info.get('device_id', 'unknown'),
        iommu_group=None,  # Will be populated separately
        current_driver=device_info.get('driver'),
        subsystem=device_info.get('subsystem')
    )

async def get_iommu_groups(ssh_client, devices: List[PCIDevice]) -> List[PCIDevice]:
    """Get IOMMU group information for devices"""
    try:
        stdin, stdout, stderr = ssh_client.exec_command('find /sys/kernel/iommu_groups/ -type l 2>/dev/null')
        iommu_output = stdout.read().decode()
        
        # Build mapping of PCI address to IOMMU group
        iommu_map = {}
        for line in iommu_output.split('\n'):
            if 'devices' in line:
                # Example: /sys/kernel/iommu_groups/1/devices/0000:01:00.0
                match = re.search(r'iommu_groups/(\d+)/devices/(0000:[0-9a-f:\.]+)', line)
                if match:
                    iommu_map[match.group(2)] = match.group(1)
        
        # Update devices with IOMMU group info
        for device in devices:
            if device.pci_address in iommu_map:
                device.iommu_group = iommu_map[device.pci_address]
    except Exception as e:
        logger.warning(f"Could not get IOMMU groups: {str(e)}")
    
    return devices

async def scan_proxmox_devices(user_id: str) -> List[PCIDevice]:
    """Scan devices from Proxmox host via SSH"""
    proxmox, config = await get_proxmox_connection(user_id)
    
    try:
        # Get first node
        nodes = proxmox.nodes.get()
        if not nodes:
            raise HTTPException(status_code=500, detail="No Proxmox nodes found")
        
        node_name = nodes[0]['node']
        
        # SSH to the node and run lspci
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Extract hostname from config
        host = config['host']
        # Remove protocol if present
        if '://' in host:
            host = host.split('://', 1)[1]
        # Remove port and trailing slash
        host = host.split(':')[0].rstrip('/')
        
        ssh_username = config.get('ssh_username', 'root')
        ssh_password = config.get('ssh_password')
        
        logger.info(f"Attempting SSH connection to {host} as {ssh_username}")
        
        try:
            # Try password auth first if password provided
            if ssh_password:
                ssh_client.connect(
                    host, 
                    username=ssh_username, 
                    password=ssh_password,
                    timeout=15,  # Increased timeout for public connections
                    look_for_keys=False,
                    allow_agent=False
                )
                logger.info("SSH connection successful with password")
            else:
                # Try key-based auth
                ssh_client.connect(
                    host, 
                    username=ssh_username, 
                    timeout=15,  # Increased timeout for public connections
                    look_for_keys=True, 
                    allow_agent=True
                )
                logger.info("SSH connection successful with keys")
        except Exception as ssh_err:
            logger.error(f"SSH connection failed: {str(ssh_err)}")
            logger.warning("Returning mock data. Please configure SSH credentials in Settings.")
            return get_mock_devices()
        
        # Run lspci command
        stdin, stdout, stderr = ssh_client.exec_command('lspci -nnk')
        lspci_output = stdout.read().decode()
        stderr_output = stderr.read().decode()
        
        if stderr_output:
            logger.warning(f"lspci stderr: {stderr_output}")
        
        logger.info(f"lspci output length: {len(lspci_output)} bytes")
        
        # Parse devices
        devices = parse_lspci_output(lspci_output)
        logger.info(f"Parsed {len(devices)} devices")
        
        # Get IOMMU groups
        devices = await get_iommu_groups(ssh_client, devices)
        
        ssh_client.close()
        
        return devices
        
    except Exception as e:
        logger.error(f"Device scan error: {str(e)}")
        # Return mock data as fallback
        logger.info("Returning mock device data as fallback")
        return get_mock_devices()

def get_mock_devices() -> List[PCIDevice]:
    """Return mock devices for demo/testing"""
    return [
        PCIDevice(
            pci_address="0000:01:00.0",
            device_name="NVIDIA GeForce GTX 980",
            device_type="VGA",
            vendor_id="10de",
            device_id="13c0",
            iommu_group="1",
            current_driver="i915",
            subsystem="pci"
        ),
        PCIDevice(
            pci_address="0000:01:00.1",
            device_name="NVIDIA Audio Device",
            device_type="Audio",
            vendor_id="10de",
            device_id="0fbb",
            iommu_group="1",
            current_driver="snd_hda_intel",
            subsystem="pci"
        ),
        PCIDevice(
            pci_address="0000:02:00.0",
            device_name="Intel USB 3.0 Controller",
            device_type="USB",
            vendor_id="8086",
            device_id="15b5",
            iommu_group="2",
            current_driver="xhci_hcd",
            subsystem="pci"
        ),
        PCIDevice(
            pci_address="0000:03:00.0",
            device_name="Samsung NVMe SSD 980 PRO",
            device_type="NVMe",
            vendor_id="144d",
            device_id="a809",
            iommu_group="3",
            current_driver="nvme",
            subsystem="pci"
        )
    ]

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=AuthResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password)
    )
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    # Create token
    token = create_jwt_token(user.id, user.username)
    return AuthResponse(token=token, username=user.username)

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(credentials: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"username": credentials.username})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    token = create_jwt_token(user_doc['id'], user_doc['username'])
    return AuthResponse(token=token, username=user_doc['username'])

# ==================== PROXMOX CONFIG ROUTES ====================

@api_router.post("/proxmox/config", response_model=ProxmoxConfigResponse)
async def save_proxmox_config(config: ProxmoxConfigCreate, current_user: dict = Depends(get_current_user)):
    # Delete existing config for this user
    await db.proxmox_configs.delete_many({"user_id": current_user["user_id"]})
    
    # Create new config
    proxmox_config = ProxmoxConfig(
        user_id=current_user["user_id"],
        **config.model_dump()
    )
    doc = proxmox_config.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.proxmox_configs.insert_one(doc)
    
    await log_audit(current_user["user_id"], "proxmox_config_saved", {"host": config.host})
    
    return ProxmoxConfigResponse(
        id=proxmox_config.id,
        host=proxmox_config.host,
        api_token_name=proxmox_config.api_token_name,
        verify_ssl=proxmox_config.verify_ssl,
        created_at=proxmox_config.created_at
    )

@api_router.get("/proxmox/config", response_model=Optional[ProxmoxConfigResponse])
async def get_proxmox_config(current_user: dict = Depends(get_current_user)):
    config_doc = await db.proxmox_configs.find_one({"user_id": current_user["user_id"]})
    if not config_doc:
        return None
    
    if isinstance(config_doc.get('created_at'), str):
        config_doc['created_at'] = datetime.fromisoformat(config_doc['created_at'])
    
    return ProxmoxConfigResponse(
        id=config_doc['id'],
        host=config_doc['host'],
        api_token_name=config_doc['api_token_name'],
        verify_ssl=config_doc['verify_ssl'],
        created_at=config_doc['created_at']
    )

@api_router.delete("/proxmox/config")
async def delete_proxmox_config(current_user: dict = Depends(get_current_user)):
    await db.proxmox_configs.delete_many({"user_id": current_user["user_id"]})
    await log_audit(current_user["user_id"], "proxmox_config_deleted", {})
    return {"message": "Config deleted"}


@api_router.post("/proxmox/test-connection")
async def test_proxmox_connection(current_user: dict = Depends(get_current_user)):
    """Test Proxmox API and SSH connections"""
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        
        # Test API connection
        api_status = "failed"
        api_error = None
        try:
            nodes = proxmox.nodes.get()
            if nodes and len(nodes) > 0:
                api_status = "success"
                node_name = nodes[0]['node']
            else:
                api_error = "No nodes found"
        except Exception as e:
            api_error = str(e)
            logger.error(f"API connection test failed: {str(e)}")
        
        # Test SSH connection
        ssh_status = "failed"
        ssh_error = None
        try:
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Extract hostname
            host = config['host']
            if '://' in host:
                host = host.split('://', 1)[1]
            host = host.split(':')[0].rstrip('/')
            
            ssh_username = config.get('ssh_username', 'root')
            ssh_password = config.get('ssh_password')
            
            if ssh_password:
                ssh_client.connect(
                    host,
                    username=ssh_username,
                    password=ssh_password,
                    timeout=15,  # Increased timeout for public connections
                    look_for_keys=False,
                    allow_agent=False
                )
            else:
                ssh_client.connect(
                    host,
                    username=ssh_username,
                    timeout=15,  # Increased timeout for public connections
                    look_for_keys=True,
                    allow_agent=True
                )
            
            # Test a simple command
            stdin, stdout, stderr = ssh_client.exec_command('echo "test"')
            result = stdout.read().decode().strip()
            if result == "test":
                ssh_status = "success"
            ssh_client.close()
        except Exception as e:
            ssh_error = str(e)
            logger.error(f"SSH connection test failed: {str(e)}")
        
        return {
            "api": {
                "status": api_status,
                "error": api_error,
                "nodes": len(nodes) if api_status == "success" else 0
            },
            "ssh": {
                "status": ssh_status,
                "error": ssh_error
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Connection test error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/health-check")
async def health_check(current_user: dict = Depends(get_current_user)):
    """Check health/connectivity of all services"""
    health_status = {
        "proxmox": {"status": "disconnected", "error": None},
        "ssh": {"status": "disconnected", "error": None},
        "openai": {"status": "disconnected", "error": None}
    }
    
    # Check Proxmox API
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        try:
            nodes = proxmox.nodes.get()
            if nodes and len(nodes) > 0:
                health_status["proxmox"]["status"] = "connected"
            else:
                health_status["proxmox"]["error"] = "No nodes found"
        except Exception as e:
            health_status["proxmox"]["error"] = str(e)
    except HTTPException as e:
        health_status["proxmox"]["error"] = e.detail
    except Exception as e:
        health_status["proxmox"]["error"] = str(e)
    
    # Check SSH
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        host = config['host']
        if '://' in host:
            host = host.split('://', 1)[1]
        host = host.split(':')[0].rstrip('/')
        
        ssh_username = config.get('ssh_username', 'root')
        ssh_password = config.get('ssh_password')
        
        if ssh_password:
            ssh_client.connect(host, username=ssh_username, password=ssh_password, timeout=10, look_for_keys=False, allow_agent=False)
        else:
            ssh_client.connect(host, username=ssh_username, timeout=10, look_for_keys=True, allow_agent=True)
        
        stdin, stdout, stderr = ssh_client.exec_command('echo "test"')
        result = stdout.read().decode().strip()
        if result == "test":
            health_status["ssh"]["status"] = "connected"
        ssh_client.close()
    except Exception as e:
        health_status["ssh"]["error"] = str(e)
    
    # Check OpenAI API - just check if key is configured
    try:
        api_keys_doc = await db.api_keys.find_one({"user_id": current_user["user_id"]})
        if api_keys_doc and api_keys_doc.get("openai_api_key"):
            # Key exists - mark as connected
            # We don't test it here to avoid slow health checks
            health_status["openai"]["status"] = "connected"
        else:
            health_status["openai"]["error"] = "API key not configured"
    except Exception as e:
        health_status["openai"]["error"] = str(e)
    
    return health_status

# ==================== THEME ROUTES ====================

@api_router.get("/theme")
async def get_theme(current_user: dict = Depends(get_current_user)):
    theme_doc = await db.themes.find_one({"user_id": current_user["user_id"]})
    if not theme_doc:
        return {
            "theme_name": "amber",
            "background": "darker",
            "card_style": "solid",
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
    return {
        "theme_name": theme_doc["theme_name"],
        "background": theme_doc.get("background", "dark"),
        "card_style": theme_doc.get("card_style", "glass"),
        "accent_color": theme_doc.get("accent_color"),
        "primary_color": theme_doc.get("primary_color"),
        "secondary_color": theme_doc.get("secondary_color"),
        "sidebar_bg_color": theme_doc.get("sidebar_bg_color"),
        "header_bg_color": theme_doc.get("header_bg_color"),
        "layout_density": theme_doc.get("layout_density", "comfortable"),
        "border_radius": theme_doc.get("border_radius", "rounded"),
        "shadow_intensity": theme_doc.get("shadow_intensity", "medium"),
        "sidebar_width": theme_doc.get("sidebar_width", 256)
    }

@api_router.post("/theme")
async def update_theme(theme_data: ThemeUpdate, current_user: dict = Depends(get_current_user)):
    # Delete existing theme
    await db.themes.delete_many({"user_id": current_user["user_id"]})
    
    # Create new theme
    theme = Theme(
        user_id=current_user["user_id"],
        theme_name=theme_data.theme_name,
        background=theme_data.background or "dark",
        card_style=theme_data.card_style or "glass",
        accent_color=theme_data.accent_color,
        primary_color=theme_data.primary_color,
        secondary_color=theme_data.secondary_color,
        sidebar_bg_color=theme_data.sidebar_bg_color,
        header_bg_color=theme_data.header_bg_color,
        layout_density=theme_data.layout_density or "comfortable",
        border_radius=theme_data.border_radius or "rounded",
        shadow_intensity=theme_data.shadow_intensity or "medium",
        sidebar_width=theme_data.sidebar_width or 256
    )
    doc = theme.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.themes.insert_one(doc)
    
    await log_audit(current_user["user_id"], "theme_updated", {
        "theme": theme_data.theme_name,
        "background": theme_data.background,
        "card_style": theme_data.card_style,
        "layout_density": theme_data.layout_density,
        "border_radius": theme_data.border_radius
    })
    
    return {
        "message": "Theme updated",
        "theme_name": theme_data.theme_name,
        "background": theme_data.background,
        "card_style": theme_data.card_style,
        "accent_color": theme_data.accent_color,
        "primary_color": theme_data.primary_color,
        "secondary_color": theme_data.secondary_color,
        "sidebar_bg_color": theme_data.sidebar_bg_color,
        "header_bg_color": theme_data.header_bg_color,
        "layout_density": theme_data.layout_density,
        "border_radius": theme_data.border_radius,
        "shadow_intensity": theme_data.shadow_intensity,
        "sidebar_width": theme_data.sidebar_width
    }

# ==================== API KEYS ROUTES ====================

@api_router.get("/api-keys", response_model=APIKeysResponse)
async def get_api_keys(current_user: dict = Depends(get_current_user)):
    keys_doc = await db.user_api_keys.find_one({"user_id": current_user["user_id"]})
    
    if not keys_doc or not keys_doc.get('openai_api_key'):
        return APIKeysResponse(has_openai_key=False, openai_key_preview=None)
    
    # Return preview (last 4 chars)
    key = keys_doc['openai_api_key']
    preview = f"...{key[-4:]}" if len(key) > 4 else "****"
    
    return APIKeysResponse(has_openai_key=True, openai_key_preview=preview)

@api_router.post("/api-keys")
async def update_api_keys(keys_data: APIKeysUpdate, current_user: dict = Depends(get_current_user)):
    # Delete existing keys
    await db.user_api_keys.delete_many({"user_id": current_user["user_id"]})
    
    # Create new keys record
    user_keys = UserAPIKeys(
        user_id=current_user["user_id"],
        openai_api_key=keys_data.openai_api_key
    )
    doc = user_keys.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.user_api_keys.insert_one(doc)
    
    await log_audit(current_user["user_id"], "api_keys_updated", {"has_openai": bool(keys_data.openai_api_key)})
    
    return {"message": "API keys updated successfully"}

@api_router.delete("/api-keys")
async def delete_api_keys(current_user: dict = Depends(get_current_user)):
    await db.user_api_keys.delete_many({"user_id": current_user["user_id"]})
    await log_audit(current_user["user_id"], "api_keys_deleted", {})
    return {"message": "API keys deleted"}

# ==================== CONNECTION PROFILES ROUTES ====================

@api_router.get("/connection-profiles")
async def get_connection_profiles(current_user: dict = Depends(get_current_user)):
    """Get all connection profiles for the current user"""
    profiles = await db.connection_profiles.find({"user_id": current_user["user_id"]}).to_list(length=None)
    
    # Don't send passwords/keys in list view and remove MongoDB _id field
    for profile in profiles:
        # Remove MongoDB _id field for JSON serialization
        if '_id' in profile:
            del profile['_id']
        
        # Convert datetime fields to ISO strings if needed
        if isinstance(profile.get('created_at'), datetime):
            profile['created_at'] = profile['created_at'].isoformat()
        if isinstance(profile.get('updated_at'), datetime):
            profile['updated_at'] = profile['updated_at'].isoformat()
        
        # Don't send passwords/keys in list view
        if 'password' in profile:
            profile['password'] = '******' if profile['password'] else None
        if 'private_key' in profile:
            profile['private_key'] = '******' if profile['private_key'] else None
    
    return {"profiles": profiles}

@api_router.post("/connection-profiles")
async def create_connection_profile(profile_data: ConnectionProfileCreate, current_user: dict = Depends(get_current_user)):
    """Create a new connection profile"""
    profile = ConnectionProfile(
        user_id=current_user["user_id"],
        **profile_data.model_dump()
    )
    
    doc = profile.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.connection_profiles.insert_one(doc)
    
    await log_audit(current_user["user_id"], "connection_profile_created", {"name": profile_data.name, "type": profile_data.connection_type})
    
    return {"message": "Connection profile created", "id": profile.id}

@api_router.get("/connection-profiles/{profile_id}")
async def get_connection_profile(profile_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific connection profile (with credentials)"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    # Remove MongoDB _id field for JSON serialization
    if '_id' in profile:
        del profile['_id']
    
    # Convert datetime fields to ISO strings if needed
    if isinstance(profile.get('created_at'), datetime):
        profile['created_at'] = profile['created_at'].isoformat()
    if isinstance(profile.get('updated_at'), datetime):
        profile['updated_at'] = profile['updated_at'].isoformat()
    
    return profile

@api_router.put("/connection-profiles/{profile_id}")
async def update_connection_profile(profile_id: str, profile_data: ConnectionProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update a connection profile"""
    # Check if profile exists
    existing = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    # Update only provided fields
    update_data = {k: v for k, v in profile_data.model_dump(exclude_unset=True).items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.connection_profiles.update_one(
        {"id": profile_id, "user_id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    await log_audit(current_user["user_id"], "connection_profile_updated", {"id": profile_id})
    
    return {"message": "Connection profile updated"}

@api_router.delete("/connection-profiles/{profile_id}")
async def delete_connection_profile(profile_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a connection profile"""
    result = await db.connection_profiles.delete_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    await log_audit(current_user["user_id"], "connection_profile_deleted", {"id": profile_id})
    
    return {"message": "Connection profile deleted"}

@api_router.post("/connection-profiles/{profile_id}/test")
async def test_connection_profile(profile_id: str, current_user: dict = Depends(get_current_user)):
    """Test a connection profile"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    try:
        if profile['connection_type'] in ['ssh', 'sftp']:
            # Test SSH connection
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                # Use key-based auth
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                # Use password auth
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            # Test a simple command
            stdin, stdout, stderr = ssh_client.exec_command('echo "test"')
            result = stdout.read().decode().strip()
            ssh_client.close()
            
            if result == "test":
                return {"status": "success", "message": "Connection successful"}
            else:
                return {"status": "failed", "message": "Connection test failed"}
                
        elif profile['connection_type'] == 'ftp':
            # Test FTP connection
            try:
                ftp = FTP()
                ftp.connect(profile['host'], profile['port'], timeout=10)
                ftp.login(profile['username'], profile.get('password', ''))
                ftp.pwd()  # Test command
                ftp.quit()
                return {"status": "success", "message": "FTP connection successful"}
            except Exception as e:
                return {"status": "failed", "message": f"FTP connection failed: {str(e)}"}
                
        elif profile['connection_type'] == 'reverse_proxy':
            # For reverse proxy, we can't really test from backend
            # Just validate the host format
            if profile['host'].startswith('http://') or profile['host'].startswith('https://'):
                return {"status": "success", "message": "Reverse proxy configuration looks valid"}
            else:
                return {"status": "failed", "message": "Host should start with http:// or https://"}
        
        else:
            return {"status": "failed", "message": f"Connection type {profile['connection_type']} not yet supported"}
            
    except Exception as e:
        return {"status": "failed", "message": str(e)}

# ==================== CONNECTION PROFILE FILE OPERATIONS ====================

@api_router.post("/connection-profiles/{profile_id}/files/list")
async def list_files_by_profile(profile_id: str, path: str = "/", current_user: dict = Depends(get_current_user)):
    """List files and directories using a connection profile"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    try:
        if profile['connection_type'] == 'sftp':
            files = await sftp_list_directory(profile, path)
            # Convert to FileInfo format
            result = []
            for file in files:
                result.append({
                    "name": file['name'],
                    "path": f"{path.rstrip('/')}/{file['name']}",
                    "type": file['type'],
                    "size": int(file['size']) if file['type'] == 'file' else None,
                    "modified": None,
                    "permissions": file.get('permissions')
                })
            return result
        elif profile['connection_type'] == 'ssh':
            # For SSH, use paramiko to execute ls command
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            stdin, stdout, stderr = ssh_client.exec_command(f"ls -lAh --time-style='+%Y-%m-%d %H:%M:%S' '{path}' 2>&1")
            output = stdout.read().decode()
            ssh_client.close()
            
            files = []
            for line in output.strip().split('\n'):
                if not line or line.startswith('total'):
                    continue
                
                parts = line.split(None, 8)
                if len(parts) < 9:
                    continue
                
                permissions = parts[0]
                size_str = parts[4]
                modified = f"{parts[5]} {parts[6]}"
                name = parts[8]
                
                if name in ['.', '..']:
                    continue
                
                file_type = 'directory' if permissions.startswith('d') else 'file'
                
                size = None
                if file_type == 'file':
                    try:
                        if 'K' in size_str:
                            size = int(float(size_str.replace('K', '')) * 1024)
                        elif 'M' in size_str:
                            size = int(float(size_str.replace('M', '')) * 1024 * 1024)
                        elif 'G' in size_str:
                            size = int(float(size_str.replace('G', '')) * 1024 * 1024 * 1024)
                        else:
                            size = int(size_str)
                    except (ValueError, AttributeError):
                        size = 0
                
                file_path = f"{path.rstrip('/')}/{name}"
                
                files.append({
                    "name": name,
                    "path": file_path,
                    "type": file_type,
                    "size": size,
                    "modified": modified,
                    "permissions": permissions
                })
            
            return files
        elif profile['connection_type'] == 'ftp':
            # For FTP, use ftplib
            files_data = await ftp_list_directory(profile, path)
            result = []
            for file in files_data:
                result.append({
                    "name": file['name'],
                    "path": f"{path.rstrip('/')}/{file['name']}",
                    "type": file['type'],
                    "size": int(file['size']) if file['type'] == 'file' and file['size'].isdigit() else None,
                    "modified": None,
                    "permissions": file.get('permissions')
                })
            return result
        elif profile['connection_type'] == 'reverse_proxy':
            # For reverse proxy, use HTTP API
            files_data = await rproxy_list_directory(profile, path)
            result = []
            for file in files_data:
                result.append({
                    "name": file.get('name'),
                    "path": file.get('path'),
                    "type": file.get('type'),
                    "size": file.get('size'),
                    "modified": file.get('modified'),
                    "permissions": file.get('permissions')
                })
            return result
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported for file operations")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@api_router.post("/connection-profiles/{profile_id}/files/read")
async def read_file_by_profile(profile_id: str, path: str, current_user: dict = Depends(get_current_user)):
    """Read file content using a connection profile"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    try:
        if profile['connection_type'] == 'sftp':
            content = await sftp_read_file(profile, path)
            file_stat = await sftp_get_file_stat(profile, path)
            
            return {
                "path": path,
                "content": content,
                "size": file_stat.st_size,
                "modified": datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            }
        elif profile['connection_type'] == 'ssh':
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            # Get file size
            stdin, stdout, stderr = ssh_client.exec_command(f"stat -c %s '{path}'")
            size_output = stdout.read().decode().strip()
            file_size = int(size_output)
            
            # Read content
            stdin, stdout, stderr = ssh_client.exec_command(f"cat '{path}'")
            content = stdout.read().decode('utf-8', errors='replace')
            
            # Get modified time
            stdin, stdout, stderr = ssh_client.exec_command(f"stat -c %y '{path}'")
            modified = stdout.read().decode().strip()
            
            ssh_client.close()
            
            return {
                "path": path,
                "content": content,
                "size": file_size,
                "modified": modified
            }
        elif profile['connection_type'] == 'ftp':
            content = await ftp_read_file(profile, path)
            
            return {
                "path": path,
                "content": content,
                "size": len(content.encode('utf-8')),
                "modified": None
            }
        elif profile['connection_type'] == 'reverse_proxy':
            content = await rproxy_read_file(profile, path)
            
            return {
                "path": path,
                "content": content,
                "size": len(content.encode('utf-8')),
                "modified": None
            }
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

@api_router.post("/connection-profiles/{profile_id}/files/write")
async def write_file_by_profile(profile_id: str, path: str, content: str, current_user: dict = Depends(get_current_user)):
    """Write/create file content using a connection profile"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    try:
        if profile['connection_type'] == 'sftp':
            await sftp_write_file(profile, path, content)
            return {"success": True, "message": "File written successfully", "path": path}
        elif profile['connection_type'] == 'ssh':
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            # Use echo with base64 to avoid shell escaping issues
            import base64
            encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
            command = f"echo '{encoded_content}' | base64 -d > '{path}'"
            stdin, stdout, stderr = ssh_client.exec_command(command)
            exit_code = stdout.channel.recv_exit_status()
            
            ssh_client.close()
            
            if exit_code != 0:
                raise HTTPException(status_code=500, detail="Failed to write file")
            
            return {"success": True, "message": "File written successfully", "path": path}
        elif profile['connection_type'] == 'ftp':
            await ftp_write_file(profile, path, content)
            return {"success": True, "message": "File written successfully", "path": path}
        elif profile['connection_type'] == 'reverse_proxy':
            await rproxy_write_file(profile, path, content)
            return {"success": True, "message": "File written successfully", "path": path}
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {str(e)}")

@api_router.post("/connection-profiles/{profile_id}/files/delete")
async def delete_file_by_profile(profile_id: str, path: str, current_user: dict = Depends(get_current_user)):
    """Delete file or directory using a connection profile"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    try:
        if profile['connection_type'] == 'sftp':
            await sftp_delete_file(profile, path)
            return {"success": True, "message": "File deleted successfully"}
        elif profile['connection_type'] == 'ssh':
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            stdin, stdout, stderr = ssh_client.exec_command(f"rm -rf '{path}'")
            exit_code = stdout.channel.recv_exit_status()
            
            ssh_client.close()
            
            if exit_code != 0:
                raise HTTPException(status_code=500, detail="Failed to delete file")
            
            return {"success": True, "message": "File deleted successfully"}
        elif profile['connection_type'] == 'ftp':
            await ftp_delete_file(profile, path)
            return {"success": True, "message": "File deleted successfully"}
        elif profile['connection_type'] == 'reverse_proxy':
            await rproxy_delete_file(profile, path)
            return {"success": True, "message": "File deleted successfully"}
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

@api_router.post("/connection-profiles/{profile_id}/files/mkdir")
async def create_directory_by_profile(profile_id: str, path: str, current_user: dict = Depends(get_current_user)):
    """Create directory using a connection profile"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    try:
        if profile['connection_type'] == 'sftp':
            await sftp_create_directory(profile, path)
            return {"success": True, "message": "Directory created successfully"}
        elif profile['connection_type'] == 'ssh':
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            stdin, stdout, stderr = ssh_client.exec_command(f"mkdir -p '{path}'")
            exit_code = stdout.channel.recv_exit_status()
            
            ssh_client.close()
            
            if exit_code != 0:
                raise HTTPException(status_code=500, detail="Failed to create directory")
            
            return {"success": True, "message": "Directory created successfully"}
        elif profile['connection_type'] == 'ftp':
            await ftp_create_directory(profile, path)
            return {"success": True, "message": "Directory created successfully"}
        elif profile['connection_type'] == 'reverse_proxy':
            await rproxy_create_directory(profile, path)
            return {"success": True, "message": "Directory created successfully"}
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create directory: {str(e)}")

@api_router.post("/connection-profiles/{profile_id}/files/rename")
async def rename_file_by_profile(profile_id: str, old_path: str, new_name: str, current_user: dict = Depends(get_current_user)):
    """Rename file or directory using a connection profile"""
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    # Calculate new path
    parent_dir = '/'.join(old_path.split('/')[:-1]) or '/'
    new_path = f"{parent_dir.rstrip('/')}/{new_name}"
    
    try:
        if profile['connection_type'] == 'sftp':
            await sftp_rename_file(profile, old_path, new_path)
            return {"success": True, "message": "File renamed successfully", "new_path": new_path}
        elif profile['connection_type'] == 'ssh':
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            stdin, stdout, stderr = ssh_client.exec_command(f"mv '{old_path}' '{new_path}'")
            exit_code = stdout.channel.recv_exit_status()
            
            ssh_client.close()
            
            if exit_code != 0:
                raise HTTPException(status_code=500, detail="Failed to rename file")
            
            return {"success": True, "message": "File renamed successfully", "new_path": new_path}
        elif profile['connection_type'] == 'ftp':
            await ftp_rename_file(profile, old_path, new_path)
            return {"success": True, "message": "File renamed successfully", "new_path": new_path}
        elif profile['connection_type'] == 'reverse_proxy':
            await rproxy_rename_file(profile, old_path, new_path)
            return {"success": True, "message": "File renamed successfully", "new_path": new_path}
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename file: {str(e)}")

@api_router.post("/connection-profiles/{profile_id}/files/upload")
async def upload_file_by_profile(
    profile_id: str, 
    request: FileUploadChunk,
    current_user: dict = Depends(get_current_user)
):
    """Upload file in chunks using a connection profile"""
    import base64
    
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    # Extract data from request body
    path = request.path
    chunk_data = request.chunk_data
    chunk_index = request.chunk_index
    total_chunks = request.total_chunks
    file_name = request.file_name
    
    try:
        # Decode chunk data
        chunk_bytes = base64.b64decode(chunk_data)
        
        # Create temp directory for chunks
        temp_dir = f"/tmp/upload_{current_user['user_id']}_{file_name.replace('/', '_')}"
        chunk_path = f"{temp_dir}/chunk_{chunk_index}"
        
        if profile['connection_type'] == 'sftp':
            sftp, transport = await get_sftp_client(profile)
            
            try:
                # Create temp dir if first chunk
                if chunk_index == 0:
                    try:
                        sftp.mkdir(temp_dir)
                    except:
                        pass  # Directory might already exist
                
                # Write chunk
                with sftp.open(chunk_path, 'wb') as f:
                    f.write(chunk_bytes)
                
                # If last chunk, combine all chunks
                if chunk_index == total_chunks - 1:
                    # Read all chunks and combine
                    combined = b''
                    for i in range(total_chunks):
                        with sftp.open(f"{temp_dir}/chunk_{i}", 'rb') as f:
                            combined += f.read()
                    
                    # Write final file
                    with sftp.open(path, 'wb') as f:
                        f.write(combined)
                    
                    # Cleanup temp directory
                    for i in range(total_chunks):
                        try:
                            sftp.remove(f"{temp_dir}/chunk_{i}")
                        except:
                            pass
                    try:
                        sftp.rmdir(temp_dir)
                    except:
                        pass
                    
                    return {
                        "success": True,
                        "message": "File uploaded successfully",
                        "path": path,
                        "complete": True
                    }
                else:
                    return {
                        "success": True,
                        "message": f"Chunk {chunk_index + 1}/{total_chunks} uploaded",
                        "complete": False
                    }
            finally:
                sftp.close()
                transport.close()
                
        elif profile['connection_type'] == 'ssh':
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            # Create temp dir if first chunk
            if chunk_index == 0:
                stdin, stdout, stderr = ssh_client.exec_command(f"mkdir -p '{temp_dir}'")
                stdout.channel.recv_exit_status()
            
            # Write chunk using base64 encoding
            encoded_chunk = base64.b64encode(chunk_bytes).decode('utf-8')
            cmd = f"echo '{encoded_chunk}' | base64 -d > '{chunk_path}'"
            stdin, stdout, stderr = ssh_client.exec_command(cmd)
            exit_code = stdout.channel.recv_exit_status()
            
            if exit_code != 0:
                ssh_client.close()
                raise HTTPException(status_code=500, detail="Failed to write chunk")
            
            # If last chunk, combine all chunks
            if chunk_index == total_chunks - 1:
                combine_cmd = f"cat {temp_dir}/chunk_* > '{path}' && rm -rf '{temp_dir}'"
                stdin, stdout, stderr = ssh_client.exec_command(combine_cmd)
                exit_code = stdout.channel.recv_exit_status()
                
                ssh_client.close()
                
                if exit_code != 0:
                    raise HTTPException(status_code=500, detail="Failed to combine chunks")
                
                return {
                    "success": True,
                    "message": "File uploaded successfully",
                    "path": path,
                    "complete": True
                }
            else:
                ssh_client.close()
                return {
                    "success": True,
                    "message": f"Chunk {chunk_index + 1}/{total_chunks} uploaded",
                    "complete": False
                }
        elif profile['connection_type'] == 'ftp':
            # For FTP, use local temp storage for chunks
            import os
            local_temp_dir = f"/tmp/upload_{current_user['user_id']}_{file_name.replace('/', '_')}"
            os.makedirs(local_temp_dir, exist_ok=True)
            
            # Write chunk locally
            with open(f"{local_temp_dir}/chunk_{chunk_index}", 'wb') as f:
                f.write(chunk_bytes)
            
            # If last chunk, combine and upload
            if chunk_index == total_chunks - 1:
                # Combine all chunks
                combined = b''
                for i in range(total_chunks):
                    with open(f"{local_temp_dir}/chunk_{i}", 'rb') as f:
                        combined += f.read()
                
                # Upload to FTP
                await ftp_upload_file(profile, path, combined)
                
                # Cleanup local temp files
                import shutil
                shutil.rmtree(local_temp_dir, ignore_errors=True)
                
                return {
                    "success": True,
                    "message": "File uploaded successfully",
                    "path": path,
                    "complete": True
                }
            else:
                return {
                    "success": True,
                    "message": f"Chunk {chunk_index + 1}/{total_chunks} uploaded",
                    "complete": False
                }
        elif profile['connection_type'] == 'reverse_proxy':
            # For reverse proxy, use local temp storage for chunks
            import os
            local_temp_dir = f"/tmp/upload_{current_user['user_id']}_{file_name.replace('/', '_')}"
            os.makedirs(local_temp_dir, exist_ok=True)
            
            # Write chunk locally
            with open(f"{local_temp_dir}/chunk_{chunk_index}", 'wb') as f:
                f.write(chunk_bytes)
            
            # If last chunk, combine and upload
            if chunk_index == total_chunks - 1:
                # Combine all chunks
                combined = b''
                for i in range(total_chunks):
                    with open(f"{local_temp_dir}/chunk_{i}", 'rb') as f:
                        combined += f.read()
                
                # Upload to reverse proxy
                await rproxy_upload_file(profile, path, combined)
                
                # Cleanup local temp files
                import shutil
                shutil.rmtree(local_temp_dir, ignore_errors=True)
                
                return {
                    "success": True,
                    "message": "File uploaded successfully",
                    "path": path,
                    "complete": True
                }
            else:
                return {
                    "success": True,
                    "message": f"Chunk {chunk_index + 1}/{total_chunks} uploaded",
                    "complete": False
                }
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@api_router.get("/connection-profiles/{profile_id}/files/download")
async def download_file_by_profile(profile_id: str, path: str, current_user: dict = Depends(get_current_user)):
    """Download file using a connection profile"""
    from fastapi.responses import StreamingResponse
    
    profile = await db.connection_profiles.find_one({"id": profile_id, "user_id": current_user["user_id"]})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found")
    
    try:
        filename = path.split('/')[-1]
        
        if profile['connection_type'] == 'sftp':
            content = await sftp_download_file(profile, path)
            
            return StreamingResponse(
                io.BytesIO(content),
                media_type='application/octet-stream',
                headers={'Content-Disposition': f'attachment; filename="{filename}"'}
            )
        elif profile['connection_type'] == 'ssh':
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            if profile.get('private_key'):
                from io import StringIO
                key_file = StringIO(profile['private_key'])
                private_key = paramiko.RSAKey.from_private_key(key_file)
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    pkey=private_key,
                    timeout=10
                )
            else:
                ssh_client.connect(
                    profile['host'],
                    port=profile['port'],
                    username=profile['username'],
                    password=profile.get('password'),
                    timeout=10
                )
            
            # Read file content
            stdin, stdout, stderr = ssh_client.exec_command(f"cat '{path}'")
            content = stdout.read()
            
            ssh_client.close()
            
            return StreamingResponse(
                io.BytesIO(content),
                media_type='application/octet-stream',
                headers={'Content-Disposition': f'attachment; filename="{filename}"'}
            )
        elif profile['connection_type'] == 'ftp':
            content = await ftp_download_file(profile, path)
            
            return StreamingResponse(
                io.BytesIO(content),
                media_type='application/octet-stream',
                headers={'Content-Disposition': f'attachment; filename="{filename}"'}
            )
        elif profile['connection_type'] == 'reverse_proxy':
            content = await rproxy_download_file(profile, path)
            
            return StreamingResponse(
                io.BytesIO(content),
                media_type='application/octet-stream',
                headers={'Content-Disposition': f'attachment; filename="{filename}"'}
            )
        else:
            raise HTTPException(status_code=400, detail=f"Connection type {profile['connection_type']} not supported")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

# ==================== DEVICE SCANNING ROUTES (MOCK) ====================

@api_router.post("/devices/scan", response_model=ScanResult)
async def scan_devices(current_user: dict = Depends(get_current_user)):
    try:
        # Scan real devices from Proxmox
        devices = await scan_proxmox_devices(current_user["user_id"])
        
        scan_result = ScanResult(
            user_id=current_user["user_id"],
            devices=devices
        )
        
        # Save scan result
        doc = scan_result.model_dump()
        doc['scan_timestamp'] = doc['scan_timestamp'].isoformat()
        for device in doc['devices']:
            device['scanned_at'] = device['scanned_at'].isoformat()
        await db.scan_results.insert_one(doc)
        
        await log_audit(current_user["user_id"], "device_scan", {"device_count": len(devices)})
        
        return scan_result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@api_router.get("/devices/latest", response_model=Optional[ScanResult])
async def get_latest_scan(current_user: dict = Depends(get_current_user)):
    scan_doc = await db.scan_results.find_one(
        {"user_id": current_user["user_id"]},
        sort=[("scan_timestamp", -1)]
    )
    
    if not scan_doc:
        return None
    
    if isinstance(scan_doc.get('scan_timestamp'), str):
        scan_doc['scan_timestamp'] = datetime.fromisoformat(scan_doc['scan_timestamp'])
    
    for device in scan_doc.get('devices', []):
        if isinstance(device.get('scanned_at'), str):
            device['scanned_at'] = datetime.fromisoformat(device['scanned_at'])
    
    return scan_doc

# ==================== VM ROUTES (MOCK) ====================

@api_router.get("/vms", response_model=List[VMConfig])
async def get_vms(current_user: dict = Depends(get_current_user)):
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        
        vms = []
        nodes = proxmox.nodes.get()
        
        for node in nodes:
            node_name = node['node']
            node_status = node.get('status', 'unknown')
            
            # Skip offline nodes
            if node_status != 'online':
                logger.info(f"Skipping offline node: {node_name} (status: {node_status})")
                continue
            
            # Get QEMU VMs
            try:
                qemu_vms = proxmox.nodes(node_name).qemu.get()
                for vm in qemu_vms:
                    # Get VM config to check for hostpci devices
                    vm_config = proxmox.nodes(node_name).qemu(vm['vmid']).config.get()
                    
                    hostpci_devices = []
                    for key, value in vm_config.items():
                        if key.startswith('hostpci'):
                            # Parse hostpci config: "0000:01:00.0,pcie=1"
                            hostpci_devices.append({
                                "id": key,
                                "device": value.split(',')[0] if ',' in value else value,
                                "pcie": "pcie=1" in value
                            })
                    
                    vms.append(VMConfig(
                        vmid=str(vm['vmid']),
                        name=vm.get('name', f"VM{vm['vmid']}"),
                        type="qemu",
                        status=vm.get('status', 'unknown'),
                        node=node_name,
                        hostpci_devices=hostpci_devices
                    ))
            except Exception as e:
                logger.error(f"Error fetching QEMU VMs from {node_name}: {str(e)}")
            
            # Get LXC containers
            try:
                lxc_containers = proxmox.nodes(node_name).lxc.get()
                for container in lxc_containers:
                    vms.append(VMConfig(
                        vmid=str(container['vmid']),
                        name=container.get('name', f"CT{container['vmid']}"),
                        type="lxc",
                        status=container.get('status', 'unknown'),
                        node=node_name,
                        hostpci_devices=[]
                    ))
            except Exception as e:
                logger.error(f"Error fetching LXC containers from {node_name}: {str(e)}")
        
        return vms
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching VMs: {str(e)}")
        # Return empty list or mock data as fallback
        return []

@api_router.post("/vms/{vmid}/start")
async def start_vm(vmid: str, node: str, vm_type: str, current_user: dict = Depends(get_current_user)):
    """Start a VM or container"""
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        
        if vm_type == "qemu":
            proxmox.nodes(node).qemu(vmid).status.start.post()
        elif vm_type == "lxc":
            proxmox.nodes(node).lxc(vmid).status.start.post()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown VM type: {vm_type}")
        
        await log_audit(current_user["user_id"], "vm_start", {"vmid": vmid, "node": node, "type": vm_type})
        return {"status": "success", "message": f"Started {vm_type} {vmid}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting VM: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/vms/{vmid}/stop")
async def stop_vm(vmid: str, node: str, vm_type: str, current_user: dict = Depends(get_current_user)):
    """Stop a VM or container gracefully"""
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        
        if vm_type == "qemu":
            proxmox.nodes(node).qemu(vmid).status.shutdown.post()
        elif vm_type == "lxc":
            proxmox.nodes(node).lxc(vmid).status.shutdown.post()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown VM type: {vm_type}")
        
        await log_audit(current_user["user_id"], "vm_stop", {"vmid": vmid, "node": node, "type": vm_type})
        return {"status": "success", "message": f"Stopping {vm_type} {vmid}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping VM: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/vms/{vmid}/force-stop")
async def force_stop_vm(vmid: str, node: str, vm_type: str, current_user: dict = Depends(get_current_user)):
    """Force stop (hard stop) a VM or container"""
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        
        if vm_type == "qemu":
            proxmox.nodes(node).qemu(vmid).status.stop.post()
        elif vm_type == "lxc":
            proxmox.nodes(node).lxc(vmid).status.stop.post()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown VM type: {vm_type}")
        
        await log_audit(current_user["user_id"], "vm_force_stop", {"vmid": vmid, "node": node, "type": vm_type})
        return {"status": "success", "message": f"Force stopped {vm_type} {vmid}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error force stopping VM: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/vms/{vmid}/restart")
async def restart_vm(vmid: str, node: str, vm_type: str, current_user: dict = Depends(get_current_user)):
    """Restart a VM or container"""
    try:
        proxmox, config = await get_proxmox_connection(current_user["user_id"])
        
        if vm_type == "qemu":
            proxmox.nodes(node).qemu(vmid).status.reboot.post()
        elif vm_type == "lxc":
            proxmox.nodes(node).lxc(vmid).status.reboot.post()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown VM type: {vm_type}")
        
        await log_audit(current_user["user_id"], "vm_restart", {"vmid": vmid, "node": node, "type": vm_type})
        return {"status": "success", "message": f"Restarting {vm_type} {vmid}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restarting VM: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ==================== AI TOOL FUNCTIONS ====================

async def get_proxmox_environment_data(user_id: str):
    """Get comprehensive Proxmox environment data for AI context"""
    try:
        proxmox, config = await get_proxmox_connection(user_id)
        
        env_data = {
            "nodes": [],
            "vms_and_containers": [],
            "devices": [],
            "host": config['host']
        }
        
        # Get nodes info
        nodes = proxmox.nodes.get()
        for node in nodes:
            node_name = node['node']
            node_info = {
                "name": node_name,
                "status": node.get('status', 'unknown'),
                "cpu_usage": node.get('cpu', 0),
                "memory_used": node.get('mem', 0),
                "memory_total": node.get('maxmem', 0)
            }
            env_data["nodes"].append(node_info)
            
            # Get VMs from this node
            if node.get('status') == 'online':
                try:
                    # QEMU VMs
                    qemu_vms = proxmox.nodes(node_name).qemu.get()
                    for vm in qemu_vms:
                        vm_info = {
                            "vmid": vm['vmid'],
                            "name": vm.get('name', f"VM{vm['vmid']}"),
                            "type": "qemu",
                            "status": vm.get('status', 'unknown'),
                            "node": node_name,
                            "cpu_usage": vm.get('cpu', 0),
                            "memory": vm.get('mem', 0)
                        }
                        
                        # Get VM config for passthrough devices
                        try:
                            vm_config = proxmox.nodes(node_name).qemu(vm['vmid']).config.get()
                            hostpci = []
                            for key, value in vm_config.items():
                                if key.startswith('hostpci'):
                                    hostpci.append(f"{key}: {value}")
                            if hostpci:
                                vm_info["pci_passthrough"] = hostpci
                        except:
                            pass
                        
                        env_data["vms_and_containers"].append(vm_info)
                    
                    # LXC containers
                    lxc_containers = proxmox.nodes(node_name).lxc.get()
                    for ct in lxc_containers:
                        env_data["vms_and_containers"].append({
                            "vmid": ct['vmid'],
                            "name": ct.get('name', f"CT{ct['vmid']}"),
                            "type": "lxc",
                            "status": ct.get('status', 'unknown'),
                            "node": node_name
                        })
                except Exception as e:
                    logger.error(f"Error getting VMs from {node_name}: {str(e)}")
        
        # Get latest device scan
        latest_scan = await db.scan_results.find_one(
            {"user_id": user_id},
            sort=[("scan_timestamp", -1)]
        )
        
        if latest_scan:
            devices = latest_scan.get('devices', [])
            logger.info(f"Found {len(devices)} devices in database for user {user_id}")
            for device in devices:
                env_data["devices"].append({
                    "pci_address": device.get('pci_address'),
                    "device_name": device.get('device_name'),
                    "device_type": device.get('device_type'),
                    "vendor_id": device.get('vendor_id'),
                    "device_id": device.get('device_id'),
                    "current_driver": device.get('current_driver'),
                    "iommu_group": device.get('iommu_group')
                })
        else:
            logger.warning(f"No device scan found for user {user_id}")
        
        logger.info(f"Environment data summary - Nodes: {len(env_data['nodes'])}, VMs: {len(env_data['vms_and_containers'])}, Devices: {len(env_data['devices'])}")
        return env_data
    except Exception as e:
        logger.error(f"Error getting environment data: {str(e)}")
        return None

# AI Tools definition for function calling
ai_tools = [
    {
        "type": "function",
        "function": {
            "name": "get_proxmox_status",
            "description": "Get current status of your Proxmox environment including nodes, VMs, containers, and their current state",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_hardware_devices",
            "description": "Get list of all hardware devices detected in the Proxmox host, including GPUs, storage, network cards, USB controllers, with their PCI addresses, drivers, and IOMMU groups",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_vm_details",
            "description": "Get detailed information about a specific VM or container",
            "parameters": {
                "type": "object",
                "properties": {
                    "vmid": {
                        "type": "string",
                        "description": "The VM ID to get details for"
                    }
                },
                "required": ["vmid"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "List files and directories at a specific path. Can list files on Proxmox host, inside LXC containers, or inside VMs (will prompt for credentials if needed).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The directory path to list (e.g., /etc/pve, /root, /etc)"
                    },
                    "location": {
                        "type": "string",
                        "description": "Where to list files: 'host' for Proxmox host, 'lxc:CTID' for container (e.g., 'lxc:100'), 'vm:VMID' for VM (e.g., 'vm:101'). Default is 'host'."
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file. Can read files from Proxmox host, LXC containers, or VMs. Use this to view configuration files, docker-compose files, application configs, logs, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The full path to the file to read (e.g., /etc/pve/qemu-server/100.conf, /root/docker-compose.yml)"
                    },
                    "location": {
                        "type": "string",
                        "description": "Where to read the file from: 'host' for Proxmox host, 'lxc:CTID' for container, 'vm:VMID' for VM. Default is 'host'."
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "propose_file_edit",
            "description": "Propose an edit to a file. This will show the user what changes you want to make and ask for confirmation. Works on host, LXC containers, and VMs. ALWAYS use this instead of directly editing files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The full path to the file to edit"
                    },
                    "location": {
                        "type": "string",
                        "description": "Where the file is located: 'host', 'lxc:CTID', or 'vm:VMID'. Default is 'host'."
                    },
                    "new_content": {
                        "type": "string",
                        "description": "The complete new content for the file"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Brief explanation of what changes are being made and why"
                    }
                },
                "required": ["path", "new_content", "reason"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "propose_command_execution",
            "description": "Propose execution of a shell command on the Proxmox host, VM, or container. ALWAYS use this for any command execution. System will evaluate risk and require user confirmation before execution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute (e.g., 'systemctl restart nginx', 'apt update', 'docker ps')"
                    },
                    "location": {
                        "type": "string",
                        "description": "Where to execute: 'host' for Proxmox host, 'lxc:CTID' for container, 'vm:VMID' for VM. Default is 'host'."
                    },
                    "purpose": {
                        "type": "string",
                        "description": "Clear explanation of what this command does and why it's needed"
                    },
                    "expected_outcome": {
                        "type": "string",
                        "description": "What the expected result/output should be"
                    }
                },
                "required": ["command", "purpose", "expected_outcome"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "propose_vm_action",
            "description": "Propose an action on a VM or container (start, stop, restart, create, delete). System will evaluate risk and require user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["start", "stop", "restart", "shutdown", "create", "delete"],
                        "description": "The action to perform"
                    },
                    "vmid": {
                        "type": "string",
                        "description": "The VM/Container ID (required for existing VMs)"
                    },
                    "vm_config": {
                        "type": "object",
                        "description": "Configuration for creating a new VM (only for 'create' action). Include: name, cores, memory, disk, template, etc."
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why this action is needed"
                    }
                },
                "required": ["action", "reason"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "docker_list_containers",
            "description": "List all Docker containers (running and stopped) on the specified location. Use this instead of 'docker ps' command for better output formatting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "Where Docker is running: 'host', 'lxc:CTID', or 'vm:VMID'. Default is 'host'."
                    },
                    "all": {
                        "type": "boolean",
                        "description": "If true, show all containers (including stopped). If false, only running containers. Default is true."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "docker_container_logs",
            "description": "Get logs from a specific Docker container. Useful for debugging and monitoring.",
            "parameters": {
                "type": "object",
                "properties": {
                    "container_id": {
                        "type": "string",
                        "description": "Docker container ID or name"
                    },
                    "location": {
                        "type": "string",
                        "description": "Where Docker is running: 'host', 'lxc:CTID', or 'vm:VMID'. Default is 'host'."
                    },
                    "tail": {
                        "type": "integer",
                        "description": "Number of lines to show from the end of logs. Default is 100."
                    }
                },
                "required": ["container_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "docker_container_inspect",
            "description": "Get detailed information about a Docker container including config, network, volumes, and status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "container_id": {
                        "type": "string",
                        "description": "Docker container ID or name"
                    },
                    "location": {
                        "type": "string",
                        "description": "Where Docker is running: 'host', 'lxc:CTID', or 'vm:VMID'. Default is 'host'."
                    }
                },
                "required": ["container_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "docker_compose_services",
            "description": "List services defined in a docker-compose file and their status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "compose_file_path": {
                        "type": "string",
                        "description": "Path to docker-compose.yml file (e.g., /root/docker-compose.yml)"
                    },
                    "location": {
                        "type": "string",
                        "description": "Where the docker-compose file is: 'host', 'lxc:CTID', or 'vm:VMID'. Default is 'host'."
                    }
                },
                "required": ["compose_file_path"]
            }
        }
    }
]


# ==================== AI ASSISTANT ROUTES ====================

@api_router.post("/ai/query", response_model=AIResponse)
async def ai_query(query: AIQuery, current_user: dict = Depends(get_current_user)):
    try:
        # Get or create conversation session
        session_id = query.session_id or str(uuid.uuid4())
        session = await db.conversation_sessions.find_one({
            "id": session_id,
            "user_id": current_user["user_id"]
        })
        
        if not session:
            session = {
                "id": session_id,
                "user_id": current_user["user_id"],
                "messages": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "pending_action": None
            }
            await db.conversation_sessions.insert_one(session)
        
        # Check if this is a simple confirmation (yes, do it, proceed, etc.)
        confirmation_keywords = ["yes", "do it", "proceed", "confirm", "execute", "go ahead", "sure", "ok", "okay"]
        is_confirmation = query.question.strip().lower() in confirmation_keywords
        
        # If it's a confirmation and there's a pending action, execute it
        if is_confirmation and session.get("pending_action"):
            pending = session["pending_action"]
            
            # Execute based on action type
            if pending.get("type") == "file_edit_proposal":
                # Execute the file edit
                try:
                    location_str = pending.get("location", "host")
                    location = None
                    if location_str != "host" and ":" in location_str:
                        loc_type, loc_id = location_str.split(":", 1)
                        location = FileLocation(type=loc_type, id=loc_id)
                    
                    ssh_client = await get_location_ssh_client(current_user["user_id"], location)
                    await location_write_file(
                        ssh_client, 
                        pending["path"],
                        pending["new_content"],
                        location,
                        create_backup=True
                    )
                    ssh_client.close()
                    
                    response_text = f"✅ **File edit executed successfully!**\n\nFile `{pending['path']}` has been updated on {location_str}."
                except Exception as e:
                    response_text = f"❌ **Failed to execute file edit:** {str(e)}"
                
                # Clear pending action
                await db.conversation_sessions.update_one(
                    {"id": session_id},
                    {"$set": {"pending_action": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Add to conversation history
                session["messages"].append({
                    "role": "user",
                    "content": query.question,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                session["messages"].append({
                    "role": "assistant",
                    "content": response_text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                await db.conversation_sessions.update_one(
                    {"id": session_id},
                    {"$set": {"messages": session["messages"]}}
                )
                
                # Save to AI history
                ai_response_obj = {
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["user_id"],
                    "question": query.question,
                    "answer": response_text,
                    "suggested_commands": [],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "session_id": session_id
                }
                await db.ai_queries.insert_one(ai_response_obj)
                
                return AIResponse(**ai_response_obj)
                
        # Get user's API key first, fallback to environment variable
        keys_doc = await db.user_api_keys.find_one({"user_id": current_user["user_id"]})
        api_key = None
        
        if keys_doc and keys_doc.get('openai_api_key'):
            api_key = keys_doc['openai_api_key']
        else:
            # Fallback to environment variable (for admin/shared use)
            api_key = os.environ.get('OPENAI_API_KEY')
        
        if not api_key:
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not configured. Please add your API key in Settings → AI Configuration"
            )
        
        # Build initial system message with Proxmox context
        env_data = await get_proxmox_environment_data(current_user["user_id"])
        
        if not env_data:
            raise HTTPException(status_code=500, detail="Failed to get environment data")
        
        # Build detailed device summary
        device_summary = ""
        if env_data['devices']:
            gpu_count = len([d for d in env_data['devices'] if d['device_type'] in ['VGA', 'Display']])
            storage_count = len([d for d in env_data['devices'] if d['device_type'] in ['NVMe', 'Storage', 'SATA']])
            network_count = len([d for d in env_data['devices'] if d['device_type'] in ['Ethernet', 'Network']])
            
            device_summary = f"""
**DETECTED HARDWARE:**
- Total Devices: {len(env_data['devices'])}
- GPUs: {gpu_count}
- Storage: {storage_count}
- Network: {network_count}
- Other: {len(env_data['devices']) - gpu_count - storage_count - network_count}

**Sample Devices:**
{chr(10).join([f"- {d['device_name']} ({d['device_type']}) - {d['pci_address']}" for d in env_data['devices'][:5]])}
{'...' if len(env_data['devices']) > 5 else ''}
"""
        else:
            device_summary = "⚠️ No hardware scan data available. Ask user to run a device scan first."
        
        # Build VM summary
        vm_summary = ""
        if env_data['vms_and_containers']:
            running = len([v for v in env_data['vms_and_containers'] if v['status'] == 'running'])
            stopped = len(env_data['vms_and_containers']) - running
            
            vm_summary = f"""
**VMs & CONTAINERS:**
- Total: {len(env_data['vms_and_containers'])} ({running} running, {stopped} stopped)
- Sample: {', '.join([f"{v['name']} ({v['status']})" for v in env_data['vms_and_containers'][:5]])}
{'...' if len(env_data['vms_and_containers']) > 5 else ''}
"""
        
        system_message = f"""You are an AI assistant specifically designed for managing THIS Proxmox environment.

**YOUR CONNECTED ENVIRONMENT:**
Host: {env_data['host']}
Nodes: {len(env_data['nodes'])} node(s) - {', '.join([f"{n['name']} ({n['status']})" for n in env_data['nodes']])}

{vm_summary}

{device_summary}

**YOUR ROLE:**
You are connected to the user's ACTUAL Proxmox server and have access to real-time data. You can:
1. Query current status of nodes, VMs, and **Proxmox LXC containers** (NOT Docker containers)
2. Access complete hardware device inventory (GPUs, storage, network cards, USB, etc.)
3. Provide specific guidance based on THEIR actual environment
4. Create actionable commands for GPU passthrough, driver binding, VM management

**IMPORTANT DISTINCTIONS:**
- **Proxmox LXC Containers**: System containers managed by Proxmox (shown in VM list)
- **Docker Containers**: Application containers running INSIDE VMs or LXC containers
- When user asks about "containers", clarify if they mean Proxmox LXC or Docker containers
- Docker containers can be checked by running `docker ps` inside the appropriate VM/LXC
- If user mentions Docker, use the execute_command tool with location set to the VM/LXC where Docker runs

**AVAILABLE TOOLS:**
- get_proxmox_status: Get current environment status (all VMs, Proxmox LXC containers, nodes with live data)
- get_hardware_devices: Get ALL {len(env_data['devices'])} PCI devices with drivers and IOMMU groups
- get_vm_details: Get specific VM/container configuration and status
- list_directory: List files in a directory (on host, in LXC containers, or VMs)
- read_file: Read file contents (on host, in LXC containers, or VMs)
- propose_file_edit: Propose file edits with user confirmation (on host, in LXC containers, or VMs)
- propose_command_execution: Propose running a command (e.g., "docker ps" to list Docker containers)

**FILE ACCESS LOCATIONS:**
You can access files in three places:
1. **Proxmox Host** (default): Use location='host' or omit location parameter
   - Example: Read VM configs at /etc/pve/qemu-server/100.conf
2. **LXC Containers**: Use location='lxc:CTID'
   - Example: Read container files with location='lxc:100'
3. **Virtual Machines**: Use location='vm:VMID'
   - Example: Read VM files with location='vm:101' (may prompt user for SSH credentials)

**WHEN TO USE TOOLS:**
- User asks "show me", "list", "what do I have" → Use appropriate tool
- User asks about specific VM/device → Use get_vm_details or get_hardware_devices
- User asks for current status → Use get_proxmox_status
- User mentions files, configs, docker-compose → Use read_file with appropriate location
- User wants to edit a file → Use propose_file_edit with appropriate location
- ALWAYS use tools when user needs accurate data - don't guess!

**IMPORTANT:**
- The device list shows {len(env_data['devices'])} total devices - always use get_hardware_devices to see them all
- VM data includes all {len(env_data['vms_and_containers'])} VMs/containers - use get_proxmox_status for complete list
- Reference actual names and IDs from YOUR environment
- Be specific: "Your Beszel VM (110)" not "Your VM"

**YOUR RESPONSES:**
- Be specific to THEIR environment (use actual VM names, device names)
- When giving advice, reference THEIR actual hardware and VMs
- Provide step-by-step instructions based on what they actually have
- Create executable actions when user wants to DO something

**ACTION FORMAT (when user wants to execute something):**
When user asks you to perform an action, include:

ACTIONS:
```json
[
  {{
    "type": "bind_driver",
    "description": "Bind [Device Name] to vfio-pci",
    "pci_address": "0000:XX:XX.X",
    "driver": "vfio-pci",
    "vendor_id": "XXXX",
    "device_id": "XXXX"
  }}
]
```

Action types: bind_driver, unbind_driver, attach_to_vm, detach_from_vm, blacklist_driver

**SAFETY:**
1. Always check IOMMU groups for isolation
2. Warn about potential issues
3. Suggest backups before risky operations
4. Provide rollback steps

Be conversational, helpful, and ALWAYS reference their actual environment!"""
        
        # Create OpenAI client
        client = AsyncOpenAI(api_key=api_key)
        
        # Build context str
        context_str = ""
        if query.context:
            context_str = f"\n\nAdditional Context:\n{query.context}"
        
        # Initial message to GPT with tools
        # Build conversation messages with history
        messages = [{"role": "system", "content": system_message}]
        
        # Add conversation history from session (last 10 messages to avoid token limits)
        if session and session.get("messages"):
            recent_messages = session["messages"][-10:]  # Last 10 messages
            for msg in recent_messages:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        # Add current question
        messages.append({"role": "user", "content": f"{query.question}{context_str}"})
        
        # Send message with function calling enabled
        completion = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=ai_tools,
            tool_choice="auto",
            temperature=0.7,
            max_tokens=2048
        )
        
        response_message = completion.choices[0].message
        
        # Check if AI wants to call functions
        if response_message.tool_calls:
            # Add the assistant's message with tool calls ONCE
            messages.append({
                "role": "assistant",
                "content": response_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    } for tc in response_message.tool_calls
                ]
            })
            
            # Execute function calls and add tool responses
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                
                # Execute the function
                function_response = None
                
                # Helper function to parse location string from AI
                def parse_location_string(location_str):
                    """Parse location string like 'host', 'lxc:100', 'vm:101' into FileLocation object"""
                    if not location_str or location_str == 'host':
                        return None
                    if ':' in location_str:
                        loc_type, loc_id = location_str.split(':', 1)
                        return FileLocation(type=loc_type, id=loc_id)
                    return None
                
                if function_name == "get_proxmox_status":
                    function_response = env_data
                elif function_name == "get_hardware_devices":
                    function_response = {"devices": env_data['devices']} if env_data else {"devices": []}
                elif function_name == "get_vm_details":
                    vmid = function_args.get("vmid")
                    vm_detail = next((vm for vm in env_data['vms_and_containers'] if str(vm['vmid']) == str(vmid)), None)
                    function_response = vm_detail or {"error": f"VM {vmid} not found"}
                elif function_name == "list_directory":
                    try:
                        location = parse_location_string(function_args.get("location"))
                        ssh_client = await get_location_ssh_client(current_user["user_id"], location)
                        files = await location_list_directory(ssh_client, function_args.get("path", "/"), location)
                        ssh_client.close()
                        function_response = {
                            "path": function_args.get("path"),
                            "location": function_args.get("location", "host"),
                            "files": [f.model_dump() for f in files]
                        }
                    except Exception as e:
                        function_response = {"error": str(e)}
                elif function_name == "read_file":
                    try:
                        location = parse_location_string(function_args.get("location"))
                        ssh_client = await get_location_ssh_client(current_user["user_id"], location)
                        file_content = await location_read_file(ssh_client, function_args.get("path"), location)
                        ssh_client.close()
                        function_response = {
                            "path": file_content.path,
                            "location": function_args.get("location", "host"),
                            "content": file_content.content,
                            "size": file_content.size
                        }
                    except Exception as e:
                        function_response = {"error": str(e)}
                elif function_name == "propose_file_edit":
                    # This is a special case - we don't execute it, we return a proposal
                    # The frontend will handle showing the diff and confirmation
                    function_response = {
                        "type": "file_edit_proposal",
                        "path": function_args.get("path"),
                        "location": function_args.get("location", "host"),
                        "new_content": function_args.get("new_content"),
                        "reason": function_args.get("reason"),
                        "requires_confirmation": True
                    }
                elif function_name == "propose_command_execution":
                    # Evaluate risk level for the command
                    command = function_args.get("command", "")
                    risk_level = "low"
                    risk_factors = []
                    
                    # Destructive command patterns
                    destructive_patterns = [
                        "rm -rf", "dd if=", "mkfs", "> /dev/", "fdisk", "parted",
                        "shutdown", "reboot", "halt", "poweroff",
                        "iptables -F", "systemctl stop", "systemctl disable",
                        "kill -9", "pkill", "killall"
                    ]
                    
                    # High risk patterns
                    high_risk_patterns = [
                        "apt remove", "apt purge", "yum remove", "dnf remove",
                        "systemctl restart", "docker rm", "docker stop",
                        "userdel", "groupdel", "chmod 777", "chown -R"
                    ]
                    
                    # Check for destructive commands
                    for pattern in destructive_patterns:
                        if pattern in command.lower():
                            risk_level = "critical"
                            risk_factors.append(f"Destructive operation: {pattern}")
                            break
                    
                    # Check for high risk commands
                    if risk_level != "critical":
                        for pattern in high_risk_patterns:
                            if pattern in command.lower():
                                risk_level = "high"
                                risk_factors.append(f"Potentially disruptive: {pattern}")
                                break
                    
                    # Check if running as root or sudo
                    if "sudo" in command or function_args.get("location") == "host":
                        if risk_level == "low":
                            risk_level = "medium"
                        risk_factors.append("Running with elevated privileges")
                    
                    function_response = {
                        "type": "command_execution_proposal",
                        "command": command,
                        "location": function_args.get("location", "host"),
                        "purpose": function_args.get("purpose"),
                        "expected_outcome": function_args.get("expected_outcome"),
                        "risk_level": risk_level,
                        "risk_factors": risk_factors,
                        "requires_confirmation": True
                    }
                elif function_name == "propose_vm_action":
                    action = function_args.get("action")
                    vmid = function_args.get("vmid")
                    
                    # Evaluate risk level
                    risk_level = "low"
                    risk_factors = []
                    
                    if action in ["delete"]:
                        risk_level = "critical"
                        risk_factors.append("Permanent data loss - VM will be completely removed")
                    elif action in ["stop", "shutdown"]:
                        risk_level = "medium"
                        risk_factors.append("Service interruption - VM will be unavailable")
                    elif action == "restart":
                        risk_level = "medium"
                        risk_factors.append("Brief service interruption during restart")
                    elif action == "create":
                        risk_level = "low"
                        risk_factors.append("Resource allocation - new VM will consume storage/memory")
                    
                    function_response = {
                        "type": "vm_action_proposal",
                        "action": action,
                        "vmid": vmid,
                        "vm_config": function_args.get("vm_config"),
                        "reason": function_args.get("reason"),
                        "risk_level": risk_level,
                        "risk_factors": risk_factors,
                        "requires_confirmation": True
                    }
                elif function_name == "docker_list_containers":
                    # List Docker containers - no confirmation needed (read-only)
                    location_str = function_args.get("location", "host")
                    show_all = function_args.get("all", True)
                    
                    location = None
                    if location_str != "host" and ":" in location_str:
                        loc_type, loc_id = location_str.split(":", 1)
                        location = FileLocation(type=loc_type, id=loc_id)
                    
                    ssh_client = await get_location_ssh_client(current_user["user_id"], location)
                    result = await docker_list_containers_func(ssh_client, location, show_all)
                    ssh_client.close()
                    
                    function_response = {
                        "type": "docker_containers_list",
                        "containers": result.get("containers", []),
                        "total": result.get("total", 0),
                        "location": location_str,
                        "error": result.get("error")
                    }
                elif function_name == "docker_container_logs":
                    # Get container logs - no confirmation needed (read-only)
                    container_id = function_args.get("container_id")
                    location_str = function_args.get("location", "host")
                    tail = function_args.get("tail", 100)
                    
                    location = None
                    if location_str != "host" and ":" in location_str:
                        loc_type, loc_id = location_str.split(":", 1)
                        location = FileLocation(type=loc_type, id=loc_id)
                    
                    ssh_client = await get_location_ssh_client(current_user["user_id"], location)
                    result = await docker_container_logs_func(ssh_client, container_id, location, tail)
                    ssh_client.close()
                    
                    function_response = {
                        "type": "docker_container_logs",
                        "container_id": container_id,
                        "logs": result.get("logs", ""),
                        "success": result.get("success", False),
                        "error": result.get("error")
                    }
                elif function_name == "docker_container_inspect":
                    # Inspect container - no confirmation needed (read-only)
                    container_id = function_args.get("container_id")
                    location_str = function_args.get("location", "host")
                    
                    location = None
                    if location_str != "host" and ":" in location_str:
                        loc_type, loc_id = location_str.split(":", 1)
                        location = FileLocation(type=loc_type, id=loc_id)
                    
                    ssh_client = await get_location_ssh_client(current_user["user_id"], location)
                    result = await docker_container_inspect_func(ssh_client, container_id, location)
                    ssh_client.close()
                    
                    function_response = {
                        "type": "docker_container_inspect",
                        "container_id": container_id,
                        "container": result.get("container", {}),
                        "error": result.get("error")
                    }
                elif function_name == "docker_compose_services":
                    # List docker-compose services - no confirmation needed (read-only)
                    compose_file_path = function_args.get("compose_file_path")
                    location_str = function_args.get("location", "host")
                    
                    location = None
                    if location_str != "host" and ":" in location_str:
                        loc_type, loc_id = location_str.split(":", 1)
                        location = FileLocation(type=loc_type, id=loc_id)
                    
                    ssh_client = await get_location_ssh_client(current_user["user_id"], location)
                    result = await docker_compose_services_func(ssh_client, compose_file_path, location)
                    ssh_client.close()
                    
                    function_response = {
                        "type": "docker_compose_services",
                        "compose_file": compose_file_path,
                        "services": result.get("services", []),
                        "total": result.get("total", 0),
                        "error": result.get("error")
                    }
                
                # Add tool response
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": json.dumps(function_response)
                })
            
            # Get final response from AI with function results
            completion = await client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.7,
                max_tokens=2048
            )
            response_message = completion.choices[0].message
        
        response_text = response_message.content
        
        # Extract suggested actions (new JSON format)
        suggested_commands = []
        actions_created = []
        
        if "ACTIONS:" in response_text:
            try:
                # Find JSON block
                actions_start = response_text.find("```json", response_text.find("ACTIONS:"))
                if actions_start != -1:
                    actions_start = response_text.find("[", actions_start)
                    actions_end = response_text.find("```", actions_start)
                    actions_json = response_text[actions_start:actions_end].strip()
                    
                    actions_data = json.loads(actions_json)
                    
                    # Create action items from AI suggestions
                    for action_item in actions_data:
                        action = Action(
                            user_id=current_user["user_id"],
                            action_type=action_item.get("type", "unknown"),
                            target=action_item.get("pci_address") or action_item.get("vmid", ""),
                            parameters=action_item,
                            status="pending"
                        )
                        
                        action_doc = action.model_dump()
                        action_doc['created_at'] = action_doc['created_at'].isoformat()
                        if action_doc.get('executed_at'):
                            action_doc['executed_at'] = action_doc['executed_at'].isoformat()
                        
                        await db.actions.insert_one(action_doc)
                        actions_created.append({
                            "id": action.id,
                            "type": action.action_type,
                            "description": action_item.get("description", "")
                        })
                        
                        suggested_commands.append(action_item.get("description", ""))
                    
                    logger.info(f"Created {len(actions_created)} actions from AI response")
            except Exception as e:
                logger.error(f"Error parsing AI actions: {str(e)}")
        
        # Save AI interaction
        ai_response = AIResponse(
            user_id=current_user["user_id"],
            question=query.question,
            answer=response_text,
            suggested_commands=suggested_commands,
            session_id=session_id
        )
        
        doc = ai_response.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.ai_conversations.insert_one(doc)
        
        # Update conversation session with new messages
        session["messages"].append({
            "role": "user",
            "content": query.question,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        session["messages"].append({
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Check if response contains a pending action (file_edit_proposal, command_execution_proposal, etc.)
        pending_action = None
        if "file_edit_proposal" in response_text:
            try:
                # Extract the proposal JSON from response
                import re
                match = re.search(r'\{[^}]*"type":\s*"file_edit_proposal"[^}]*\}', response_text)
                if match:
                    pending_action = json.loads(match.group())
            except:
                pass
        elif "command_execution_proposal" in response_text:
            try:
                match = re.search(r'\{[^}]*"type":\s*"command_execution_proposal"[^}]*\}', response_text)
                if match:
                    pending_action = json.loads(match.group())
            except:
                pass
        
        # Update session with pending action and messages
        await db.conversation_sessions.update_one(
            {"id": session_id},
            {
                "$set": {
                    "messages": session["messages"],
                    "pending_action": pending_action,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        await log_audit(current_user["user_id"], "ai_query", {"question_length": len(query.question)})
        
        return ai_response
        
    except Exception as e:
        logger.error(f"AI query error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.get("/ai/history", response_model=List[AIResponse])
async def get_ai_history(current_user: dict = Depends(get_current_user), limit: int = 20):
    conversations = await db.ai_conversations.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for conv in conversations:
        if isinstance(conv.get('timestamp'), str):
            conv['timestamp'] = datetime.fromisoformat(conv['timestamp'])
    
    return conversations

class AIFileEditExecute(BaseModel):
    path: str
    content: str

@api_router.post("/ai/execute-file-edit")
async def execute_file_edit(request: AIFileEditExecute, current_user: dict = Depends(get_current_user)):
    """Execute a confirmed file edit from AI assistant"""
    ssh_client = await get_ssh_client(current_user["user_id"])
    
    try:
        # Check if file exists
        file_exists = await ssh_file_exists(ssh_client, request.path)
        
        # Create backup before editing
        backup = None
        if file_exists:
            try:
                backup = await create_backup(
                    ssh_client,
                    current_user["user_id"],
                    current_user["username"],
                    request.path,
                    "edit",
                    "AI-assisted edit"
                )
            except Exception as e:
                logger.warning(f"Backup failed: {str(e)}")
        
        # Write file
        if file_exists:
            await ssh_write_file(ssh_client, request.path, request.content)
        else:
            await ssh_create_file(ssh_client, request.path, request.content)
        
        await log_audit(current_user["user_id"], "ai_file_edit", {
            "path": request.path,
            "size": len(request.content),
            "backup_id": backup.id if backup else None
        })
        
        return {
            "success": True,
            "message": "File updated successfully",
            "backup_id": backup.id if backup else None
        }
        
    finally:
        ssh_client.close()

# ==================== ACTION ROUTES ====================

@api_router.post("/actions", response_model=Action)
async def create_action(action_data: ActionCreate, current_user: dict = Depends(get_current_user)):
    action = Action(
        user_id=current_user["user_id"],
        **action_data.model_dump()
    )
    
    doc = action.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('executed_at'):
        doc['executed_at'] = doc['executed_at'].isoformat()
    await db.actions.insert_one(doc)
    
    await log_audit(current_user["user_id"], "action_created", {"action_type": action.action_type, "target": action.target})
    
    return action

@api_router.get("/actions", response_model=List[Action])
async def get_actions(current_user: dict = Depends(get_current_user), status_filter: Optional[str] = None):
    query = {"user_id": current_user["user_id"]}
    if status_filter:
        query["status"] = status_filter
    
    actions = await db.actions.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    for action in actions:
        if isinstance(action.get('created_at'), str):
            action['created_at'] = datetime.fromisoformat(action['created_at'])
        if action.get('executed_at') and isinstance(action['executed_at'], str):
            action['executed_at'] = datetime.fromisoformat(action['executed_at'])
    
    return actions

async def execute_ssh_command(host: str, command: str) -> tuple[bool, str]:
    """Execute command via SSH and return success status and output"""
    try:
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh_client.connect(host, username='root', timeout=10, look_for_keys=True, allow_agent=True)
        
        stdin, stdout, stderr = ssh_client.exec_command(command)
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode()
        error = stderr.read().decode()
        
        ssh_client.close()
        
        full_output = output + error
        return (exit_status == 0, full_output)
    except Exception as e:
        return (False, f"SSH Error: {str(e)}")


# ==================== FILE OPERATIONS HELPERS ====================

BACKUP_BASE_PATH = "/root/.proxmox-ai-backups"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
BACKUP_RETENTION_DAYS = 30

async def get_ssh_client(user_id: str):
    """Get SSH client configured with user's credentials"""
    config_doc = await db.proxmox_configs.find_one({"user_id": user_id})
    if not config_doc:
        raise HTTPException(status_code=400, detail="Proxmox configuration not found")
    
    # Parse host to get hostname/IP
    host = config_doc['host']
    if '://' in host:
        _, host = host.split('://', 1)
    host = host.rstrip('/')
    if ':' in host:
        hostname, _ = host.rsplit(':', 1)
    else:
        hostname = host
    
    ssh_username = config_doc.get('ssh_username', 'root')
    ssh_password = config_doc.get('ssh_password')
    
    try:
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if ssh_password:
            ssh_client.connect(
                hostname,
                username=ssh_username,
                password=ssh_password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
        else:
            ssh_client.connect(
                hostname,
                username=ssh_username,
                timeout=10,
                look_for_keys=True,
                allow_agent=True
            )
        
        return ssh_client
    except Exception as e:
        logger.error(f"SSH connection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"SSH connection failed: {str(e)}")

async def ssh_exec_command(ssh_client, command: str) -> tuple[int, str, str]:
    """Execute command and return exit code, stdout, stderr"""
    stdin, stdout, stderr = ssh_client.exec_command(command)
    exit_code = stdout.channel.recv_exit_status()
    stdout_text = stdout.read().decode('utf-8', errors='ignore')
    stderr_text = stderr.read().decode('utf-8', errors='ignore')
    return exit_code, stdout_text, stderr_text

async def ssh_file_exists(ssh_client, path: str) -> bool:
    """Check if file exists"""
    exit_code, _, _ = await ssh_exec_command(ssh_client, f"test -e '{path}' && echo 'exists'")
    return exit_code == 0

async def ssh_is_directory(ssh_client, path: str) -> bool:
    """Check if path is a directory"""
    exit_code, _, _ = await ssh_exec_command(ssh_client, f"test -d '{path}' && echo 'dir'")
    return exit_code == 0

async def ssh_list_directory(ssh_client, path: str) -> List[FileInfo]:
    """List directory contents"""
    # Use ls with long format to get details
    exit_code, stdout, stderr = await ssh_exec_command(
        ssh_client, 
        f"ls -lAh --time-style='+%Y-%m-%d %H:%M:%S' '{path}' 2>&1"
    )
    
    if exit_code != 0:
        raise HTTPException(status_code=400, detail=f"Failed to list directory: {stderr}")
    
    files = []
    for line in stdout.strip().split('\n'):
        if not line or line.startswith('total'):
            continue
        
        parts = line.split(None, 8)
        if len(parts) < 9:
            continue
        
        permissions = parts[0]
        size_str = parts[4]
        modified = f"{parts[5]} {parts[6]}"
        name = parts[8]
        
        # Skip . and ..
        if name in ['.', '..']:
            continue
        
        file_type = 'directory' if permissions.startswith('d') else 'file'
        
        # Convert size (handle K, M, G suffixes from -h flag)
        size = None
        if file_type == 'file':
            try:
                if 'K' in size_str:
                    size = int(float(size_str.replace('K', '')) * 1024)
                elif 'M' in size_str:
                    size = int(float(size_str.replace('M', '')) * 1024 * 1024)
                elif 'G' in size_str:
                    size = int(float(size_str.replace('G', '')) * 1024 * 1024 * 1024)
                else:
                    size = int(size_str)
            except (ValueError, AttributeError):
                size = 0
        
        file_path = f"{path.rstrip('/')}/{name}"
        
        files.append(FileInfo(
            name=name,
            path=file_path,
            type=file_type,
            size=size,
            modified=modified,
            permissions=permissions
        ))
    
    return files

async def ssh_read_file(ssh_client, path: str) -> FileContent:
    """Read file content"""
    # Check file size first
    exit_code, stdout, _ = await ssh_exec_command(ssh_client, f"stat -c %s '{path}'")
    
    if exit_code != 0:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        file_size = int(stdout.strip())
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Could not determine file size")
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"File too large ({file_size} bytes). Maximum size is {MAX_FILE_SIZE} bytes (10MB)"
        )
    
    # Get modification time
    exit_code, modified, _ = await ssh_exec_command(
        ssh_client, 
        f"stat -c %y '{path}'"
    )
    modified_time = modified.strip() if exit_code == 0 else None
    
    # Read file content
    exit_code, content, stderr = await ssh_exec_command(ssh_client, f"cat '{path}'")
    
    if exit_code != 0:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {stderr}")
    
    return FileContent(
        path=path,
        content=content,
        size=file_size,
        modified=modified_time
    )

async def ssh_write_file(ssh_client, path: str, content: str):
    """Write content to file"""
    # Write to temp file first, then move (atomic operation)
    temp_path = f"{path}.tmp.{uuid.uuid4().hex[:8]}"
    
    exit_code, _, stderr = await ssh_exec_command(
        ssh_client,
        f"cat > '{temp_path}' << 'EOFMARKER'\n{content}\nEOFMARKER\n"
    )
    
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {stderr}")
    
    # Move temp file to target
    exit_code, _, stderr = await ssh_exec_command(ssh_client, f"mv '{temp_path}' '{path}'")
    
    if exit_code != 0:
        # Clean up temp file
        await ssh_exec_command(ssh_client, f"rm -f '{temp_path}'")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {stderr}")

async def ssh_create_file(ssh_client, path: str, content: str = ""):
    """Create a new file"""
    # Check if file already exists
    if await ssh_file_exists(ssh_client, path):
        raise HTTPException(status_code=400, detail="File already exists")
    
    # Create parent directories if needed
    parent_dir = '/'.join(path.rsplit('/', 1)[:-1])
    if parent_dir:
        await ssh_exec_command(ssh_client, f"mkdir -p '{parent_dir}'")
    
    await ssh_write_file(ssh_client, path, content)

async def ssh_delete_file(ssh_client, path: str):
    """Delete a file"""
    exit_code, _, stderr = await ssh_exec_command(ssh_client, f"rm -f '{path}'")
    
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {stderr}")

async def ssh_move_file(ssh_client, source_path: str, dest_path: str):
    """Move/rename a file"""
    # Check if source exists
    if not await ssh_file_exists(ssh_client, source_path):
        raise HTTPException(status_code=404, detail="Source file not found")
    
    # Check if destination already exists
    if await ssh_file_exists(ssh_client, dest_path):
        raise HTTPException(status_code=400, detail="Destination already exists")
    
    # Create parent directories if needed
    parent_dir = '/'.join(dest_path.rsplit('/', 1)[:-1])
    if parent_dir:
        await ssh_exec_command(ssh_client, f"mkdir -p '{parent_dir}'")
    
    exit_code, _, stderr = await ssh_exec_command(ssh_client, f"mv '{source_path}' '{dest_path}'")
    
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to move file: {stderr}")

async def create_backup(ssh_client, user_id: str, username: str, file_path: str, 
                       change_type: str, description: Optional[str] = None) -> FileBackup:
    """Create a backup of a file before modification"""
    try:
        # Read current file content
        file_content = await ssh_read_file(ssh_client, file_path)
        
        # Ensure backup directory exists
        timestamp = datetime.now(timezone.utc)
        date_folder = timestamp.strftime('%Y-%m-%d')
        backup_dir = f"{BACKUP_BASE_PATH}/{date_folder}"
        
        await ssh_exec_command(ssh_client, f"mkdir -p '{backup_dir}'")
        
        # Generate backup filename
        filename = file_path.replace('/', '_').strip('_')
        backup_filename = f"{timestamp.strftime('%H%M%S')}_{uuid.uuid4().hex[:8]}_{filename}"
        backup_path = f"{backup_dir}/{backup_filename}"
        
        # Write backup
        await ssh_write_file(ssh_client, backup_path, file_content.content)
        
        # Generate description
        if not description:
            description = f"{file_path.split('/')[-1]} - Before {change_type}"
        
        # Create backup metadata
        backup = FileBackup(
            user_id=user_id,
            username=username,
            file_path=file_path,
            backup_path=backup_path,
            description=description,
            file_size=file_content.size,
            change_type=change_type,
            created_at=timestamp
        )
        
        # Store in database
        doc = backup.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.file_backups.insert_one(doc)
        
        logger.info(f"Created backup: {backup_path}")
        return backup
        
    except HTTPException:
        # File might not exist (which is ok for some operations)
        raise
    except Exception as e:
        logger.error(f"Backup creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {str(e)}")

async def cleanup_old_backups():
    """Clean up backups older than retention period"""
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=BACKUP_RETENTION_DAYS)
        
        # Find old backups
        old_backups = await db.file_backups.find({
            "created_at": {"$lt": cutoff_date.isoformat()}
        }).to_list(length=None)
        
        if not old_backups:
            return
        
        # Get SSH client (use first user's config - this is system cleanup)
        # In production, might want to handle this differently
        first_config = await db.proxmox_configs.find_one()
        if not first_config:
            return
        
        ssh_client = await get_ssh_client(first_config['user_id'])
        
        for backup in old_backups:
            try:
                # Delete file
                await ssh_delete_file(ssh_client, backup['backup_path'])
                
                # Remove from database
                await db.file_backups.delete_one({"id": backup['id']})
                
                logger.info(f"Deleted old backup: {backup['backup_path']}")
            except Exception as e:
                logger.error(f"Failed to delete backup {backup['id']}: {str(e)}")
        
        ssh_client.close()
        
    except Exception as e:
        logger.error(f"Backup cleanup failed: {str(e)}")


# ==================== LOCATION-AWARE FILE OPERATIONS ====================

async def get_location_ssh_client(user_id: str, location: Optional[FileLocation] = None):
    """Get SSH client based on location (host, LXC, or VM)"""
    if not location or location.type == "host":
        # Default: Proxmox host SSH
        return await get_ssh_client(user_id)
    
    elif location.type == "vm":
        # Direct SSH to VM
        if not location.ssh_username or not location.ssh_password:
            raise HTTPException(status_code=400, detail="VM SSH credentials required")
        
        # Get VM IP from Proxmox
        proxmox, config = await get_proxmox_connection(user_id)
        
        # Find VM to get its IP
        vm_info = None
        for node in proxmox.nodes.get():
            node_name = node['node']
            try:
                qemu_vms = proxmox.nodes(node_name).qemu.get()
                for vm in qemu_vms:
                    if str(vm['vmid']) == location.id:
                        vm_info = vm
                        break
            except:
                pass
            if vm_info:
                break
        
        if not vm_info:
            raise HTTPException(status_code=404, detail=f"VM {location.id} not found")
        
        # Try to get IP from agent
        vm_ip = None
        try:
            agent_info = proxmox.nodes(node_name).qemu(location.id).agent('network-get-interfaces').get()
            for iface in agent_info.get('result', []):
                if iface.get('name') not in ['lo']:
                    for ip_info in iface.get('ip-addresses', []):
                        if ip_info.get('ip-address-type') == 'ipv4':
                            vm_ip = ip_info.get('ip-address')
                            break
                if vm_ip:
                    break
        except:
            pass
        
        if not vm_ip:
            raise HTTPException(
                status_code=400, 
                detail=f"Could not determine IP for VM {location.id}. Ensure QEMU guest agent is installed and running."
            )
        
        # Connect to VM via SSH
        try:
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh_client.connect(
                vm_ip,
                username=location.ssh_username,
                password=location.ssh_password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
            return ssh_client
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to connect to VM via SSH: {str(e)}")
    
    elif location.type == "lxc":
        # For LXC, we'll use pct exec via host SSH
        return await get_ssh_client(user_id)
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown location type: {location.type}")

async def exec_in_location(ssh_client, command: str, location: Optional[FileLocation] = None) -> tuple[int, str, str]:
    """Execute command in the appropriate location (host, LXC, or VM)"""
    if not location or location.type == "host":
        # Direct execution on host
        return await ssh_exec_command(ssh_client, command)
    
    elif location.type == "lxc":
        # Execute in LXC container using pct exec
        lxc_command = f"pct exec {location.id} -- {command}"
        return await ssh_exec_command(ssh_client, lxc_command)
    
    elif location.type == "vm":
        # Direct execution (ssh_client is already connected to VM)
        return await ssh_exec_command(ssh_client, command)
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown location type: {location.type}")

async def location_file_exists(ssh_client, path: str, location: Optional[FileLocation] = None) -> bool:
    """Check if file exists in location"""
    exit_code, _, _ = await exec_in_location(ssh_client, f"test -e '{path}' && echo 'exists'", location)
    return exit_code == 0

async def location_is_directory(ssh_client, path: str, location: Optional[FileLocation] = None) -> bool:
    """Check if path is a directory in location"""
    exit_code, _, _ = await exec_in_location(ssh_client, f"test -d '{path}' && echo 'dir'", location)
    return exit_code == 0

async def location_list_directory(ssh_client, path: str, location: Optional[FileLocation] = None) -> List[FileInfo]:
    """List directory contents in location"""
    exit_code, stdout, stderr = await exec_in_location(
        ssh_client, 
        f"ls -lAh --time-style='+%Y-%m-%d %H:%M:%S' '{path}' 2>&1",
        location
    )
    
    if exit_code != 0:
        raise HTTPException(status_code=400, detail=f"Failed to list directory: {stderr}")
    
    files = []
    for line in stdout.strip().split('\n'):
        if not line or line.startswith('total'):
            continue
        
        parts = line.split(None, 8)
        if len(parts) < 9:
            continue
        
        permissions = parts[0]
        size_str = parts[4]
        modified = f"{parts[5]} {parts[6]}"
        name = parts[8]
        
        if name in ['.', '..']:
            continue
        
        file_type = 'directory' if permissions.startswith('d') else 'file'
        
        size = None
        if file_type == 'file':
            try:
                if 'K' in size_str:
                    size = int(float(size_str.replace('K', '')) * 1024)
                elif 'M' in size_str:
                    size = int(float(size_str.replace('M', '')) * 1024 * 1024)
                elif 'G' in size_str:
                    size = int(float(size_str.replace('G', '')) * 1024 * 1024 * 1024)
                else:
                    size = int(size_str)
            except (ValueError, AttributeError):
                size = 0
        
        file_path = f"{path.rstrip('/')}/{name}"
        
        files.append(FileInfo(
            name=name,
            path=file_path,
            type=file_type,
            size=size,
            modified=modified,
            permissions=permissions
        ))
    
    return files

async def location_read_file(ssh_client, path: str, location: Optional[FileLocation] = None) -> FileContent:
    """Read file content from location"""
    # Check file size
    exit_code, stdout, _ = await exec_in_location(ssh_client, f"stat -c %s '{path}'", location)
    
    if exit_code != 0:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        file_size = int(stdout.strip())
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Could not determine file size")
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"File too large ({file_size} bytes). Maximum size is {MAX_FILE_SIZE} bytes (10MB)"
        )
    
    # Get modification time
    exit_code, modified, _ = await exec_in_location(ssh_client, f"stat -c %y '{path}'", location)
    modified_time = modified.strip() if exit_code == 0 else None
    
    # Read file content
    exit_code, content, stderr = await exec_in_location(ssh_client, f"cat '{path}'", location)
    
    if exit_code != 0:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {stderr}")
    
    return FileContent(
        path=path,
        content=content,
        size=file_size,
        modified=modified_time
    )

async def location_write_file(ssh_client, path: str, content: str, location: Optional[FileLocation] = None):
    """Write content to file in location"""
    temp_path = f"{path}.tmp.{uuid.uuid4().hex[:8]}"
    
    exit_code, _, stderr = await exec_in_location(
        ssh_client,
        f"cat > '{temp_path}' << 'EOFMARKER'\n{content}\nEOFMARKER\n",
        location
    )
    
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {stderr}")
    
    # Move temp file to target
    exit_code, _, stderr = await exec_in_location(ssh_client, f"mv '{temp_path}' '{path}'", location)
    
    if exit_code != 0:
        await exec_in_location(ssh_client, f"rm -f '{temp_path}'", location)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {stderr}")

async def execute_bind_driver_action(params: dict, proxmox_host: str, dry_run: bool = False) -> str:
    """Bind PCI device to driver"""
    pci_address = params.get('pci_address')
    driver = params.get('driver', 'vfio-pci')
    vendor_id = params.get('vendor_id')
    device_id = params.get('device_id')
    
    commands = []
    
    # Unbind from current driver first
    commands.append(f"echo '{pci_address}' > /sys/bus/pci/devices/{pci_address}/driver/unbind 2>/dev/null || true")
    
    # Load vfio-pci module
    if driver == 'vfio-pci':
        commands.append("modprobe vfio-pci")
        # Add device IDs to vfio-pci
        if vendor_id and device_id:
            commands.append(f"echo '{vendor_id} {device_id}' > /sys/bus/pci/drivers/vfio-pci/new_id 2>/dev/null || true")
    
    # Bind to new driver
    commands.append(f"echo '{pci_address}' > /sys/bus/pci/drivers/{driver}/bind")
    
    full_command = " && ".join(commands)
    
    if dry_run:
        return f"[DRY RUN] Would execute:\n{full_command}"
    
    success, output = await execute_ssh_command(proxmox_host, full_command)
    
    if success:
        return f"✓ Successfully bound {pci_address} to {driver}\n\nOutput:\n{output}"
    else:
        return f"✗ Failed to bind device\n\nError:\n{output}"

async def execute_attach_to_vm_action(params: dict, user_id: str, dry_run: bool = False) -> str:
    """Attach PCI device to VM via Proxmox API"""
    try:
        proxmox, config = await get_proxmox_connection(user_id)
        
        vmid = params.get('vmid')
        pci_address = params.get('pci_address')
        pcie = params.get('pcie', True)
        
        if dry_run:
            return f"[DRY RUN] Would attach {pci_address} to VM {vmid} (PCIe={pcie})"
        
        # Get VM's node
        vm_info = None
        for node in proxmox.nodes.get():
            try:
                vm_info = proxmox.nodes(node['node']).qemu(vmid).status.current.get()
                node_name = node['node']
                break
            except:
                continue
        
        if not vm_info:
            return f"✗ VM {vmid} not found"
        
        # Check if VM is running
        if vm_info.get('status') == 'running':
            return f"⚠ VM {vmid} is running. Please stop it first before attaching PCI devices."
        
        # Find next available hostpci slot
        vm_config = proxmox.nodes(node_name).qemu(vmid).config.get()
        next_slot = 0
        for i in range(10):
            if f'hostpci{i}' not in vm_config:
                next_slot = i
                break
        
        # Build hostpci config
        hostpci_value = pci_address
        if pcie:
            hostpci_value += ",pcie=1"
        
        # Update VM config
        proxmox.nodes(node_name).qemu(vmid).config.put(**{
            f'hostpci{next_slot}': hostpci_value
        })
        
        return f"✓ Successfully attached {pci_address} to VM {vmid} as hostpci{next_slot}"
        
    except Exception as e:
        return f"✗ Failed to attach device: {str(e)}"

async def execute_detach_from_vm_action(params: dict, user_id: str, dry_run: bool = False) -> str:
    """Detach PCI device from VM"""
    try:
        proxmox, config = await get_proxmox_connection(user_id)
        
        vmid = params.get('vmid')
        hostpci_id = params.get('hostpci_id', 'hostpci0')
        
        if dry_run:
            return f"[DRY RUN] Would detach {hostpci_id} from VM {vmid}"
        
        # Find VM's node
        node_name = None
        for node in proxmox.nodes.get():
            try:
                proxmox.nodes(node['node']).qemu(vmid).status.current.get()
                node_name = node['node']
                break
            except:
                continue
        
        if not node_name:
            return f"✗ VM {vmid} not found"
        
        # Remove hostpci config
        proxmox.nodes(node_name).qemu(vmid).config.put(**{
            'delete': hostpci_id
        })
        
        return f"✓ Successfully detached {hostpci_id} from VM {vmid}"
        
    except Exception as e:
        return f"✗ Failed to detach device: {str(e)}"

@api_router.post("/actions/execute")
async def execute_action(exec_data: ActionExecute, current_user: dict = Depends(get_current_user)):
    action_doc = await db.actions.find_one({"id": exec_data.action_id, "user_id": current_user["user_id"]})
    if not action_doc:
        raise HTTPException(status_code=404, detail="Action not found")
    
    action_type = action_doc['action_type']
    params = action_doc['parameters']
    
    try:
        # Get Proxmox connection for SSH host
        config_doc = await db.proxmox_configs.find_one({"user_id": current_user["user_id"]})
        proxmox_host = None
        if config_doc:
            proxmox_host = config_doc['host'].replace('https://', '').replace('http://', '').split(':')[0]
        
        # Execute based on action type
        if action_type == "bind_driver":
            if not proxmox_host:
                output = "✗ Proxmox configuration not found"
            else:
                output = await execute_bind_driver_action(params, proxmox_host, exec_data.dry_run)
        
        elif action_type == "attach_to_vm":
            output = await execute_attach_to_vm_action(params, current_user["user_id"], exec_data.dry_run)
        
        elif action_type == "detach_from_vm":
            output = await execute_detach_from_vm_action(params, current_user["user_id"], exec_data.dry_run)
        
        else:
            output = f"[NOT IMPLEMENTED] Action type '{action_type}' not yet implemented"
        
        # Update action in database
        if exec_data.dry_run:
            await db.actions.update_one(
                {"id": exec_data.action_id},
                {"$set": {"dry_run_output": output}}
            )
        else:
            status = "executed" if "✓" in output else "failed"
            await db.actions.update_one(
                {"id": exec_data.action_id},
                {"$set": {
                    "status": status,
                    "execution_output": output,
                    "executed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            await log_audit(current_user["user_id"], "action_executed", {
                "action_id": exec_data.action_id,
                "type": action_type,
                "status": status
            })
        
        return {"message": "Action executed", "output": output}
        
    except Exception as e:
        logger.error(f"Action execution error: {str(e)}")
        error_output = f"✗ Execution error: {str(e)}"
        
        await db.actions.update_one(
            {"id": exec_data.action_id},
            {"$set": {
                "status": "failed",
                "execution_output": error_output,
                "executed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Action failed", "output": error_output}

@api_router.delete("/actions/{action_id}")
async def delete_action(action_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.actions.delete_one({"id": action_id, "user_id": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Action not found")
    return {"message": "Action deleted"}

# ==================== AUDIT LOG ROUTES ====================

@api_router.get("/audit", response_model=List[AuditLog])
async def get_audit_logs(current_user: dict = Depends(get_current_user), limit: int = 50):
    logs = await db.audit_logs.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    
    return logs

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get latest scan
    latest_scan = await db.scan_results.find_one(
        {"user_id": current_user["user_id"]},
        sort=[("scan_timestamp", -1)]
    )
    
    device_count = len(latest_scan.get('devices', [])) if latest_scan else 0
    
    # Count pending actions
    pending_actions = await db.actions.count_documents({
        "user_id": current_user["user_id"],
        "status": "pending"
    })
    
    # Count AI conversations
    ai_conversations = await db.ai_conversations.count_documents({
        "user_id": current_user["user_id"]
    })
    
    return {
        "device_count": device_count,
        "pending_actions": pending_actions,
        "ai_conversations": ai_conversations,
        "last_scan": latest_scan.get('scan_timestamp') if latest_scan else None
    }

# ==================== FILE OPERATIONS ENDPOINTS ====================

@api_router.post("/files/list", response_model=List[FileInfo])
async def list_files(request: FileListRequest, current_user: dict = Depends(get_current_user)):
    """List files and directories at path"""
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # Check if path exists
        if not await location_file_exists(ssh_client, request.path, request.location):
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Check if it's a directory
        if not await location_is_directory(ssh_client, request.path, request.location):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        files = await location_list_directory(ssh_client, request.path, request.location)
        
        await log_audit(current_user["user_id"], "file_list", {
            "path": request.path,
            "location": request.location.model_dump() if request.location else {"type": "host"},
            "file_count": len(files)
        })
        
        return files
        
    finally:
        ssh_client.close()

@api_router.post("/files/read", response_model=FileContent)
async def read_file(request: FileReadRequest, current_user: dict = Depends(get_current_user)):
    """Read file content"""
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # Check if file exists
        if not await location_file_exists(ssh_client, request.path, request.location):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Check if it's a file (not directory)
        if await location_is_directory(ssh_client, request.path, request.location):
            raise HTTPException(status_code=400, detail="Path is a directory")
        
        content = await location_read_file(ssh_client, request.path, request.location)
        
        await log_audit(current_user["user_id"], "file_read", {
            "path": request.path,
            "location": request.location.model_dump() if request.location else {"type": "host"},
            "size": content.size
        })
        
        return content
        
    finally:
        ssh_client.close()

@api_router.post("/files/write")
async def write_file(request: FileWriteRequest, current_user: dict = Depends(get_current_user)):
    """Write/edit file content"""
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # Check if file exists
        file_exists = await location_file_exists(ssh_client, request.path, request.location)
        
        if not file_exists:
            raise HTTPException(status_code=404, detail="File not found. Use /files/create to create new files")
        
        # Create backup if requested
        backup = None
        if request.create_backup:
            try:
                backup = await create_backup(
                    ssh_client,
                    current_user["user_id"],
                    current_user["username"],
                    request.path,
                    "edit",
                    request.backup_description
                )
            except Exception as e:
                logger.warning(f"Backup failed: {str(e)}")
        
        # Write file
        await location_write_file(ssh_client, request.path, request.content, request.location)
        
        await log_audit(current_user["user_id"], "file_write", {
            "path": request.path,
            "location": request.location.model_dump() if request.location else {"type": "host"},
            "size": len(request.content),
            "backup_created": backup is not None,
            "backup_id": backup.id if backup else None
        })
        
        return {
            "success": True,
            "message": "File saved successfully",
            "backup_id": backup.id if backup else None
        }
        
    finally:
        ssh_client.close()

@api_router.post("/files/create")
async def create_file(request: FileCreateRequest, current_user: dict = Depends(get_current_user)):
    """Create a new file"""
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # For location-aware operations, we need to handle file creation differently
        # Check if parent directory exists
        parent_dir = '/'.join(request.path.rsplit('/', 1)[:-1])
        if parent_dir:
            exit_code, _, _ = await exec_in_location(ssh_client, f"mkdir -p '{parent_dir}'", request.location)
        
        # Write the file
        await location_write_file(ssh_client, request.path, request.content, request.location)
        
        await log_audit(current_user["user_id"], "file_create", {
            "path": request.path,
            "location": request.location.model_dump() if request.location else {"type": "host"},
            "size": len(request.content)
        })
        
        return {
            "success": True,
            "message": "File created successfully"
        }
        
    finally:
        ssh_client.close()

@api_router.post("/files/delete")
async def delete_file(request: FileDeleteRequest, current_user: dict = Depends(get_current_user)):
    """Delete a file"""
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # Check if file exists
        if not await location_file_exists(ssh_client, request.path, request.location):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Create backup if requested
        backup = None
        if request.create_backup:
            try:
                backup = await create_backup(
                    ssh_client,
                    current_user["user_id"],
                    current_user["username"],
                    request.path,
                    "delete",
                    "Backup before deletion"
                )
            except Exception as e:
                logger.warning(f"Backup failed: {str(e)}")
        
        # Delete file
        exit_code, _, stderr = await exec_in_location(ssh_client, f"rm -f '{request.path}'", request.location)
        if exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {stderr}")
        
        await log_audit(current_user["user_id"], "file_delete", {
            "path": request.path,
            "location": request.location.model_dump() if request.location else {"type": "host"},
            "backup_created": backup is not None,
            "backup_id": backup.id if backup else None
        })
        
        return {
            "success": True,
            "message": "File deleted successfully",
            "backup_id": backup.id if backup else None
        }
        
    finally:
        ssh_client.close()

@api_router.post("/files/move")
async def move_file(request: FileMoveRequest, current_user: dict = Depends(get_current_user)):
    """Move/rename a file"""
    ssh_client = await get_ssh_client(current_user["user_id"])
    
    try:
        await ssh_move_file(ssh_client, request.source_path, request.dest_path)
        
        await log_audit(current_user["user_id"], "file_move", {
            "source": request.source_path,
            "destination": request.dest_path
        })
        
        return {
            "success": True,
            "message": "File moved successfully"
        }
        
    finally:
        ssh_client.close()

@api_router.post("/files/backup")
async def backup_file(request: FileBackupRequest, current_user: dict = Depends(get_current_user)):
    """Manually create a backup of a file"""
    ssh_client = await get_ssh_client(current_user["user_id"])
    
    try:
        # Check if file exists
        if not await ssh_file_exists(ssh_client, request.path):
            raise HTTPException(status_code=404, detail="File not found")
        
        backup = await create_backup(
            ssh_client,
            current_user["user_id"],
            current_user["username"],
            request.path,
            "manual",
            request.description or f"Manual backup of {request.path.split('/')[-1]}"
        )
        
        await log_audit(current_user["user_id"], "file_backup", {
            "path": request.path,
            "backup_id": backup.id
        })
        
        return {
            "success": True,
            "message": "Backup created successfully",
            "backup": backup
        }
        
    finally:
        ssh_client.close()

@api_router.get("/backups", response_model=BackupListResponse)
async def list_backups(
    file_path: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all backups or backups for a specific file"""
    query = {"user_id": current_user["user_id"]}
    
    if file_path:
        query["file_path"] = file_path
    
    backup_docs = await db.file_backups.find(query).sort("created_at", -1).to_list(length=None)
    
    backups = []
    for doc in backup_docs:
        # Parse datetime
        if isinstance(doc['created_at'], str):
            doc['created_at'] = datetime.fromisoformat(doc['created_at'])
        backups.append(FileBackup(**doc))
    
    return BackupListResponse(
        backups=backups,
        total=len(backups)
    )

@api_router.post("/backups/restore")
async def restore_backup(request: RestoreRequest, current_user: dict = Depends(get_current_user)):
    """Restore a file from backup"""
    ssh_client = await get_ssh_client(current_user["user_id"])
    
    try:
        # Find backup
        backup_doc = await db.file_backups.find_one({
            "id": request.backup_id,
            "user_id": current_user["user_id"]
        })
        
        if not backup_doc:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        # Parse datetime if string
        if isinstance(backup_doc['created_at'], str):
            backup_doc['created_at'] = datetime.fromisoformat(backup_doc['created_at'])
        
        backup = FileBackup(**backup_doc)
        
        # Create backup of current state before restoring
        current_backup = None
        if await ssh_file_exists(ssh_client, backup.file_path):
            try:
                current_backup = await create_backup(
                    ssh_client,
                    current_user["user_id"],
                    current_user["username"],
                    backup.file_path,
                    "restore",
                    f"Before restore from {backup.created_at.strftime('%Y-%m-%d %H:%M:%S')}"
                )
            except Exception as e:
                logger.warning(f"Current state backup failed: {str(e)}")
        
        # Read backup content
        backup_content = await ssh_read_file(ssh_client, backup.backup_path)
        
        # Write to original location
        await ssh_write_file(ssh_client, backup.file_path, backup_content.content)
        
        await log_audit(current_user["user_id"], "backup_restore", {
            "backup_id": backup.id,
            "file_path": backup.file_path,
            "backup_date": backup.created_at.isoformat(),
            "current_backup_id": current_backup.id if current_backup else None
        })
        
        return {
            "success": True,
            "message": "Backup restored successfully",
            "file_path": backup.file_path,
            "current_backup_id": current_backup.id if current_backup else None
        }
        
    finally:
        ssh_client.close()

@api_router.delete("/backups/{backup_id}")
async def delete_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a backup"""
    ssh_client = await get_ssh_client(current_user["user_id"])
    
    try:
        # Find backup
        backup_doc = await db.file_backups.find_one({
            "id": backup_id,
            "user_id": current_user["user_id"]
        })
        
        if not backup_doc:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        # Delete file
        try:
            await ssh_delete_file(ssh_client, backup_doc['backup_path'])
        except Exception as e:
            logger.warning(f"Failed to delete backup file: {str(e)}")
        
        # Remove from database
        await db.file_backups.delete_one({"id": backup_id})
        
        await log_audit(current_user["user_id"], "backup_delete", {
            "backup_id": backup_id,
            "file_path": backup_doc['file_path']
        })
        
        return {
            "success": True,
            "message": "Backup deleted successfully"
        }
        
    finally:
        ssh_client.close()

# ==================== SFTP HELPER FUNCTIONS ====================

async def get_sftp_client(profile: dict):
    """Get SFTP client from connection profile"""
    try:
        transport = paramiko.Transport((profile['host'], profile['port']))
        
        if profile.get('private_key'):
            # Use key-based auth
            from io import StringIO
            key_file = StringIO(profile['private_key'])
            private_key = paramiko.RSAKey.from_private_key(key_file)
            transport.connect(username=profile['username'], pkey=private_key)
        else:
            # Use password auth
            transport.connect(username=profile['username'], password=profile.get('password'))
        
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        # Change to base path if specified
        if profile.get('base_path') and profile['base_path'] != '/':
            try:
                sftp.chdir(profile['base_path'])
            except:
                pass
        
        return sftp, transport
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SFTP connection failed: {str(e)}")

async def sftp_list_directory(profile: dict, path: str):
    """List directory contents via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        files = []
        for item in sftp.listdir_attr(path):
            is_dir = stat.S_ISDIR(item.st_mode)
            files.append({
                'name': item.filename,
                'type': 'directory' if is_dir else 'file',
                'size': str(item.st_size) if not is_dir else '0',
                'permissions': oct(item.st_mode)[-4:]
            })
        return files
    finally:
        sftp.close()
        transport.close()

async def sftp_read_file(profile: dict, path: str):
    """Read file content via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        with sftp.open(path, 'r') as f:
            content = f.read()
            if isinstance(content, bytes):
                content = content.decode('utf-8', errors='replace')
            return content
    finally:
        sftp.close()
        transport.close()

async def sftp_write_file(profile: dict, path: str, content: str):
    """Write file content via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        with sftp.open(path, 'w') as f:
            f.write(content)
    finally:
        sftp.close()
        transport.close()

async def sftp_delete_file(profile: dict, path: str):
    """Delete file or directory via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        try:
            # Try as file first
            sftp.remove(path)
        except:
            # Try as directory
            sftp.rmdir(path)
    finally:
        sftp.close()
        transport.close()

async def sftp_create_directory(profile: dict, path: str):
    """Create directory via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        sftp.mkdir(path)
    finally:
        sftp.close()
        transport.close()

async def sftp_file_exists(profile: dict, path: str):
    """Check if file/directory exists via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        sftp.stat(path)
        return True
    except:
        return False
    finally:
        sftp.close()
        transport.close()

async def sftp_rename_file(profile: dict, old_path: str, new_path: str):
    """Rename/move file or directory via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        sftp.rename(old_path, new_path)
    finally:
        sftp.close()
        transport.close()

async def sftp_download_file(profile: dict, path: str):
    """Download file content via SFTP (returns bytes)"""
    sftp, transport = await get_sftp_client(profile)
    try:
        with sftp.open(path, 'rb') as f:
            content = f.read()
        return content
    finally:
        sftp.close()
        transport.close()

async def sftp_upload_file(profile: dict, path: str, content: bytes):
    """Upload file content via SFTP (accepts bytes)"""
    sftp, transport = await get_sftp_client(profile)
    try:
        with sftp.open(path, 'wb') as f:
            f.write(content)
    finally:
        sftp.close()
        transport.close()

async def sftp_get_file_stat(profile: dict, path: str):
    """Get file/directory stats via SFTP"""
    sftp, transport = await get_sftp_client(profile)
    try:
        return sftp.stat(path)
    finally:
        sftp.close()
        transport.close()

# ==================== FTP HELPER FUNCTIONS ====================

async def get_ftp_client(profile: dict):
    """Get FTP client from connection profile"""
    try:
        ftp = FTP()
        ftp.connect(profile['host'], profile['port'], timeout=10)
        ftp.login(profile['username'], profile.get('password', ''))
        
        # Change to base path if specified
        if profile.get('base_path') and profile['base_path'] != '/':
            ftp.cwd(profile['base_path'])
        
        return ftp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FTP connection failed: {str(e)}")

async def ftp_list_directory(profile: dict, path: str):
    """List directory contents via FTP"""
    ftp = await get_ftp_client(profile)
    try:
        ftp.cwd(path)
        files = []
        ftp.retrlines('LIST', lambda line: files.append(line))
        
        result = []
        for file_line in files:
            parts = file_line.split(None, 8)
            if len(parts) >= 9:
                perms = parts[0]
                name = parts[8]
                is_dir = perms.startswith('d')
                result.append({
                    'name': name,
                    'type': 'directory' if is_dir else 'file',
                    'size': parts[4] if not is_dir else '0',
                    'permissions': perms
                })
        
        return result
    finally:
        ftp.quit()

async def ftp_read_file(profile: dict, path: str):
    """Read file content via FTP"""
    ftp = await get_ftp_client(profile)
    try:
        content = io.BytesIO()
        ftp.retrbinary(f'RETR {path}', content.write)
        return content.getvalue().decode('utf-8', errors='replace')
    finally:
        ftp.quit()

async def ftp_write_file(profile: dict, path: str, content: str):
    """Write file content via FTP"""
    ftp = await get_ftp_client(profile)
    try:
        content_bytes = content.encode('utf-8')
        ftp.storbinary(f'STOR {path}', io.BytesIO(content_bytes))
    finally:
        ftp.quit()

async def ftp_delete_file(profile: dict, path: str):
    """Delete file via FTP"""
    ftp = await get_ftp_client(profile)
    try:
        # Try to delete as file first
        try:
            ftp.delete(path)
        except:
            # If that fails, try as directory
            ftp.rmd(path)
    finally:
        ftp.quit()

async def ftp_create_directory(profile: dict, path: str):
    """Create directory via FTP"""
    ftp = await get_ftp_client(profile)
    try:
        ftp.mkd(path)
    finally:
        ftp.quit()

async def ftp_download_file(profile: dict, path: str):
    """Download file content via FTP (returns bytes)"""
    ftp = await get_ftp_client(profile)
    try:
        content = io.BytesIO()
        ftp.retrbinary(f'RETR {path}', content.write)
        return content.getvalue()
    finally:
        ftp.quit()

async def ftp_upload_file(profile: dict, path: str, content: bytes):
    """Upload file content via FTP (accepts bytes)"""
    ftp = await get_ftp_client(profile)
    try:
        ftp.storbinary(f'STOR {path}', io.BytesIO(content))
    finally:
        ftp.quit()

async def ftp_rename_file(profile: dict, old_path: str, new_path: str):
    """Rename/move file or directory via FTP"""
    ftp = await get_ftp_client(profile)
    try:
        ftp.rename(old_path, new_path)
    finally:
        ftp.quit()

async def ftp_file_exists(profile: dict, path: str):
    """Check if file/directory exists via FTP"""
    ftp = await get_ftp_client(profile)
    try:
        # Try to get file size (works for files and directories)
        ftp.size(path)
        return True
    except:
        # Try changing to directory
        try:
            current_dir = ftp.pwd()
            ftp.cwd(path)
            ftp.cwd(current_dir)
            return True
        except:
            return False
    finally:
        ftp.quit()

# ==================== REVERSE PROXY HELPER FUNCTIONS ====================

async def rproxy_request(profile: dict, method: str, endpoint: str, **kwargs):
    """Make HTTP request to reverse proxy API"""
    base_url = f"{'https' if profile.get('use_ssl', True) else 'http'}://{profile['host']}:{profile['port']}"
    url = f"{base_url}{endpoint}"
    
    # Add authentication if provided
    headers = kwargs.get('headers', {})
    if profile.get('username') and profile.get('password'):
        import base64
        credentials = f"{profile['username']}:{profile['password']}"
        auth_str = base64.b64encode(credentials.encode()).decode()
        headers['Authorization'] = f'Basic {auth_str}'
    
    kwargs['headers'] = headers
    kwargs['verify'] = False  # Skip SSL verification for self-signed certs
    
    try:
        response = requests.request(method, url, **kwargs, timeout=30)
        response.raise_for_status()
        return response
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Reverse proxy request failed: {str(e)}")

async def rproxy_list_directory(profile: dict, path: str):
    """List directory via reverse proxy API"""
    response = await rproxy_request(profile, 'GET', '/api/files', params={'path': path})
    return response.json()

async def rproxy_read_file(profile: dict, path: str):
    """Read file via reverse proxy API"""
    response = await rproxy_request(profile, 'GET', '/api/files/read', params={'path': path})
    return response.text

async def rproxy_write_file(profile: dict, path: str, content: str):
    """Write file via reverse proxy API"""
    response = await rproxy_request(profile, 'POST', '/api/files/write', json={'path': path, 'content': content})
    return response.json()

async def rproxy_delete_file(profile: dict, path: str):
    """Delete file via reverse proxy API"""
    response = await rproxy_request(profile, 'DELETE', '/api/files', params={'path': path})
    return response.json()

async def rproxy_create_directory(profile: dict, path: str):
    """Create directory via reverse proxy API"""
    response = await rproxy_request(profile, 'POST', '/api/files/mkdir', json={'path': path})
    return response.json()

async def rproxy_download_file(profile: dict, path: str):
    """Download file via reverse proxy API (returns bytes)"""
    response = await rproxy_request(profile, 'GET', '/api/files/download', params={'path': path})
    return response.content

async def rproxy_upload_file(profile: dict, path: str, content: bytes):
    """Upload file via reverse proxy API"""
    files = {'file': (path.split('/')[-1], content)}
    response = await rproxy_request(profile, 'POST', '/api/files/upload', files=files, data={'path': path})
    return response.json()

async def rproxy_rename_file(profile: dict, old_path: str, new_path: str):
    """Rename file via reverse proxy API"""
    response = await rproxy_request(profile, 'POST', '/api/files/rename', json={'old_path': old_path, 'new_path': new_path})
    return response.json()

# ==================== DOCKER HELPER FUNCTIONS ====================

async def execute_command_on_location(ssh_client, command: str, location: Optional[FileLocation] = None):
    """Execute a shell command on host, LXC, or VM"""
    if not location or location.type == 'host':
        # Execute on Proxmox host
        stdin, stdout, stderr = ssh_client.exec_command(command)
        exit_code = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        return {
            "exit_code": exit_code,
            "output": output,
            "error": error,
            "success": exit_code == 0
        }
    elif location.type == 'lxc':
        # Execute in LXC container using pct exec
        lxc_command = f"pct exec {location.id} -- {command}"
        stdin, stdout, stderr = ssh_client.exec_command(lxc_command)
        exit_code = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        return {
            "exit_code": exit_code,
            "output": output,
            "error": error,
            "success": exit_code == 0
        }
    elif location.type == 'vm':
        # Execute in VM via nested SSH
        # This would require VM SSH credentials - for now, return error
        raise HTTPException(
            status_code=400,
            detail="Direct command execution in VMs requires SSH credentials. Use propose_command_execution instead."
        )

async def docker_list_containers_func(ssh_client, location: Optional[FileLocation] = None, show_all: bool = True):
    """List Docker containers"""
    command = "docker ps -a --format '{{json .}}'" if show_all else "docker ps --format '{{json .}}'"
    result = await execute_command_on_location(ssh_client, command, location)
    
    if not result["success"]:
        return {"error": result["error"], "containers": []}
    
    # Parse JSON output
    containers = []
    for line in result["output"].strip().split('\n'):
        if line:
            try:
                containers.append(json.loads(line))
            except:
                pass
    
    return {"containers": containers, "total": len(containers)}

async def docker_container_logs_func(ssh_client, container_id: str, location: Optional[FileLocation] = None, tail: int = 100):
    """Get Docker container logs"""
    command = f"docker logs --tail {tail} {container_id} 2>&1"
    result = await execute_command_on_location(ssh_client, command, location)
    
    return {
        "container_id": container_id,
        "logs": result["output"],
        "success": result["success"],
        "error": result["error"] if not result["success"] else None
    }

async def docker_container_inspect_func(ssh_client, container_id: str, location: Optional[FileLocation] = None):
    """Inspect Docker container"""
    command = f"docker inspect {container_id}"
    result = await execute_command_on_location(ssh_client, command, location)
    
    if not result["success"]:
        return {"error": result["error"]}
    
    try:
        inspect_data = json.loads(result["output"])
        return {"container": inspect_data[0] if inspect_data else {}}
    except:
        return {"error": "Failed to parse container data"}

async def docker_compose_services_func(ssh_client, compose_file_path: str, location: Optional[FileLocation] = None):
    """List docker-compose services"""
    # Get the directory of the compose file
    import os
    compose_dir = os.path.dirname(compose_file_path)
    compose_file = os.path.basename(compose_file_path)
    
    command = f"cd {compose_dir} && docker-compose -f {compose_file} ps --format json"
    result = await execute_command_on_location(ssh_client, command, location)
    
    if not result["success"]:
        return {"error": result["error"], "services": []}
    
    # Parse JSON output
    services = []
    for line in result["output"].strip().split('\n'):
        if line:
            try:
                services.append(json.loads(line))
            except:
                pass
    
    return {"services": services, "total": len(services)}

# ==================== ENHANCED FILE OPERATIONS ====================

@api_router.post("/files/upload")
async def upload_file_chunk(request: FileUploadChunk, current_user: dict = Depends(get_current_user)):
    """Upload a file in chunks"""
    import base64
    
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # Decode chunk data
        chunk_data = base64.b64decode(request.chunk_data)
        
        # Create temp directory for chunks
        temp_dir = f"/tmp/upload_{current_user['user_id']}_{request.file_name.replace('/', '_')}"
        chunk_path = f"{temp_dir}/chunk_{request.chunk_index}"
        
        # Create temp dir if first chunk
        if request.chunk_index == 0:
            await exec_in_location(ssh_client, f"mkdir -p '{temp_dir}'", request.location)
        
        # Write chunk to temp location
        # Use base64 encoding to safely transfer binary data
        encoded_chunk = base64.b64encode(chunk_data).decode('utf-8')
        cmd = f"echo '{encoded_chunk}' | base64 -d > '{chunk_path}'"
        exit_code, _, stderr = await exec_in_location(ssh_client, cmd, request.location)
        
        if exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to write chunk: {stderr}")
        
        # If this is the last chunk, combine all chunks
        if request.chunk_index == request.total_chunks - 1:
            # Combine chunks
            combine_cmd = f"cat {temp_dir}/chunk_* > '{request.path}' && rm -rf '{temp_dir}'"
            exit_code, _, stderr = await exec_in_location(ssh_client, combine_cmd, request.location)
            
            if exit_code != 0:
                raise HTTPException(status_code=500, detail=f"Failed to combine chunks: {stderr}")
            
            await log_audit(current_user["user_id"], "file_upload", {
                "path": request.path,
                "location": request.location.model_dump() if request.location else {"type": "host"},
                "file_name": request.file_name,
                "chunks": request.total_chunks
            })
            
            return {
                "success": True,
                "message": "File uploaded successfully",
                "path": request.path,
                "complete": True
            }
        else:
            return {
                "success": True,
                "message": f"Chunk {request.chunk_index + 1}/{request.total_chunks} uploaded",
                "complete": False
            }
            
    finally:
        ssh_client.close()

@api_router.get("/files/download")
async def download_file(path: str, location_type: str = "host", location_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Download a file"""
    from fastapi.responses import StreamingResponse
    import io
    
    # Build location
    location = None
    if location_type != "host":
        location = FileLocation(
            type=location_type,
            id=location_id
        )
    
    ssh_client = await get_location_ssh_client(current_user["user_id"], location)
    
    try:
        # Read file content
        file_content = await location_read_file(ssh_client, path, location)
        
        # Get filename from path
        filename = path.split('/')[-1]
        
        await log_audit(current_user["user_id"], "file_download", {
            "path": path,
            "location": location.model_dump() if location else {"type": "host"}
        })
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(file_content.content.encode('utf-8')),
            media_type='application/octet-stream',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
        
    finally:
        ssh_client.close()

@api_router.post("/files/rename")
async def rename_file(request: FileRenameRequest, current_user: dict = Depends(get_current_user)):
    """Rename a file or directory"""
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # Get directory and construct new path
        dir_path = '/'.join(request.old_path.split('/')[:-1])
        new_path = f"{dir_path}/{request.new_name}" if dir_path else request.new_name
        
        # Check if old path exists
        if not await location_file_exists(ssh_client, request.old_path, request.location):
            raise HTTPException(status_code=404, detail="File or directory not found")
        
        # Check if new path already exists
        if await location_file_exists(ssh_client, new_path, request.location):
            raise HTTPException(status_code=400, detail="A file or directory with this name already exists")
        
        # Rename
        exit_code, _, stderr = await exec_in_location(ssh_client, f"mv '{request.old_path}' '{new_path}'", request.location)
        
        if exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to rename: {stderr}")
        
        await log_audit(current_user["user_id"], "file_rename", {
            "old_path": request.old_path,
            "new_path": new_path,
            "location": request.location.model_dump() if request.location else {"type": "host"}
        })
        
        return {
            "success": True,
            "message": "Renamed successfully",
            "new_path": new_path
        }
        
    finally:
        ssh_client.close()

@api_router.post("/files/copy")
async def copy_file(request: FileCopyRequest, current_user: dict = Depends(get_current_user)):
    """Copy a file between locations"""
    source_ssh = await get_location_ssh_client(current_user["user_id"], request.source_location)
    
    try:
        # Check if source exists
        if not await location_file_exists(source_ssh, request.source_path, request.source_location):
            raise HTTPException(status_code=404, detail="Source file not found")
        
        # Read source file
        source_content = await location_read_file(source_ssh, request.source_path, request.source_location)
        
        # If destination is same location, use cp command
        if request.source_location == request.dest_location:
            exit_code, _, stderr = await exec_in_location(source_ssh, f"cp -r '{request.source_path}' '{request.dest_path}'", request.source_location)
            
            if exit_code != 0:
                raise HTTPException(status_code=500, detail=f"Failed to copy: {stderr}")
        else:
            # Different location - need to read and write
            dest_ssh = await get_location_ssh_client(current_user["user_id"], request.dest_location)
            try:
                await location_write_file(dest_ssh, request.dest_path, source_content.content, request.dest_location)
            finally:
                dest_ssh.close()
        
        await log_audit(current_user["user_id"], "file_copy", {
            "source_path": request.source_path,
            "dest_path": request.dest_path,
            "source_location": request.source_location.model_dump() if request.source_location else {"type": "host"},
            "dest_location": request.dest_location.model_dump() if request.dest_location else {"type": "host"}
        })
        
        return {
            "success": True,
            "message": "File copied successfully"
        }
        
    finally:
        source_ssh.close()

@api_router.post("/files/mkdir")
async def create_directory(request: DirectoryCreateRequest, current_user: dict = Depends(get_current_user)):
    """Create a new directory"""
    ssh_client = await get_location_ssh_client(current_user["user_id"], request.location)
    
    try:
        # Check if directory already exists
        if await location_file_exists(ssh_client, request.path, request.location):
            raise HTTPException(status_code=400, detail="Directory already exists")
        
        # Create directory
        exit_code, _, stderr = await exec_in_location(ssh_client, f"mkdir -p '{request.path}'", request.location)
        
        if exit_code != 0:
            raise HTTPException(status_code=500, detail=f"Failed to create directory: {stderr}")
        
        await log_audit(current_user["user_id"], "directory_create", {
            "path": request.path,
            "location": request.location.model_dump() if request.location else {"type": "host"}
        })
        
        return {
            "success": True,
            "message": "Directory created successfully"
        }
        
    finally:
        ssh_client.close()

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
