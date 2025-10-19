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
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio
from openai import AsyncOpenAI
from proxmoxer import ProxmoxAPI
import paramiko
import re

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
    background: str = "dark"  # dark, darker, midnight
    card_style: str = "glass"  # glass, solid, bordered
    accent_color: Optional[str] = None  # Optional custom accent
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ThemeUpdate(BaseModel):
    theme_name: str
    background: Optional[str] = "dark"
    card_style: Optional[str] = "glass"
    accent_color: Optional[str] = None

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

class AIResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    question: str
    answer: str
    suggested_commands: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
        
        proxmox = ProxmoxAPI(
            hostname,
            port=port,
            user=user,
            token_name=token_name,
            token_value=config_doc['api_token_secret'],
            verify_ssl=config_doc.get('verify_ssl', False),
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

# ==================== THEME ROUTES ====================

@api_router.get("/theme")
async def get_theme(current_user: dict = Depends(get_current_user)):
    theme_doc = await db.themes.find_one({"user_id": current_user["user_id"]})
    if not theme_doc:
        return {
            "theme_name": "cyan",
            "background": "dark",
            "card_style": "glass",
            "accent_color": None
        }
    return {
        "theme_name": theme_doc["theme_name"],
        "background": theme_doc.get("background", "dark"),
        "card_style": theme_doc.get("card_style", "glass"),
        "accent_color": theme_doc.get("accent_color")
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
        accent_color=theme_data.accent_color
    )
    doc = theme.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.themes.insert_one(doc)
    
    await log_audit(current_user["user_id"], "theme_updated", {
        "theme": theme_data.theme_name,
        "background": theme_data.background,
        "card_style": theme_data.card_style
    })
    
    return {
        "message": "Theme updated",
        "theme_name": theme_data.theme_name,
        "background": theme_data.background,
        "card_style": theme_data.card_style
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
        latest_scan = await db.device_scans.find_one(
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
    }
]


# ==================== AI ASSISTANT ROUTES ====================

@api_router.post("/ai/query", response_model=AIResponse)
async def ai_query(query: AIQuery, current_user: dict = Depends(get_current_user)):
    try:
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
1. Query current status of nodes, VMs, and containers
2. Access complete hardware device inventory (GPUs, storage, network cards, USB, etc.)
3. Provide specific guidance based on THEIR actual environment
4. Create actionable commands for GPU passthrough, driver binding, VM management

**AVAILABLE TOOLS:**
- get_proxmox_status: Get current environment status (all VMs, containers, nodes with live data)
- get_hardware_devices: Get ALL {len(env_data['devices'])} PCI devices with drivers and IOMMU groups
- get_vm_details: Get specific VM/container configuration and status

**WHEN TO USE TOOLS:**
- User asks "show me", "list", "what do I have" → Use appropriate tool
- User asks about specific VM/device → Use get_vm_details or get_hardware_devices
- User asks for current status → Use get_proxmox_status
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
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"{query.question}{context_str}"}
        ]
        
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
            # Execute function calls
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                
                # Execute the function
                function_response = None
                if function_name == "get_proxmox_status":
                    function_response = env_data
                elif function_name == "get_hardware_devices":
                    function_response = {"devices": env_data['devices']} if env_data else {"devices": []}
                elif function_name == "get_vm_details":
                    vmid = function_args.get("vmid")
                    vm_detail = next((vm for vm in env_data['vms_and_containers'] if str(vm['vmid']) == str(vmid)), None)
                    function_response = vm_detail or {"error": f"VM {vmid} not found"}
                
                # Add function response to messages
                messages.append(response_message.model_dump())
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
            suggested_commands=suggested_commands
        )
        
        doc = ai_response.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.ai_conversations.insert_one(doc)
        
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
