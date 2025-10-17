from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProxmoxConfigCreate(BaseModel):
    host: str
    api_token_name: str
    api_token_secret: str
    verify_ssl: bool = False

class ProxmoxConfigResponse(BaseModel):
    id: str
    host: str
    api_token_name: str
    verify_ssl: bool
    created_at: datetime

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

# ==================== DEVICE SCANNING ROUTES (MOCK) ====================

@api_router.post("/devices/scan", response_model=ScanResult)
async def scan_devices(current_user: dict = Depends(get_current_user)):
    # Mock device scan - in production, this would use proxmoxer + SSH to run lspci
    mock_devices = [
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
    
    scan_result = ScanResult(
        user_id=current_user["user_id"],
        devices=mock_devices
    )
    
    # Save scan result
    doc = scan_result.model_dump()
    doc['scan_timestamp'] = doc['scan_timestamp'].isoformat()
    for device in doc['devices']:
        device['scanned_at'] = device['scanned_at'].isoformat()
    await db.scan_results.insert_one(doc)
    
    await log_audit(current_user["user_id"], "device_scan", {"device_count": len(mock_devices)})
    
    return scan_result

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
    # Mock VM list - in production, this would use proxmoxer API
    mock_vms = [
        VMConfig(
            vmid="100",
            name="ubuntu-desktop",
            type="qemu",
            status="running",
            node="pve",
            hostpci_devices=[]
        ),
        VMConfig(
            vmid="101",
            name="windows-gaming",
            type="qemu",
            status="stopped",
            node="pve",
            hostpci_devices=[
                {"id": "hostpci0", "device": "0000:01:00.0", "pcie": True}
            ]
        ),
        VMConfig(
            vmid="200",
            name="docker-host",
            type="lxc",
            status="running",
            node="pve",
            hostpci_devices=[]
        )
    ]
    
    return mock_vms

# ==================== AI ASSISTANT ROUTES ====================

@api_router.post("/ai/query", response_model=AIResponse)
async def ai_query(query: AIQuery, current_user: dict = Depends(get_current_user)):
    try:
        # Initialize Claude chat
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Build context for the AI
        context_str = ""
        if query.context:
            context_str = f"\n\nContext:\n{query.context}"
        
        system_message = """You are a Proxmox expert assistant specializing in hardware passthrough, IOMMU configuration, and PCI device management.
        
Your role:
- Analyze PCI devices, IOMMU groups, and driver bindings
- Suggest safe passthrough configurations
- Provide step-by-step commands for binding/unbinding drivers
- Warn about potential issues (IOMMU group conflicts, driver incompatibilities)
- Always prioritize safety and data integrity

When suggesting commands:
1. Always check IOMMU group isolation first
2. Backup configurations before changes
3. Use dry-run mode when available
4. Provide rollback instructions
5. Format commands as a JSON array in your response using the marker: COMMANDS: ["command1", "command2"]
"""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"user-{current_user['user_id']}-{str(uuid.uuid4())[:8]}",
            system_message=system_message
        ).with_model("anthropic", "claude-3-7-sonnet-20250219")
        
        user_message = UserMessage(text=f"{query.question}{context_str}")
        
        # Get AI response
        response_text = await chat.send_message(user_message)
        
        # Extract suggested commands (if any)
        suggested_commands = []
        if "COMMANDS:" in response_text:
            try:
                import json
                commands_start = response_text.find("COMMANDS:") + 9
                commands_end = response_text.find("]", commands_start) + 1
                commands_json = response_text[commands_start:commands_end].strip()
                suggested_commands = json.loads(commands_json)
            except:
                pass
        
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

@api_router.post("/actions/execute")
async def execute_action(exec_data: ActionExecute, current_user: dict = Depends(get_current_user)):
    action_doc = await db.actions.find_one({"id": exec_data.action_id, "user_id": current_user["user_id"]})
    if not action_doc:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # Mock execution - in production, this would run actual commands via SSH/API
    if exec_data.dry_run:
        output = f"[DRY RUN] Would execute {action_doc['action_type']} on {action_doc['target']}"
        await db.actions.update_one(
            {"id": exec_data.action_id},
            {"$set": {"dry_run_output": output}}
        )
    else:
        output = f"[EXECUTED] {action_doc['action_type']} on {action_doc['target']} completed successfully"
        await db.actions.update_one(
            {"id": exec_data.action_id},
            {"$set": {
                "status": "executed",
                "execution_output": output,
                "executed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        await log_audit(current_user["user_id"], "action_executed", {"action_id": exec_data.action_id})
    
    return {"message": "Action executed", "output": output}

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
