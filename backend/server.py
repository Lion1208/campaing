from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
import aiofiles
import httpx
import base64
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'nexus-whatsapp-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# WhatsApp Service URL
WHATSAPP_SERVICE_URL = os.environ.get('WHATSAPP_SERVICE_URL', 'http://localhost:3002')

# Create uploads directory
UPLOADS_DIR = ROOT_DIR / 'uploads'
UPLOADS_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="Nexus WhatsApp Campaign Manager")

# Get CORS origins from env
cors_origins_str = os.environ.get('CORS_ORIGINS', '*')
if cors_origins_str == '*':
    cors_origins = ['*']
else:
    cors_origins = [origin.strip() for origin in cors_origins_str.split(',') if origin.strip()]

# CORS Middleware - must be added FIRST before any routes
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # Cache preflight for 24 hours
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Scheduler for campaigns
scheduler = AsyncIOScheduler(timezone='America/Sao_Paulo')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= Models =============

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "reseller"  # reseller, master, admin
    max_connections: int = 1
    credits: int = 0

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    role: str
    max_connections: int
    credits: int = 0
    active: bool
    expires_at: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    max_connections: Optional[int] = None
    credits: Optional[int] = None
    active: Optional[bool] = None
    expires_at: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ProfileUpdate(BaseModel):
    username: Optional[str] = None

class TemplateCreate(BaseModel):
    name: str
    message: str
    image_id: Optional[str] = None

class TemplateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    message: str
    image_id: Optional[str] = None
    image_url: Optional[str] = None
    user_id: str
    created_at: str

class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    user_id: str
    username: str
    details: Optional[str] = None
    created_at: str

class ConnectionCreate(BaseModel):
    name: str

class ConnectionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    user_id: str
    status: str
    qr_code: Optional[str] = None
    qr_image: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: str

class GroupResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    connection_id: str
    group_id: str
    name: str
    participants_count: int

class CampaignMessageItem(BaseModel):
    message: Optional[str] = None
    image_id: Optional[str] = None

class CampaignCreate(BaseModel):
    title: str
    connection_id: str
    group_ids: List[str]
    message: Optional[str] = None
    image_id: Optional[str] = None
    messages: Optional[List[CampaignMessageItem]] = None  # Multiple messages/images
    schedule_type: str = "once"  # once, interval, specific_times
    scheduled_time: Optional[str] = None  # ISO format for "once"
    interval_hours: Optional[int] = None  # For interval type (1, 2, 4, 6, 12, 24)
    specific_times: Optional[List[str]] = None  # List of times like ["09:00", "14:00", "18:00"]
    delay_seconds: int = 5
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class CampaignResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    user_id: str
    connection_id: str
    group_ids: List[str]
    message: Optional[str] = None
    image_id: Optional[str] = None
    image_url: Optional[str] = None
    messages: Optional[List[dict]] = None  # Multiple messages with image URLs
    schedule_type: str
    scheduled_time: Optional[str] = None
    interval_hours: Optional[int] = None
    specific_times: Optional[List[str]] = None
    delay_seconds: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str
    sent_count: int
    total_count: int
    current_message_index: int = 0
    current_group_index: int = 0  # Track progress for resume functionality
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    paused_at: Optional[str] = None
    remaining_time_on_pause: Optional[int] = None  # Seconds remaining when paused
    created_at: str

class ImageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    filename: str
    url: str
    user_id: str
    created_at: str

class DashboardStats(BaseModel):
    total_connections: int
    active_connections: int
    total_campaigns: int
    pending_campaigns: int
    completed_campaigns: int
    total_groups: int
    total_messages_sent: int

# ============= Auth Helpers =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({'id': payload['user_id']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        if not user.get('active', True):
            raise HTTPException(status_code=401, detail="Usuário desativado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
    return user

# ============= WhatsApp Service Integration =============

# Auto-recovery tracking
whatsapp_recovery_attempts = 0
last_recovery_attempt = None
MAX_RECOVERY_ATTEMPTS = 3
RECOVERY_COOLDOWN = 60  # segundos entre tentativas

async def auto_recover_whatsapp_service():
    """Tenta recuperar o serviço WhatsApp automaticamente"""
    global whatsapp_recovery_attempts, last_recovery_attempt
    import subprocess
    
    now = datetime.now(timezone.utc)
    
    # Verifica cooldown
    if last_recovery_attempt:
        elapsed = (now - last_recovery_attempt).total_seconds()
        if elapsed < RECOVERY_COOLDOWN:
            logger.info(f"[AUTO-RECOVERY] Aguardando cooldown ({RECOVERY_COOLDOWN - elapsed:.0f}s restantes)")
            return False
    
    if whatsapp_recovery_attempts >= MAX_RECOVERY_ATTEMPTS:
        # Reset após 5 minutos
        if last_recovery_attempt and (now - last_recovery_attempt).total_seconds() > 300:
            whatsapp_recovery_attempts = 0
        else:
            logger.warning(f"[AUTO-RECOVERY] Máximo de tentativas atingido ({MAX_RECOVERY_ATTEMPTS})")
            return False
    
    whatsapp_recovery_attempts += 1
    last_recovery_attempt = now
    
    logger.info(f"[AUTO-RECOVERY] Tentativa {whatsapp_recovery_attempts}/{MAX_RECOVERY_ATTEMPTS} de recuperar WhatsApp service...")
    
    try:
        # 1. Tenta matar processos na porta 3002
        logger.info("[AUTO-RECOVERY] Liberando porta 3002...")
        subprocess.run(['fuser', '-k', '3002/tcp'], capture_output=True, timeout=10)
        await asyncio.sleep(2)
        
        # 2. Reinicia via supervisor
        logger.info("[AUTO-RECOVERY] Reiniciando via supervisor...")
        subprocess.run(['supervisorctl', 'restart', 'whatsapp'], capture_output=True, timeout=30)
        await asyncio.sleep(5)
        
        # 3. Verifica se voltou
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{WHATSAPP_SERVICE_URL}/health")
                if response.status_code == 200:
                    logger.info("[AUTO-RECOVERY] ✅ WhatsApp service recuperado com sucesso!")
                    whatsapp_recovery_attempts = 0  # Reset contador de sucesso
                    return True
        except:
            pass
        
        logger.warning("[AUTO-RECOVERY] Serviço ainda não respondendo após reinício")
        return False
        
    except Exception as e:
        logger.error(f"[AUTO-RECOVERY] Erro na recuperação: {e}")
        return False

async def check_whatsapp_health():
    """Verifica saúde do WhatsApp service e tenta recuperar se necessário"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/health")
            return response.status_code == 200
    except:
        return False

@api_router.get("/debug/whatsapp-service")
async def debug_whatsapp_service():
    """Debug endpoint to check WhatsApp service status - No auth required for debugging"""
    import subprocess
    import shutil
    
    result = {
        'whatsapp_service_url': WHATSAPP_SERVICE_URL,
        'node_installed': shutil.which('node') is not None,
        'node_version': None,
        'whatsapp_dir_exists': os.path.exists('/app/whatsapp-service'),
        'whatsapp_index_exists': os.path.exists('/app/whatsapp-service/index.js'),
        'service_responding': False,
        'supervisor_status': None,
        'can_start_process': False,
        'error': None,
        'recovery_attempts': whatsapp_recovery_attempts,
        'auto_recovery_enabled': True
    }
    
    # Check node version
    try:
        node_result = subprocess.run(['node', '--version'], capture_output=True, text=True, timeout=5)
        result['node_version'] = node_result.stdout.strip()
    except Exception as e:
        result['node_version'] = f"Error: {str(e)}"
    
    # Check supervisor status
    try:
        sup_result = subprocess.run(['supervisorctl', 'status', 'whatsapp'], capture_output=True, text=True, timeout=5)
        result['supervisor_status'] = sup_result.stdout.strip() or sup_result.stderr.strip()
    except Exception as e:
        result['supervisor_status'] = f"Error: {str(e)}"
    
    # Try to call the service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/health")
            result['service_responding'] = response.status_code == 200
            if response.status_code == 200:
                result['service_health'] = response.json()
    except Exception as e:
        result['service_responding'] = False
        result['error'] = str(e)
        
        # Tenta auto-recovery
        result['attempting_recovery'] = True
        recovered = await auto_recover_whatsapp_service()
        result['recovery_successful'] = recovered
    
    return result

@api_router.post("/debug/whatsapp-service/restart")
async def restart_whatsapp_service():
    """Força reinício do WhatsApp service"""
    import subprocess
    
    try:
        # Libera porta
        subprocess.run(['fuser', '-k', '3002/tcp'], capture_output=True, timeout=10)
        await asyncio.sleep(2)
        
        # Reinicia
        result = subprocess.run(['supervisorctl', 'restart', 'whatsapp'], capture_output=True, text=True, timeout=30)
        await asyncio.sleep(5)
        
        # Verifica
        healthy = await check_whatsapp_health()
        
        return {
            'success': healthy,
            'message': 'Serviço reiniciado' if healthy else 'Reinício executado mas serviço não respondeu',
            'supervisor_output': result.stdout or result.stderr
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

async def whatsapp_request(method: str, endpoint: str, json_data: dict = None, timeout: float = 30.0, auto_recover: bool = True):
    """Make request to WhatsApp service with configurable timeout and auto-recovery"""
    max_attempts = 2 if auto_recover else 1
    last_error = None
    
    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                url = f"{WHATSAPP_SERVICE_URL}{endpoint}"
                logger.info(f"[DEBUG] WhatsApp request: {method} {url} (timeout={timeout}s, attempt={attempt+1})")
                if json_data:
                    logger.info(f"[DEBUG] Request data: {json_data}")
                
                if method == "GET":
                    response = await client.get(url)
                elif method == "POST":
                    response = await client.post(url, json=json_data)
                elif method == "DELETE":
                    response = await client.delete(url)
                
                logger.info(f"[DEBUG] WhatsApp response status: {response.status_code}")
                logger.info(f"[DEBUG] WhatsApp response body: {response.text[:500] if response.text else 'empty'}")
                return response.json()
                
        except httpx.ConnectError as e:
            logger.error(f"[DEBUG] WhatsApp service connection error: {e} - URL: {WHATSAPP_SERVICE_URL}")
            last_error = f"Serviço WhatsApp não acessível"
            
            # Tenta auto-recovery na primeira falha
            if attempt == 0 and auto_recover:
                logger.info("[AUTO-RECOVERY] Tentando recuperar WhatsApp service...")
                recovered = await auto_recover_whatsapp_service()
                if recovered:
                    logger.info("[AUTO-RECOVERY] Serviço recuperado, tentando novamente...")
                    continue
                    
        except httpx.ReadTimeout as e:
            logger.error(f"[DEBUG] WhatsApp service read timeout: {e}")
            last_error = f"WhatsApp service demorou demais para responder (timeout={timeout}s)"
            
        except httpx.TimeoutException as e:
            logger.error(f"[DEBUG] WhatsApp service timeout: {e}")
            last_error = f"Timeout ao comunicar com WhatsApp service"
            
            # Tenta auto-recovery
            if attempt == 0 and auto_recover:
                logger.info("[AUTO-RECOVERY] Timeout detectado, tentando recuperar...")
                await auto_recover_whatsapp_service()
                continue
                
        except Exception as e:
            logger.error(f"[DEBUG] WhatsApp request error: {type(e).__name__}: {e}")
            last_error = str(e)
    
    raise Exception(last_error or "Erro desconhecido ao comunicar com WhatsApp service")

# ============= Auth Endpoints =============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({'username': data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    
    user = {
        'id': str(uuid.uuid4()),
        'username': data.username,
        'password': hash_password(data.password),
        'role': data.role,
        'max_connections': data.max_connections if data.role != 'admin' else -1,
        'active': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'max_connections': user['max_connections']
        }
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({'username': data.username}, {'_id': 0})
    if not user or not verify_password(data.password, user['password']):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    # Check if user is blocked
    if not user.get('active', True):
        raise HTTPException(status_code=403, detail="blocked")
    
    # Check if user is expired (not for admin)
    if user['role'] != 'admin' and user.get('expires_at'):
        if datetime.fromisoformat(user['expires_at'].replace('Z', '+00:00')) < datetime.now(timezone.utc):
            raise HTTPException(status_code=403, detail="expired")
    
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'max_connections': user['max_connections'],
            'credits': user.get('credits', 0),
            'expires_at': user.get('expires_at'),
            'had_trial': user.get('had_trial', False)
        }
    }

@api_router.post("/auth/register")
async def register_user(data: UserLogin):
    """Register new user (public - joins admin's network as reseller) - starts BLOCKED"""
    existing = await db.users.find_one({'username': data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    
    # Find admin to link this user
    admin = await db.users.find_one({'role': 'admin'})
    
    user = {
        'id': str(uuid.uuid4()),
        'username': data.username,
        'password': hash_password(data.password),
        'role': 'reseller',
        'max_connections': 1,
        'credits': 0,
        'active': False,  # User starts BLOCKED - admin must manually activate
        'expires_at': None,  # No expiration until admin activates
        'created_by': admin['id'] if admin else None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    if admin:
        await log_activity(admin['id'], admin['username'], 'user_registered', 'user', user['id'], data.username, 'Novo usuário aguardando aprovação')
    
    return {'message': 'Conta criada! Aguarde a aprovação do administrador.'}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'max_connections': user['max_connections'],
        'credits': user.get('credits', 0),
        'expires_at': user.get('expires_at')
    }

# ============= Profile Management =============

@api_router.put("/auth/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    """Update user profile (username)"""
    update_data = {}
    
    if data.username and data.username != user['username']:
        # Check if username is taken
        existing = await db.users.find_one({'username': data.username})
        if existing:
            raise HTTPException(status_code=400, detail="Nome de usuário já existe")
        update_data['username'] = data.username
    
    if not update_data:
        return {'message': 'Nenhuma alteração necessária'}
    
    await db.users.update_one({'id': user['id']}, {'$set': update_data})
    
    # Log activity
    await log_activity(user['id'], user['username'], 'profile_update', 'user', user['id'], user['username'], 'Perfil atualizado')
    
    updated = await db.users.find_one({'id': user['id']}, {'_id': 0, 'password': 0})
    return updated

@api_router.put("/auth/password")
async def change_password(data: PasswordChange, user: dict = Depends(get_current_user)):
    """Change user password"""
    # Verify current password
    full_user = await db.users.find_one({'id': user['id']})
    if not verify_password(data.current_password, full_user['password']):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    # Update password
    new_hash = hash_password(data.new_password)
    await db.users.update_one({'id': user['id']}, {'$set': {'password': new_hash}})
    
    # Log activity
    await log_activity(user['id'], user['username'], 'password_change', 'user', user['id'], user['username'], 'Senha alterada')
    
    return {'message': 'Senha alterada com sucesso'}

# ============= Dependencies Management (Admin Only) =============

# Global variable to track WhatsApp service process
whatsapp_process = None

def run_command(cmd: list, timeout: int = 120, cwd: str = None) -> tuple:
    """Run a command and return (success, output, error)"""
    import subprocess
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Timeout"
    except Exception as e:
        return False, "", str(e)

def check_node_installed() -> tuple:
    """Check if Node.js is installed and return version"""
    import shutil
    import subprocess
    
    # Check multiple possible paths
    node_paths = ['/usr/local/bin/node', '/usr/bin/node', shutil.which('node')]
    
    for node_path in node_paths:
        if node_path and os.path.exists(node_path):
            try:
                result = subprocess.run([node_path, '--version'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    return True, result.stdout.strip(), node_path
            except:
                pass
    
    return False, None, None

def check_npm_installed() -> tuple:
    """Check if NPM is installed and return version"""
    import shutil
    import subprocess
    
    npm_paths = ['/usr/local/bin/npm', '/usr/bin/npm', shutil.which('npm')]
    
    for npm_path in npm_paths:
        if npm_path and os.path.exists(npm_path):
            try:
                result = subprocess.run([npm_path, '--version'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    return True, result.stdout.strip(), npm_path
            except:
                pass
    
    return False, None, None

def check_whatsapp_deps_installed() -> bool:
    """Check if WhatsApp service dependencies are installed"""
    node_modules = Path('/app/whatsapp-service/node_modules')
    return node_modules.exists() and (node_modules / '@whiskeysockets').exists()

def check_whatsapp_service_running() -> bool:
    """Check if WhatsApp service is responding"""
    import urllib.request
    try:
        req = urllib.request.Request(f'{WHATSAPP_SERVICE_URL}/health', method='GET')
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except:
        return False

@api_router.get("/admin/dependencies/status")
async def get_dependencies_status(admin: dict = Depends(get_admin_user)):
    """Get status of all dependencies"""
    import platform
    import sys
    
    node_installed, node_version, node_path = check_node_installed()
    npm_installed, npm_version, npm_path = check_npm_installed()
    
    return {
        'node_installed': node_installed,
        'node_version': node_version,
        'node_path': node_path,
        'npm_installed': npm_installed,
        'npm_version': npm_version,
        'npm_path': npm_path,
        'whatsapp_deps_installed': check_whatsapp_deps_installed(),
        'whatsapp_service_running': check_whatsapp_service_running(),
        'system_info': {
            'platform': platform.system(),
            'arch': platform.machine(),
            'python_version': sys.version.split()[0],
            'whatsapp_dir_exists': os.path.exists('/app/whatsapp-service'),
        }
    }

@api_router.post("/admin/dependencies/install-node")
async def install_node(background_tasks: BackgroundTasks, admin: dict = Depends(get_admin_user)):
    """Install Node.js using Python to download"""
    import subprocess
    import urllib.request
    import platform
    
    # Versões fixas exatas - COMPATÍVEIS COM PRODUÇÃO
    NODE_VERSION = "20.11.0"
    NPM_VERSION = "10.2.4"
    
    logs = []
    
    # Check if already installed
    node_installed, node_version, _ = check_node_installed()
    if node_installed:
        return {'success': True, 'logs': [f'Node.js já está instalado: {node_version}']}
    
    try:
        # Detect architecture
        arch = platform.machine()
        if arch == 'x86_64':
            node_arch = 'x64'
        elif arch == 'aarch64' or arch == 'arm64':
            node_arch = 'arm64'
        else:
            node_arch = 'x64'  # fallback
        
        node_url = f'https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-{node_arch}.tar.xz'
        node_file = '/tmp/node.tar.xz'
        
        logs.append(f"📦 Baixando Node.js v{NODE_VERSION} ({node_arch})...")
        logs.append(f"URL: {node_url}")
        
        # Download using Python urllib (no curl needed)
        try:
            urllib.request.urlretrieve(node_url, node_file)
            logs.append("✅ Download concluído")
        except Exception as e:
            logs.append(f"❌ Erro no download: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Erro no download: {str(e)}")
        
        # Extract to /usr/local
        logs.append("📦 Extraindo arquivos...")
        success, stdout, stderr = run_command(
            ['tar', '-xJf', node_file, '-C', '/usr/local', '--strip-components=1'],
            timeout=180
        )
        if not success:
            logs.append(f"❌ Erro ao extrair: {stderr}")
            raise HTTPException(status_code=500, detail=f"Erro ao extrair: {stderr}")
        logs.append("✅ Extração concluída")
        
        # Cleanup
        try:
            os.remove(node_file)
        except:
            pass
        
        # Verify installation
        node_installed, node_version, _ = check_node_installed()
        if node_installed:
            logs.append(f"✅ Node.js instalado: {node_version}")
            
            # Verificar versão do NPM
            npm_installed, npm_version, _ = check_npm_installed()
            if npm_installed:
                logs.append(f"✅ NPM instalado: {npm_version}")
            
            return {'success': True, 'logs': logs}
        else:
            logs.append("❌ Instalação falhou - Node.js não encontrado após instalação")
            raise HTTPException(status_code=500, detail="Instalação falhou")
            
    except HTTPException:
        raise
    except Exception as e:
        logs.append(f"❌ Erro: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/dependencies/install-whatsapp")
async def install_whatsapp_deps(admin: dict = Depends(get_admin_user)):
    """Install WhatsApp service dependencies"""
    import subprocess
    
    logs = []
    
    # Check if Node.js is installed
    node_installed, _, node_path = check_node_installed()
    if not node_installed:
        raise HTTPException(status_code=400, detail="Node.js não está instalado. Instale primeiro.")
    
    # Check if already installed
    if check_whatsapp_deps_installed():
        return {'success': True, 'logs': ['Dependências já estão instaladas']}
    
    try:
        # Tentar instalar git se não existir (necessário para algumas dependências npm)
        try:
            result = subprocess.run(['which', 'git'], capture_output=True, timeout=5)
            if result.returncode != 0:
                logs.append("📦 Instalando git...")
                subprocess.run(['apt-get', 'update', '-qq'], timeout=60, capture_output=True)
                subprocess.run(['apt-get', 'install', '-y', '-qq', 'git'], timeout=120, capture_output=True)
                logs.append("✅ Git instalado")
        except:
            logs.append("⚠️ Não foi possível verificar/instalar git")
        
        logs.append("📦 Instalando dependências do WhatsApp Service...")
        
        # Get npm path
        _, _, npm_path = check_npm_installed()
        if not npm_path:
            npm_path = '/usr/local/bin/npm'
        
        # Limpar cache e node_modules antigos
        try:
            import shutil
            node_modules_path = '/app/whatsapp-service/node_modules'
            if os.path.exists(node_modules_path):
                shutil.rmtree(node_modules_path)
                logs.append("🗑️ node_modules antigo removido")
        except:
            pass
        
        # Install dependencies com --no-optional para evitar dependências problemáticas
        success, stdout, stderr = run_command(
            [npm_path, 'install', '--no-optional', '--legacy-peer-deps'],
            timeout=300,
            cwd='/app/whatsapp-service'
        )
        
        if success or check_whatsapp_deps_installed():
            logs.append("✅ Dependências instaladas com sucesso")
            return {'success': True, 'logs': logs}
        else:
            logs.append(f"❌ Erro: {stderr}")
            raise HTTPException(status_code=500, detail=f"Erro ao instalar dependências: {stderr}")
            
    except HTTPException:
        raise
    except Exception as e:
        logs.append(f"❌ Erro: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/dependencies/start-whatsapp")
async def start_whatsapp_service(admin: dict = Depends(get_admin_user)):
    """Start WhatsApp service"""
    import subprocess
    global whatsapp_process
    
    # Check prerequisites
    node_installed, _, node_path = check_node_installed()
    if not node_installed:
        raise HTTPException(status_code=400, detail="Node.js não está instalado")
    
    if not check_whatsapp_deps_installed():
        raise HTTPException(status_code=400, detail="Dependências do WhatsApp não estão instaladas")
    
    # Check if already running
    if check_whatsapp_service_running():
        return {'success': True, 'message': 'Serviço já está rodando'}
    
    try:
        # Kill any existing process
        if whatsapp_process:
            try:
                whatsapp_process.terminate()
                whatsapp_process.wait(timeout=5)
            except:
                pass
        
        # Start the service
        env = os.environ.copy()
        env['PATH'] = f"/usr/local/bin:{env.get('PATH', '')}"
        
        whatsapp_process = subprocess.Popen(
            [node_path or '/usr/local/bin/node', '/app/whatsapp-service/index.js'],
            cwd='/app/whatsapp-service',
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True
        )
        
        # Wait a bit and check if it started
        await asyncio.sleep(3)
        
        if check_whatsapp_service_running():
            logger.info("WhatsApp service started successfully")
            return {'success': True, 'message': 'Serviço iniciado com sucesso'}
        else:
            # Check if process died
            if whatsapp_process.poll() is not None:
                _, stderr = whatsapp_process.communicate()
                raise HTTPException(status_code=500, detail=f"Serviço encerrou: {stderr.decode()[:500]}")
            
            return {'success': True, 'message': 'Serviço iniciando... aguarde alguns segundos'}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting WhatsApp service: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/dependencies/full-setup")
async def full_setup(admin: dict = Depends(get_admin_user)):
    """Run full setup: install Node.js, WhatsApp deps, and start service"""
    import subprocess
    import urllib.request
    import platform
    
    # Versões fixas exatas - COMPATÍVEIS COM PRODUÇÃO
    NODE_VERSION = "20.11.0"
    NPM_VERSION = "10.2.4"
    
    logs = []
    
    try:
        # Step 1: Install Node.js if needed
        node_installed, node_version, _ = check_node_installed()
        if not node_installed:
            logs.append(f"📦 Passo 1: Instalando Node.js v{NODE_VERSION}...")
            
            # Detect architecture
            arch = platform.machine()
            if arch == 'x86_64':
                node_arch = 'x64'
            elif arch == 'aarch64' or arch == 'arm64':
                node_arch = 'arm64'
            else:
                node_arch = 'x64'
            
            node_url = f'https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-{node_arch}.tar.xz'
            node_file = '/tmp/node.tar.xz'
            
            logs.append(f"Baixando Node.js v{NODE_VERSION} ({node_arch})...")
            
            try:
                urllib.request.urlretrieve(node_url, node_file)
                logs.append("Download concluído")
            except Exception as e:
                logs.append(f"❌ Erro no download: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Erro no download: {str(e)}")
            
            # Extract
            logs.append("Extraindo arquivos...")
            success, _, stderr = run_command(
                ['tar', '-xJf', node_file, '-C', '/usr/local', '--strip-components=1'],
                timeout=180
            )
            if not success:
                logs.append(f"❌ Erro ao extrair: {stderr}")
                raise HTTPException(status_code=500, detail=f"Erro ao extrair: {stderr}")
            
            # Cleanup
            try:
                os.remove(node_file)
            except:
                pass
            
            node_installed, node_version, _ = check_node_installed()
            if node_installed:
                logs.append(f"✅ Node.js instalado: {node_version}")
            else:
                raise HTTPException(status_code=500, detail="Falha ao instalar Node.js")
        else:
            logs.append(f"✅ Node.js já instalado: {node_version}")
        
        # Step 2: Install WhatsApp dependencies if needed
        if not check_whatsapp_deps_installed():
            logs.append("📦 Passo 2: Instalando dependências do WhatsApp...")
            
            # Tentar instalar git se necessário
            try:
                result = subprocess.run(['which', 'git'], capture_output=True, timeout=5)
                if result.returncode != 0:
                    logs.append("📦 Instalando git...")
                    subprocess.run(['apt-get', 'update', '-qq'], timeout=60, capture_output=True)
                    subprocess.run(['apt-get', 'install', '-y', '-qq', 'git'], timeout=120, capture_output=True)
            except:
                pass
            
            _, _, npm_path = check_npm_installed()
            npm_path = npm_path or '/usr/local/bin/npm'
            
            # Limpar node_modules antigo
            try:
                import shutil
                node_modules_path = '/app/whatsapp-service/node_modules'
                if os.path.exists(node_modules_path):
                    shutil.rmtree(node_modules_path)
            except:
                pass
            
            success, _, stderr = run_command(
                [npm_path, 'install', '--no-optional', '--legacy-peer-deps'],
                timeout=300,
                cwd='/app/whatsapp-service'
            )
            
            if check_whatsapp_deps_installed():
                logs.append("✅ Dependências do WhatsApp instaladas")
            else:
                logs.append(f"⚠️ Possível problema nas dependências: {stderr[:200] if stderr else 'unknown'}")
        else:
            logs.append("✅ Dependências do WhatsApp já instaladas")
        
        # Step 3: Start WhatsApp service
        if not check_whatsapp_service_running():
            logs.append("🚀 Passo 3: Iniciando serviço WhatsApp...")
            
            global whatsapp_process
            
            node_path = check_node_installed()[2] or '/usr/local/bin/node'
            env = os.environ.copy()
            env['PATH'] = f"/usr/local/bin:{env.get('PATH', '')}"
            
            whatsapp_process = subprocess.Popen(
                [node_path, '/app/whatsapp-service/index.js'],
                cwd='/app/whatsapp-service',
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                start_new_session=True
            )
            
            # Wait for service to start
            for i in range(10):
                await asyncio.sleep(1)
                if check_whatsapp_service_running():
                    logs.append("✅ Serviço WhatsApp iniciado")
                    break
            else:
                logs.append("⚠️ Serviço iniciando em background... pode demorar alguns segundos")
        else:
            logs.append("✅ Serviço WhatsApp já está rodando")
        
        return {'success': True, 'logs': logs}
        
    except HTTPException:
        raise
    except Exception as e:
        logs.append(f"❌ Erro: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= System Logs (Admin Only) =============

@api_router.get("/admin/logs/{service}")
async def get_service_logs(service: str, lines: int = 100, admin: dict = Depends(get_admin_user)):
    """Get service logs - Admin only"""
    import subprocess
    
    log_files = {
        'backend': '/var/log/supervisor/backend.err.log',
        'backend_out': '/var/log/supervisor/backend.out.log',
        'whatsapp': '/var/log/supervisor/whatsapp.err.log',
        'whatsapp_out': '/var/log/supervisor/whatsapp.out.log',
        'frontend': '/var/log/supervisor/frontend.err.log',
    }
    
    if service not in log_files:
        raise HTTPException(status_code=400, detail=f"Serviço inválido. Use: {', '.join(log_files.keys())}")
    
    log_file = log_files[service]
    
    try:
        # Read last N lines from log file
        result = subprocess.run(
            ['tail', '-n', str(min(lines, 500)), log_file],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        log_content = result.stdout or result.stderr or "Arquivo vazio ou não encontrado"
        
        return {
            'service': service,
            'file': log_file,
            'lines': lines,
            'content': log_content
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Timeout ao ler logs")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler logs: {str(e)}")

@api_router.get("/admin/logs")
async def get_all_logs(lines: int = 50, admin: dict = Depends(get_admin_user)):
    """Get all service logs - Admin only"""
    import subprocess
    
    services = ['backend', 'whatsapp', 'frontend']
    logs = {}
    
    for service in services:
        err_file = f'/var/log/supervisor/{service}.err.log'
        out_file = f'/var/log/supervisor/{service}.out.log'
        
        try:
            # Error logs
            result_err = subprocess.run(
                ['tail', '-n', str(min(lines, 200)), err_file],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # Output logs
            result_out = subprocess.run(
                ['tail', '-n', str(min(lines, 200)), out_file],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            logs[service] = {
                'error': result_err.stdout or "Sem erros",
                'output': result_out.stdout or "Sem saída"
            }
        except Exception as e:
            logs[service] = {
                'error': f"Erro ao ler: {str(e)}",
                'output': ""
            }
    
    return logs

@api_router.get("/admin/system-status")
async def get_system_status(admin: dict = Depends(get_admin_user)):
    """Get system status - Admin only"""
    import subprocess
    
    try:
        # Supervisor status
        supervisor_result = subprocess.run(
            ['supervisorctl', 'status'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Parse supervisor output
        services = []
        for line in supervisor_result.stdout.strip().split('\n'):
            if line.strip():
                parts = line.split()
                if len(parts) >= 2:
                    services.append({
                        'name': parts[0],
                        'status': parts[1],
                        'info': ' '.join(parts[2:]) if len(parts) > 2 else ''
                    })
        
        # Test WhatsApp service
        whatsapp_ok = False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{WHATSAPP_SERVICE_URL}/connections/test/status")
                whatsapp_ok = response.status_code == 200
        except:
            whatsapp_ok = False
        
        return {
            'services': services,
            'whatsapp_service_url': WHATSAPP_SERVICE_URL,
            'whatsapp_service_ok': whatsapp_ok,
            'mongo_url': mongo_url.split('@')[-1] if '@' in mongo_url else mongo_url,  # Hide credentials
            'uploads_dir': str(UPLOADS_DIR),
            'uploads_exists': UPLOADS_DIR.exists()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter status: {str(e)}")

# ============= Activity Log =============

async def log_activity(user_id: str, username: str, action: str, entity_type: str, entity_id: str = None, entity_name: str = None, details: str = None):
    """Log user activity"""
    log = {
        'id': str(uuid.uuid4()),
        'action': action,
        'entity_type': entity_type,
        'entity_id': entity_id,
        'entity_name': entity_name,
        'user_id': user_id,
        'username': username,
        'details': details,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log)

@api_router.get("/activity-logs")
async def get_activity_logs(limit: int = 50, user: dict = Depends(get_current_user)):
    """Get recent activity logs"""
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    logs = await db.activity_logs.find(query, {'_id': 0}).sort('created_at', -1).limit(limit).to_list(limit)
    return logs

@api_router.get("/activity-logs/paginated")
async def get_activity_logs_paginated(
    page: int = 1, 
    limit: int = 20, 
    action: str = None,
    user: dict = Depends(get_current_user)
):
    """Get paginated activity logs with filters"""
    # Build query based on user role
    if user['role'] == 'admin':
        query = {}
    elif user['role'] == 'master':
        # Get all users created by this master
        created_users = await db.users.find({'created_by': user['id']}, {'id': 1}).to_list(1000)
        user_ids = [u['id'] for u in created_users]
        user_ids.append(user['id'])
        query = {'user_id': {'$in': user_ids}}
    else:
        query = {'user_id': user['id']}
    
    if action and action != 'all':
        query['action'] = action
    
    skip = (page - 1) * limit
    total = await db.activity_logs.count_documents(query)
    logs = await db.activity_logs.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        'logs': logs,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit
    }

# ============= Dashboard Stats =============

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(days: int = 7, user: dict = Depends(get_current_user)):
    """Get dashboard statistics"""
    import pytz
    
    sp_tz = pytz.timezone('America/Sao_Paulo')
    now_sp = datetime.now(sp_tz)
    now_utc = datetime.now(timezone.utc)
    
    from_date = now_utc - timedelta(days=days)
    from_date_str = from_date.isoformat()
    
    # Start of today in São Paulo timezone, converted to UTC
    today_start_sp = sp_tz.localize(datetime.combine(now_sp.date(), datetime.min.time()))
    today_start_utc = today_start_sp.astimezone(timezone.utc)
    
    # Query filter based on role
    user_query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    
    # Count resellers
    resellers_count = 0
    if user['role'] == 'admin':
        resellers_count = await db.users.count_documents({'role': {'$in': ['reseller', 'master']}})
    elif user['role'] == 'master':
        resellers_count = await db.users.count_documents({'created_by': user['id']})
    
    # Get send logs for accurate stats
    send_logs_query = user_query.copy()
    send_logs_query['status'] = 'sent'
    
    # Count total sends from send_logs
    total_sends = await db.send_logs.count_documents(send_logs_query)
    
    # Count sends today
    today_query = send_logs_query.copy()
    today_query['sent_at'] = {'$gte': today_start_utc.isoformat()}
    sends_today = await db.send_logs.count_documents(today_query)
    
    # Count sends in period
    period_query = send_logs_query.copy()
    period_query['sent_at'] = {'$gte': from_date_str}
    sends_period = await db.send_logs.count_documents(period_query)
    
    # Generate daily sends data for chart
    daily_sends = []
    for i in range(days):
        day_offset = days - 1 - i
        day_date_sp = (now_sp - timedelta(days=day_offset)).date()
        
        # Start and end of day in São Paulo, converted to UTC
        day_start_sp = sp_tz.localize(datetime.combine(day_date_sp, datetime.min.time()))
        day_end_sp = sp_tz.localize(datetime.combine(day_date_sp + timedelta(days=1), datetime.min.time()))
        
        day_start_utc = day_start_sp.astimezone(timezone.utc).isoformat()
        day_end_utc = day_end_sp.astimezone(timezone.utc).isoformat()
        
        day_query = send_logs_query.copy()
        day_query['sent_at'] = {'$gte': day_start_utc, '$lt': day_end_utc}
        day_count = await db.send_logs.count_documents(day_query)
        daily_sends.append(day_count)
    
    # Success rate from send_logs
    total_logs = await db.send_logs.count_documents(user_query)
    failed_logs = await db.send_logs.count_documents({**user_query, 'status': 'failed'})
    success_rate = int(((total_logs - failed_logs) / total_logs * 100) if total_logs > 0 else 100)
    
    # Get last 5 errors for expandable view
    recent_errors = []
    error_query = {**user_query, 'status': 'failed'}
    error_logs = await db.send_logs.find(error_query, {'_id': 0}).sort('sent_at', -1).limit(5).to_list(5)
    
    for error_log in error_logs:
        # Get group name if available
        group_name = error_log.get('group_name', 'Grupo desconhecido')
        if not group_name and error_log.get('group_id'):
            group = await db.groups.find_one({'id': error_log['group_id']})
            group_name = group.get('name', 'Grupo desconhecido') if group else 'Grupo desconhecido'
        
        # Get campaign name if available
        campaign_name = None
        if error_log.get('campaign_id'):
            campaign = await db.campaigns.find_one({'id': error_log['campaign_id']})
            campaign_name = campaign.get('title') if campaign else None
        
        recent_errors.append({
            'id': error_log.get('id'),
            'sent_at': error_log.get('sent_at'),
            'group_name': group_name,
            'campaign_name': campaign_name,
            'error': error_log.get('error', 'Erro desconhecido'),
            'connection_id': error_log.get('connection_id')
        })
    
    return {
        'resellers_count': resellers_count,
        'sends_today': sends_today,
        'sends_period': sends_period,
        'total_sends': total_sends,
        'success_rate': success_rate,
        'daily_sends': daily_sends,
        'total_failed': failed_logs,
        'recent_errors': recent_errors
    }

# ============= Templates =============

@api_router.get("/templates")
async def list_templates(user: dict = Depends(get_current_user)):
    """List message templates"""
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    templates = await db.templates.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    return templates

@api_router.post("/templates")
async def create_template(data: TemplateCreate, user: dict = Depends(get_current_user)):
    """Create a new message template"""
    image_url = None
    if data.image_id:
        image = await db.images.find_one({'id': data.image_id})
        if image:
            image_url = image['url']
    
    template = {
        'id': str(uuid.uuid4()),
        'name': data.name,
        'message': data.message,
        'image_id': data.image_id,
        'image_url': image_url,
        'user_id': user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.templates.insert_one(template)
    await log_activity(user['id'], user['username'], 'create', 'template', template['id'], data.name, 'Template criado')
    
    return template

@api_router.put("/templates/{template_id}")
async def update_template(template_id: str, data: TemplateCreate, user: dict = Depends(get_current_user)):
    """Update a message template"""
    query = {'id': template_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    template = await db.templates.find_one(query)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    image_url = None
    if data.image_id:
        image = await db.images.find_one({'id': data.image_id})
        if image:
            image_url = image['url']
    
    update_data = {
        'name': data.name,
        'message': data.message,
        'image_id': data.image_id,
        'image_url': image_url
    }
    
    await db.templates.update_one({'id': template_id}, {'$set': update_data})
    await log_activity(user['id'], user['username'], 'update', 'template', template_id, data.name, 'Template atualizado')
    
    updated = await db.templates.find_one({'id': template_id}, {'_id': 0})
    return updated

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    """Delete a message template"""
    query = {'id': template_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    template = await db.templates.find_one(query)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    
    await db.templates.delete_one({'id': template_id})
    await log_activity(user['id'], user['username'], 'delete', 'template', template_id, template['name'], 'Template excluído')
    
    return {'message': 'Template deletado'}

# ============= Admin - User Management =============

@api_router.get("/admin/users", response_model=List[UserResponse])
async def list_users(admin: dict = Depends(get_admin_user)):
    """List all users (except admin)"""
    users = await db.users.find({'role': {'$ne': 'admin'}}, {'_id': 0, 'password': 0}).to_list(1000)
    return users

@api_router.get("/admin/all-users")
async def list_all_users(page: int = 1, limit: int = 10, admin: dict = Depends(get_admin_user)):
    """List all users with pagination"""
    skip = (page - 1) * limit
    total = await db.users.count_documents({'role': {'$ne': 'admin'}})
    users = await db.users.find({'role': {'$ne': 'admin'}}, {'_id': 0, 'password': 0}).skip(skip).limit(limit).to_list(limit)
    return {
        'users': users,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit
    }

@api_router.post("/admin/users", response_model=UserResponse)
async def create_user(data: UserCreate, admin: dict = Depends(get_admin_user)):
    """Create a new user (admin only)"""
    existing = await db.users.find_one({'username': data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    
    # Calculate expiration date (1 month from now)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat() if data.role in ['reseller', 'master'] else None
    
    user = {
        'id': str(uuid.uuid4()),
        'username': data.username,
        'password': hash_password(data.password),
        'role': data.role if data.role in ['reseller', 'master'] else 'reseller',
        'max_connections': data.max_connections,
        'credits': data.credits if data.role == 'master' else 0,
        'active': True,
        'expires_at': expires_at,
        'created_by': admin['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    await log_activity(admin['id'], admin['username'], 'create', 'user', user['id'], data.username, f"Usuário {data.role} criado")
    
    del user['password']
    return user

@api_router.put("/admin/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, data: UserUpdate, admin: dict = Depends(get_admin_user)):
    """Update user details"""
    # Get current user data first
    current_user = await db.users.find_one({'id': user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    update_data = {}
    changes = []
    
    if data.username is not None and data.username != current_user['username']:
        # Check if username is taken
        existing = await db.users.find_one({'username': data.username, 'id': {'$ne': user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Nome de usuário já existe")
        update_data['username'] = data.username
        changes.append(f"Username alterado para {data.username}")
    
    if data.max_connections is not None and data.max_connections != current_user.get('max_connections'):
        update_data['max_connections'] = data.max_connections
        changes.append(f"Conexões: {current_user.get('max_connections', 1)} → {data.max_connections}")
    
    if data.credits is not None and data.credits != current_user.get('credits', 0):
        old_credits = current_user.get('credits', 0)
        update_data['credits'] = data.credits
        diff = data.credits - old_credits
        if diff > 0:
            changes.append(f"+{diff} créditos")
        else:
            changes.append(f"{diff} créditos")
    
    if data.active is not None and data.active != current_user.get('active', True):
        update_data['active'] = data.active
        if data.active:
            changes.append("Desbloqueado")
        else:
            changes.append("Bloqueado")
    
    if data.expires_at is not None and data.expires_at != current_user.get('expires_at'):
        update_data['expires_at'] = data.expires_at
        changes.append("Data de expiração alterada")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    result = await db.users.update_one({'id': user_id}, {'$set': update_data})
    
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    
    # Log specific action based on what changed
    if 'active' in update_data:
        action = 'unblock' if update_data['active'] else 'block'
        await log_activity(admin['id'], admin['username'], action, 'user', user_id, user['username'], 'Bloqueado' if not update_data['active'] else 'Desbloqueado')
    else:
        await log_activity(admin['id'], admin['username'], 'update', 'user', user_id, user['username'], '; '.join(changes) if changes else 'Usuário atualizado')
    
    return user

@api_router.post("/admin/users/{user_id}/add-credits")
async def add_credits_to_user(user_id: str, amount: int, admin: dict = Depends(get_admin_user)):
    """Add credits to a user"""
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    current_credits = user.get('credits', 0)
    new_credits = current_credits + amount
    
    await db.users.update_one({'id': user_id}, {'$set': {'credits': new_credits}})
    await log_activity(admin['id'], admin['username'], 'add_credits', 'user', user_id, user['username'], f"+{amount} créditos")
    
    return {'credits': new_credits, 'message': f'{amount} créditos adicionados'}

@api_router.post("/admin/users/{user_id}/renew")
async def renew_user(user_id: str, months: int = 1, admin: dict = Depends(get_admin_user)):
    """Renew user subscription"""
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Calculate new expiration
    current_expires = user.get('expires_at')
    if current_expires:
        try:
            base_date = datetime.fromisoformat(current_expires.replace('Z', '+00:00'))
            if base_date < datetime.now(timezone.utc):
                base_date = datetime.now(timezone.utc)
        except:
            base_date = datetime.now(timezone.utc)
    else:
        base_date = datetime.now(timezone.utc)
    
    new_expires = (base_date + timedelta(days=30 * months)).isoformat()
    
    await db.users.update_one({'id': user_id}, {'$set': {'expires_at': new_expires, 'active': True}})
    await log_activity(admin['id'], admin['username'], 'renew', 'user', user_id, user['username'], f"+{months} mês(es)")
    
    # Generate receipt
    receipt = generate_receipt(user['username'], 'renewal', months, new_expires)
    
    return {'expires_at': new_expires, 'message': f'Renovado por {months} mês(es)', 'receipt': receipt}

@api_router.post("/admin/users/{user_id}/trial")
async def grant_trial(user_id: str, admin: dict = Depends(get_admin_user)):
    """Grant 24h trial to user who never had one"""
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.get('had_trial', False):
        raise HTTPException(status_code=400, detail="Usuário já teve período de teste")
    
    # Grant 24h trial
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    
    await db.users.update_one({'id': user_id}, {'$set': {
        'expires_at': expires_at,
        'active': True,
        'had_trial': True
    }})
    
    await log_activity(admin['id'], admin['username'], 'grant_trial', 'user', user_id, user['username'], 'Teste 24h liberado')
    
    # Generate receipt
    receipt = generate_receipt(user['username'], 'trial', 1, expires_at)
    
    return {'expires_at': expires_at, 'message': 'Teste de 24 horas liberado!', 'receipt': receipt}

def generate_receipt(username: str, action_type: str, months: int, expires_at: str) -> dict:
    """Generate a copyable receipt for renewals and trials"""
    now = datetime.now(timezone.utc)
    expires_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    
    if action_type == 'trial':
        title = "🎁 COMPROVANTE DE TESTE"
        duration = "24 HORAS"
    else:
        title = "✅ COMPROVANTE DE RENOVAÇÃO"
        duration = f"{months} MÊS{'ES' if months > 1 else ''}"
    
    receipt_text = f"""
{title}
━━━━━━━━━━━━━━━━━━━━━
📋 Usuário: {username}
📅 Data: {now.strftime('%d/%m/%Y %H:%M')} (Brasília)
⏰ Duração: {duration}
📆 Validade até: {expires_date.strftime('%d/%m/%Y %H:%M')} (Brasília)
━━━━━━━━━━━━━━━━━━━━━
🚀 NexuZap - Campanhas WhatsApp
    """.strip()
    
    return {
        'text': receipt_text,
        'username': username,
        'action': action_type,
        'duration': duration,
        'expires_at': expires_at,
        'generated_at': now.isoformat()
    }

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a user and all related data"""
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    username = user['username']
    
    await db.users.delete_one({'id': user_id})
    await db.connections.delete_many({'user_id': user_id})
    await db.campaigns.delete_many({'user_id': user_id})
    await db.groups.delete_many({'user_id': user_id})
    await db.templates.delete_many({'user_id': user_id})
    
    await log_activity(admin['id'], admin['username'], 'delete', 'user', user_id, username, 'Usuário excluído')
    
    return {'message': 'Usuário deletado com sucesso'}

# ============= Master User - Reseller Management =============

async def get_master_user(user: dict = Depends(get_current_user)):
    """Get current user if they are a master or admin"""
    if user['role'] not in ['master', 'admin']:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas masters podem criar revendedores.")
    return user

@api_router.get("/master/resellers")
async def list_master_resellers(page: int = 1, limit: int = 10, master: dict = Depends(get_master_user)):
    """List resellers created by this master"""
    query = {'created_by': master['id']} if master['role'] == 'master' else {'role': 'reseller'}
    skip = (page - 1) * limit
    total = await db.users.count_documents(query)
    users = await db.users.find(query, {'_id': 0, 'password': 0}).skip(skip).limit(limit).to_list(limit)
    return {
        'users': users,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit
    }

@api_router.post("/master/resellers")
async def create_reseller(data: UserCreate, master: dict = Depends(get_master_user)):
    """Create a new reseller (master only - costs 1 credit, admin is free)"""
    # Check credits (only for master, not admin - admin has unlimited)
    if master['role'] == 'master':
        if master.get('credits', 0) < 1:
            raise HTTPException(status_code=400, detail="Créditos insuficientes. Você precisa de pelo menos 1 crédito para criar um revendedor.")
    
    existing = await db.users.find_one({'username': data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    
    # Calculate expiration date (1 month from now)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    
    user = {
        'id': str(uuid.uuid4()),
        'username': data.username,
        'password': hash_password(data.password),
        'role': 'reseller',
        'max_connections': data.max_connections,
        'credits': 0,
        'active': True,
        'expires_at': expires_at,
        'created_by': master['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    # Deduct credit from master only (admin never loses credits)
    if master['role'] == 'master':
        await db.users.update_one({'id': master['id']}, {'$inc': {'credits': -1}})
    
    await log_activity(master['id'], master['username'], 'create', 'reseller', user['id'], data.username, 'Revendedor criado')
    
    del user['password']
    return user

@api_router.post("/master/resellers/{user_id}/renew")
async def renew_reseller(user_id: str, master: dict = Depends(get_master_user)):
    """Renew a reseller subscription (costs 1 credit for master, free for admin)"""
    # Check if reseller belongs to this master
    query = {'id': user_id}
    if master['role'] == 'master':
        query['created_by'] = master['id']
        
        # Check credits (only for master, admin is free)
        if master.get('credits', 0) < 1:
            raise HTTPException(status_code=400, detail="Créditos insuficientes. Você precisa de pelo menos 1 crédito para renovar.")
    
    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="Revendedor não encontrado")
    
    # Calculate new expiration
    current_expires = user.get('expires_at')
    if current_expires:
        try:
            base_date = datetime.fromisoformat(current_expires.replace('Z', '+00:00'))
            if base_date < datetime.now(timezone.utc):
                base_date = datetime.now(timezone.utc)
        except:
            base_date = datetime.now(timezone.utc)
    else:
        base_date = datetime.now(timezone.utc)
    
    new_expires = (base_date + timedelta(days=30)).isoformat()
    
    await db.users.update_one({'id': user_id}, {'$set': {'expires_at': new_expires, 'active': True}})
    
    # Deduct credit from master only (admin never loses credits)
    if master['role'] == 'master':
        await db.users.update_one({'id': master['id']}, {'$inc': {'credits': -1}})
    
    await log_activity(master['id'], master['username'], 'renew', 'reseller', user_id, user['username'], '+1 mês')
    
    # Generate receipt
    receipt = generate_receipt(user['username'], 'renewal', 1, new_expires)
    
    return {'expires_at': new_expires, 'message': 'Renovado por 1 mês', 'receipt': receipt}

@api_router.post("/master/resellers/{user_id}/trial")
async def grant_reseller_trial(user_id: str, master: dict = Depends(get_master_user)):
    """Grant 24h trial to reseller who never had one"""
    # Check if reseller belongs to this master
    query = {'id': user_id}
    if master['role'] == 'master':
        query['created_by'] = master['id']
    
    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="Revendedor não encontrado")
    
    if user.get('had_trial', False):
        raise HTTPException(status_code=400, detail="Usuário já teve período de teste")
    
    # Grant 24h trial
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    
    await db.users.update_one({'id': user_id}, {'$set': {
        'expires_at': expires_at,
        'active': True,
        'had_trial': True
    }})
    
    await log_activity(master['id'], master['username'], 'grant_trial', 'reseller', user_id, user['username'], 'Teste 24h liberado')
    
    # Generate receipt
    receipt = generate_receipt(user['username'], 'trial', 1, expires_at)
    
    return {'expires_at': expires_at, 'message': 'Teste de 24 horas liberado!', 'receipt': receipt}

@api_router.put("/master/resellers/{user_id}")
async def update_reseller(user_id: str, data: UserUpdate, master: dict = Depends(get_master_user)):
    """Update reseller details"""
    query = {'id': user_id}
    if master['role'] == 'master':
        query['created_by'] = master['id']
    
    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="Revendedor não encontrado")
    
    update_data = {}
    changes = []
    
    if data.max_connections is not None and data.max_connections != user.get('max_connections'):
        update_data['max_connections'] = data.max_connections
        changes.append(f"Conexões: {user.get('max_connections', 1)} → {data.max_connections}")
    
    if data.active is not None and data.active != user.get('active', True):
        update_data['active'] = data.active
        if data.active:
            changes.append("Desbloqueado")
        else:
            changes.append("Bloqueado")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    await db.users.update_one({'id': user_id}, {'$set': update_data})
    
    updated = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    
    # Log specific action based on what changed
    if 'active' in update_data:
        action = 'unblock' if update_data['active'] else 'block'
        await log_activity(master['id'], master['username'], action, 'reseller', user_id, updated['username'], 'Bloqueado' if not update_data['active'] else 'Desbloqueado')
    else:
        await log_activity(master['id'], master['username'], 'update', 'reseller', user_id, updated['username'], '; '.join(changes) if changes else 'Revendedor atualizado')
    
    return updated

@api_router.delete("/master/resellers/{user_id}")
async def delete_reseller(user_id: str, master: dict = Depends(get_master_user)):
    """Delete a reseller"""
    query = {'id': user_id}
    if master['role'] == 'master':
        query['created_by'] = master['id']
    
    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="Revendedor não encontrado")
    
    username = user['username']
    
    await db.users.delete_one({'id': user_id})
    await db.connections.delete_many({'user_id': user_id})
    await db.campaigns.delete_many({'user_id': user_id})
    await db.groups.delete_many({'user_id': user_id})
    
    await log_activity(master['id'], master['username'], 'delete', 'reseller', user_id, username, 'Revendedor excluído')
    
    return {'message': 'Revendedor deletado'}

# ============= Connections =============

@api_router.get("/connections", response_model=List[ConnectionResponse])
async def list_connections(user: dict = Depends(get_current_user), quick: bool = False):
    """List connections. Use quick=true for faster loading without status check."""
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    connections_list = await db.connections.find(query, {'_id': 0}).to_list(1000)
    
    # Skip status update if quick mode requested
    if quick:
        return connections_list
    
    # Update status from WhatsApp service in parallel with short timeout
    async def update_connection_status(conn):
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:  # Short timeout for faster response
                response = await client.get(f"{WHATSAPP_SERVICE_URL}/connections/{conn['id']}/status")
                if response.status_code == 200:
                    status_data = response.json()
                    if status_data.get('status') != 'not_found':
                        conn['status'] = status_data.get('status', conn['status'])
                        if status_data.get('phoneNumber'):
                            conn['phone_number'] = status_data['phoneNumber']
        except:
            pass  # Keep existing status on error
        return conn
    
    # Run all status updates in parallel
    tasks = [update_connection_status(conn) for conn in connections_list]
    await asyncio.gather(*tasks, return_exceptions=True)
    
    return connections_list

@api_router.get("/connections/quick", response_model=List[ConnectionResponse])
async def list_connections_quick(user: dict = Depends(get_current_user)):
    """Quick list of connections without status check - for faster initial page load"""
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    return await db.connections.find(query, {'_id': 0}).to_list(1000)

@api_router.post("/connections", response_model=ConnectionResponse)
async def create_connection(data: ConnectionCreate, user: dict = Depends(get_current_user)):
    if user['role'] == 'reseller':
        count = await db.connections.count_documents({'user_id': user['id']})
        if count >= user['max_connections']:
            raise HTTPException(status_code=400, detail=f"Limite de {user['max_connections']} conexões atingido")
    
    connection = {
        'id': str(uuid.uuid4()),
        'name': data.name,
        'user_id': user['id'],
        'status': 'disconnected',
        'qr_code': None,
        'qr_image': None,
        'phone_number': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.connections.insert_one(connection)
    return connection

@api_router.get("/connections/{connection_id}", response_model=ConnectionResponse)
async def get_connection(connection_id: str, user: dict = Depends(get_current_user)):
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query, {'_id': 0})
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    return connection

@api_router.post("/connections/{connection_id}/connect")
async def connect_whatsapp(connection_id: str, user: dict = Depends(get_current_user)):
    """Iniciar conexão WhatsApp - com timeout maior para produção"""
    logger.info(f"[DEBUG] /connect chamado para connection_id={connection_id}")
    
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        logger.error(f"[DEBUG] Conexão não encontrada: {connection_id}")
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    logger.info(f"[DEBUG] Conexão encontrada: {connection.get('name')}, status atual: {connection.get('status')}")
    
    try:
        logger.info(f"[DEBUG] Chamando WhatsApp service /connections/{connection_id}/start")
        # Timeout maior (120s) pois criar conexão WhatsApp pode demorar
        result = await whatsapp_request("POST", f"/connections/{connection_id}/start", timeout=120.0)
        logger.info(f"[DEBUG] Resultado do start: {result}")
        
        await db.connections.update_one({'id': connection_id}, {'$set': {'status': 'connecting'}})
        return result
    except httpx.ConnectError as e:
        logger.error(f"[DEBUG] ERRO DE CONEXÃO com WhatsApp service: {e}")
        raise HTTPException(status_code=500, detail=f"Serviço WhatsApp não está rodando. Vá em Configurações > Dependências e clique em 'Iniciar Serviço'")
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e) or "Erro desconhecido"
        logger.error(f"[DEBUG] Erro ao conectar WhatsApp [{error_type}]: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Erro ao conectar [{error_type}]: {error_msg}")

@api_router.get("/connections/{connection_id}/qr")
async def get_qr_code(connection_id: str, user: dict = Depends(get_current_user)):
    """Obter QR Code - direto e rápido"""
    logger.info(f"[DEBUG] /qr chamado para connection_id={connection_id}")
    
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        logger.error(f"[DEBUG] Conexão não encontrada para QR: {connection_id}")
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    logger.info(f"[DEBUG] Buscando QR para conexão: {connection.get('name')}")
    
    try:
        logger.info(f"[DEBUG] Chamando WhatsApp service /connections/{connection_id}/qr")
        result = await whatsapp_request("GET", f"/connections/{connection_id}/qr")
        logger.info(f"[DEBUG] Resultado do QR: status={result.get('status')}, temQR={result.get('qrImage') is not None}")
        
        # Atualiza status se conectou
        if result.get('status') == 'connected':
            logger.info(f"[DEBUG] Conexão {connection_id} conectada! Phone: {result.get('phoneNumber')}")
            await db.connections.update_one(
                {'id': connection_id},
                {'$set': {'status': 'connected', 'phone_number': result.get('phoneNumber')}}
            )
        
        return result
    except Exception as e:
        logger.error(f"[DEBUG] Erro ao obter QR: {e}")
        return {'qr': None, 'qrImage': None, 'status': 'error', 'error': str(e)}

class PairingCodeRequest(BaseModel):
    phone_number: str

@api_router.post("/connections/{connection_id}/pairing-code")
async def request_pairing_code(connection_id: str, data: PairingCodeRequest, user: dict = Depends(get_current_user)):
    """Solicitar código de pareamento (alternativa ao QR code)"""
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    try:
        # Timeout maior (120s) pois criar conexão e gerar código pode demorar
        result = await whatsapp_request("POST", f"/connections/{connection_id}/pairing-code", {
            'phoneNumber': data.phone_number
        }, timeout=120.0)
        
        if result.get('success'):
            await db.connections.update_one(
                {'id': connection_id},
                {'$set': {'status': 'waiting_code'}}
            )
        
        return result
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e) or "Erro desconhecido"
        logger.error(f"[DEBUG] Erro ao gerar pairing code [{error_type}]: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar código [{error_type}]: {error_msg}")

async def sync_groups(connection_id: str, user_id: str):
    """Sync groups from WhatsApp"""
    try:
        logger.info(f"[DEBUG SYNC] Iniciando sync de grupos para conexão {connection_id}")
        result = await whatsapp_request("GET", f"/connections/{connection_id}/groups?refresh=true")
        logger.info(f"[DEBUG SYNC] Resposta do WhatsApp service: {result}")
        
        groups = result.get('groups', [])
        status = result.get('status', 'unknown')
        
        logger.info(f"[DEBUG SYNC] Status da conexão: {status}, grupos encontrados: {len(groups)}")
        
        if status != 'connected':
            logger.warning(f"[DEBUG SYNC] Conexão não está ativa (status={status}). Grupos podem estar vazios.")
        
        # Delete old groups
        await db.groups.delete_many({'connection_id': connection_id})
        
        # Insert new groups
        for g in groups:
            group = {
                'id': str(uuid.uuid4()),
                'connection_id': connection_id,
                'user_id': user_id,
                'group_id': g['id'],
                'name': g['name'],
                'participants_count': g['participants_count']
            }
            await db.groups.insert_one(group)
        
        # Atualiza contador de grupos na conexão
        await db.connections.update_one(
            {'id': connection_id},
            {'$set': {'groups_count': len(groups)}}
        )
        
        logger.info(f"[DEBUG SYNC] Sincronizados {len(groups)} grupos para conexão {connection_id}")
        return len(groups)
    except Exception as e:
        logger.error(f"[DEBUG SYNC] Erro ao sincronizar grupos: {type(e).__name__}: {e}")
        return 0

@api_router.post("/connections/{connection_id}/refresh-groups")
async def refresh_groups(connection_id: str, user: dict = Depends(get_current_user)):
    """Atualizar lista de grupos - com diagnóstico completo"""
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    logger.info(f"[DEBUG] refresh-groups chamado para {connection_id}, status no banco: {connection.get('status')}")
    
    # Verifica status da conexão no whatsapp-service
    try:
        ws_status = await whatsapp_request("GET", f"/connections/{connection_id}/status", timeout=10.0, auto_recover=False)
        ws_connection_status = ws_status.get('status', 'unknown')
        logger.info(f"[DEBUG] Status no whatsapp-service: {ws_connection_status}")
    except Exception as e:
        ws_connection_status = 'service_error'
        logger.error(f"[DEBUG] Erro ao verificar status no whatsapp-service: {e}")
    
    # Sincroniza grupos
    count = await sync_groups(connection_id, user['id'])
    groups = await db.groups.find({'connection_id': connection_id}, {'_id': 0}).to_list(1000)
    
    return {
        'groups': groups, 
        'count': len(groups),
        'connection_status': connection.get('status'),
        'whatsapp_service_status': ws_connection_status,
        'message': 'Grupos sincronizados' if count > 0 else 'Nenhum grupo encontrado. Verifique se a conexão está ativa no WhatsApp.'
    }

@api_router.post("/connections/{connection_id}/disconnect")
async def disconnect_whatsapp(connection_id: str, user: dict = Depends(get_current_user)):
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    try:
        await whatsapp_request("POST", f"/connections/{connection_id}/disconnect")
    except:
        pass
    
    await db.connections.update_one(
        {'id': connection_id},
        {'$set': {'status': 'disconnected', 'qr_code': None, 'qr_image': None, 'phone_number': None}}
    )
    await db.groups.delete_many({'connection_id': connection_id})
    
    return {'status': 'disconnected'}

@api_router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str, user: dict = Depends(get_current_user)):
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    result = await db.connections.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    try:
        await whatsapp_request("DELETE", f"/connections/{connection_id}")
    except:
        pass
    
    await db.groups.delete_many({'connection_id': connection_id})
    
    return {'message': 'Conexão deletada'}

# ============= Groups =============

@api_router.get("/connections/{connection_id}/groups", response_model=List[GroupResponse])
async def list_groups(connection_id: str, user: dict = Depends(get_current_user)):
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    groups = await db.groups.find({'connection_id': connection_id}, {'_id': 0}).to_list(1000)
    return groups

@api_router.get("/groups", response_model=List[GroupResponse])
async def list_all_groups(user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    groups = await db.groups.find(query, {'_id': 0}).to_list(1000)
    return groups

# ============= Images =============

@api_router.post("/images", response_model=ImageResponse)
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser uma imagem")
    
    # Gera nome único: timestamp + uuid + extensão
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
    filename = f"img_{timestamp}_{unique_id}.{ext}"
    
    # Read file content
    content = await file.read()
    
    # Store in MongoDB as base64
    import base64
    content_base64 = base64.b64encode(content).decode('utf-8')
    
    # Also save to filesystem for backwards compatibility (will be lost on deploy but OK)
    filepath = UPLOADS_DIR / filename
    try:
        async with aiofiles.open(filepath, 'wb') as f:
            await f.write(content)
    except Exception as e:
        logger.warning(f"Could not save to filesystem: {e}")
    
    image = {
        'id': str(uuid.uuid4()),
        'filename': filename,
        'original_name': file.filename,
        'url': f"/uploads/{filename}",
        'user_id': user['id'],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'content_type': file.content_type,
        'data': content_base64,  # Store image data in MongoDB
        'size': len(content)
    }
    
    await db.images.insert_one(image)
    
    # Return without the data field (too large)
    return {
        'id': image['id'],
        'filename': image['filename'],
        'original_name': image['original_name'],
        'url': image['url'],
        'user_id': image['user_id'],
        'created_at': image['created_at']
    }

@api_router.get("/images", response_model=List[ImageResponse])
async def list_images(user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    # Exclude 'data' field as it's too large
    images = await db.images.find(query, {'_id': 0, 'data': 0}).to_list(1000)
    return images

@api_router.get("/images/paginated")
async def list_images_paginated(page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    """List images with pagination"""
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    skip = (page - 1) * limit
    total = await db.images.count_documents(query)
    # Exclude 'data' field as it's too large
    images = await db.images.find(query, {'_id': 0, 'data': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    return {
        'images': images,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit
    }

@api_router.get("/images/{image_id}/file")
async def get_image_file(image_id: str, user: dict = Depends(get_current_user)):
    """Get image file as response"""
    from fastapi.responses import FileResponse, Response
    import base64
    
    # Primeiro tenta encontrar a imagem sem filtro de usuário
    # Isso permite que qualquer usuário autenticado veja imagens em campanhas
    image = await db.images.find_one({'id': image_id})
    if not image:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    
    # Determine content type
    ext = image['filename'].split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    content_type = image.get('content_type') or content_types.get(ext, 'image/jpeg')
    
    # First try filesystem
    filepath = UPLOADS_DIR / image['filename']
    if filepath.exists():
        return FileResponse(filepath, media_type=content_type)
    
    # If not in filesystem, try to get from MongoDB
    if 'data' in image and image['data']:
        try:
            image_data = base64.b64decode(image['data'])
            return Response(content=image_data, media_type=content_type)
        except Exception as e:
            logger.error(f"Error decoding image from MongoDB: {e}")
    
    raise HTTPException(status_code=404, detail="Arquivo não encontrado")

@api_router.put("/images/{image_id}")
async def update_image(image_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Replace an existing image with a new file"""
    import base64
    
    query = {'id': image_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    image = await db.images.find_one(query)
    if not image:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser uma imagem")
    
    # Delete old file from filesystem
    old_filepath = UPLOADS_DIR / image['filename']
    if old_filepath.exists():
        old_filepath.unlink()
    
    # Save new file with unique name
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
    new_filename = f"img_{timestamp}_{unique_id}.{ext}"
    new_filepath = UPLOADS_DIR / new_filename
    
    content = await file.read()
    
    # Save to filesystem (for backwards compatibility)
    try:
        async with aiofiles.open(new_filepath, 'wb') as f:
            await f.write(content)
    except Exception as e:
        logger.warning(f"Could not save to filesystem: {e}")
    
    # Store in MongoDB as base64
    content_base64 = base64.b64encode(content).decode('utf-8')
    
    # Update database
    await db.images.update_one(
        {'id': image_id},
        {'$set': {
            'filename': new_filename,
            'original_name': file.filename,
            'url': f"/uploads/{new_filename}",
            'content_type': file.content_type,
            'data': content_base64,
            'size': len(content)
        }}
    )
    
    updated = await db.images.find_one({'id': image_id}, {'_id': 0, 'data': 0})
    return updated

@api_router.delete("/images/{image_id}")
async def delete_image(image_id: str, user: dict = Depends(get_current_user)):
    query = {'id': image_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    image = await db.images.find_one(query)
    if not image:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    
    filepath = UPLOADS_DIR / image['filename']
    if filepath.exists():
        filepath.unlink()
    
    await db.images.delete_one({'id': image_id})
    return {'message': 'Imagem deletada'}

# ============= Campaigns =============

async def get_image_base64(image_id: str) -> str:
    """Get image as base64 - first tries filesystem, then MongoDB"""
    if not image_id:
        return None
    
    image = await db.images.find_one({'id': image_id})
    if not image:
        return None
    
    # First try filesystem
    filepath = UPLOADS_DIR / image['filename']
    if filepath.exists():
        async with aiofiles.open(filepath, 'rb') as f:
            content = await f.read()
            return base64.b64encode(content).decode('utf-8')
    
    # If not in filesystem, try to get from MongoDB
    if 'data' in image and image['data']:
        return image['data']  # Already base64
    
    logger.warning(f"Image {image_id} not found in filesystem or MongoDB")
    return None

async def ensure_whatsapp_running():
    """Ensure WhatsApp service is running before campaign execution"""
    global whatsapp_process
    
    # Check if WhatsApp service is responding
    try:
        async with httpx.AsyncClient(timeout=3.0) as http_client:
            response = await http_client.get(f"{WHATSAPP_SERVICE_URL}/health")
            if response.status_code == 200:
                return True
    except:
        pass
    
    logger.info("WhatsApp service não está rodando. Tentando iniciar...")
    
    # Check if node is installed
    node_installed, _, node_path = check_node_installed()
    if not node_installed:
        logger.error("Node.js não está instalado. Não é possível iniciar o serviço WhatsApp.")
        return False
    
    if not check_whatsapp_deps_installed():
        logger.error("Dependências do WhatsApp não estão instaladas.")
        return False
    
    # Try to start the service
    try:
        import subprocess
        
        env = os.environ.copy()
        env['PATH'] = f"/usr/local/bin:{env.get('PATH', '')}"
        
        whatsapp_process = subprocess.Popen(
            [node_path or '/usr/local/bin/node', '/app/whatsapp-service/index.js'],
            cwd='/app/whatsapp-service',
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True
        )
        
        # Wait for service to start
        for i in range(10):
            await asyncio.sleep(1)
            try:
                async with httpx.AsyncClient(timeout=2.0) as http_client:
                    response = await http_client.get(f"{WHATSAPP_SERVICE_URL}/health")
                    if response.status_code == 200:
                        logger.info("WhatsApp service iniciado automaticamente")
                        return True
            except:
                pass
        
        logger.warning("WhatsApp service pode estar iniciando em background...")
        return True
    except Exception as e:
        logger.error(f"Erro ao iniciar WhatsApp service: {e}")
        return False

async def execute_campaign(campaign_id: str, resume_from_index: int = 0):
    """Execute campaign - send messages to groups
    
    Args:
        campaign_id: ID da campanha
        resume_from_index: Índice do grupo para retomar (0 = início)
    """
    campaign = await db.campaigns.find_one({'id': campaign_id})
    if not campaign:
        logger.error(f"Campanha {campaign_id} não encontrada")
        return
    
    if campaign['status'] == 'paused':
        logger.info(f"Campanha {campaign_id} pausada, pulando execução")
        return
    
    # Ensure WhatsApp service is running before execution
    whatsapp_ready = await ensure_whatsapp_running()
    if not whatsapp_ready:
        logger.error(f"Campanha {campaign_id}: WhatsApp service não disponível")
        await db.campaigns.update_one(
            {'id': campaign_id},
            {'$set': {'status': 'failed', 'error': 'WhatsApp service não disponível'}}
        )
        return
    
    # Get current progress if resuming
    current_sent = campaign.get('sent_count', 0) if resume_from_index > 0 else 0
    current_group_index = campaign.get('current_group_index', 0) if resume_from_index > 0 else 0
    
    # Use the larger of resume_from_index or saved progress
    start_index = max(resume_from_index, current_group_index)
    
    await db.campaigns.update_one(
        {'id': campaign_id},
        {'$set': {
            'status': 'running', 
            'last_run': datetime.now(timezone.utc).isoformat(),
            'current_group_index': start_index
        }}
    )
    
    sent_count = current_sent
    connection_id = campaign['connection_id']
    
    if start_index > 0:
        logger.info(f"Campanha {campaign_id} retomando do grupo {start_index}/{len(campaign['group_ids'])}")
    
    try:
        # Determine which message/image to send
        message_to_send = None
        image_base64 = None
        
        # Check if campaign has multiple messages
        if campaign.get('messages') and len(campaign['messages']) > 0:
            # Randomly select a message variation
            import random
            selected_msg = random.choice(campaign['messages'])
            message_to_send = selected_msg.get('message')
            
            # Get image for selected message using helper function
            if selected_msg.get('image_id'):
                image_base64 = await get_image_base64(selected_msg['image_id'])
        else:
            # Single message mode
            message_to_send = campaign.get('message')
            
            # Get image if exists using helper function
            if campaign.get('image_id'):
                image_base64 = await get_image_base64(campaign['image_id'])
        
        # Get groups to process, starting from the resume index
        groups_to_process = campaign['group_ids'][start_index:]
        
        for idx, group_id in enumerate(groups_to_process):
            current_index = start_index + idx
            
            try:
                # Get actual group_id from our db
                group = await db.groups.find_one({'id': group_id})
                if not group:
                    # Update index even if group not found
                    await db.campaigns.update_one(
                        {'id': campaign_id},
                        {'$set': {'current_group_index': current_index + 1}}
                    )
                    continue
                
                await whatsapp_request("POST", f"/connections/{connection_id}/send", {
                    'groupId': group['group_id'],
                    'message': message_to_send,
                    'imageBase64': image_base64,
                    'caption': message_to_send if image_base64 else None
                })
                
                sent_count += 1
                
                # Save progress after each successful send
                await db.campaigns.update_one(
                    {'id': campaign_id},
                    {'$set': {
                        'sent_count': sent_count,
                        'current_group_index': current_index + 1
                    }}
                )
                
                # Log each send for dashboard stats
                await db.send_logs.insert_one({
                    'id': str(uuid.uuid4()),
                    'campaign_id': campaign_id,
                    'user_id': campaign.get('user_id'),
                    'group_id': group_id,
                    'group_name': group.get('name', ''),
                    'connection_id': connection_id,
                    'sent_at': datetime.now(timezone.utc).isoformat(),
                    'status': 'sent'
                })
                
                # Delay between messages
                await asyncio.sleep(campaign['delay_seconds'])
                
            except Exception as e:
                error_msg = str(e) if str(e) else 'Erro desconhecido no envio'
                logger.error(f"Erro ao enviar para grupo {group_id}: {error_msg}")
                
                # Save progress even on error
                await db.campaigns.update_one(
                    {'id': campaign_id},
                    {'$set': {'current_group_index': current_index + 1}}
                )
                
                # Get group name for better error logging
                group_name = ''
                if group:
                    group_name = group.get('name', '')
                else:
                    # Try to find group info
                    found_group = await db.groups.find_one({'id': group_id})
                    group_name = found_group.get('name', 'Grupo não encontrado') if found_group else 'Grupo não encontrado'
                
                # Log failed send with detailed error
                await db.send_logs.insert_one({
                    'id': str(uuid.uuid4()),
                    'campaign_id': campaign_id,
                    'user_id': campaign.get('user_id'),
                    'group_id': group_id,
                    'group_name': group_name,
                    'connection_id': connection_id,
                    'sent_at': datetime.now(timezone.utc).isoformat(),
                    'status': 'failed',
                    'error': error_msg
                })
        
        # Update status based on schedule type
        if campaign['schedule_type'] == 'once':
            new_status = 'completed'
            await db.campaigns.update_one(
                {'id': campaign_id},
                {'$set': {
                    'status': new_status, 
                    'sent_count': sent_count, 
                    'last_run': datetime.now(timezone.utc).isoformat(), 
                    'next_run': None,
                    'current_group_index': 0  # Reset index after completion
                }}
            )
        else:
            # Para campanhas recorrentes, reseta o contador para próxima execução
            new_status = 'active'
            next_run = calculate_next_run(campaign)
            await db.campaigns.update_one(
                {'id': campaign_id},
                {'$set': {
                    'status': new_status, 
                    'sent_count': 0, 
                    'last_run': datetime.now(timezone.utc).isoformat(), 
                    'next_run': next_run,
                    'current_group_index': 0  # Reset index for next run
                }}
            )
        
        logger.info(f"Campanha {campaign_id} executada. Enviado para {sent_count} grupos.")
        
    except Exception as e:
        logger.error(f"Campanha {campaign_id} falhou: {str(e)}")
        # Keep current_group_index so it can resume later
        await db.campaigns.update_one(
            {'id': campaign_id},
            {'$set': {'status': 'failed', 'error': str(e)}}
        )

def calculate_next_run(campaign: dict) -> str:
    """Calculate next run time for recurring campaigns"""
    import pytz
    
    # Use São Paulo timezone for all calculations
    sp_tz = pytz.timezone('America/Sao_Paulo')
    now_sp = datetime.now(sp_tz)
    
    if campaign['schedule_type'] == 'interval':
        hours = campaign.get('interval_hours', 1)
        next_run = now_sp + timedelta(hours=hours)
        # Convert to UTC for storage
        return next_run.astimezone(timezone.utc).isoformat()
    
    elif campaign['schedule_type'] == 'specific_times':
        times = campaign.get('specific_times', [])
        if not times:
            return None
        
        # Find next time today or tomorrow (in São Paulo timezone)
        today = now_sp.date()
        for time_str in sorted(times):
            hour, minute = map(int, time_str.split(':'))
            # Create datetime in São Paulo timezone
            next_time = sp_tz.localize(datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute)))
            
            if next_time > now_sp:
                # Convert to UTC for storage
                return next_time.astimezone(timezone.utc).isoformat()
        
        # If no time today, use first time tomorrow
        tomorrow = today + timedelta(days=1)
        hour, minute = map(int, sorted(times)[0].split(':'))
        next_time = sp_tz.localize(datetime.combine(tomorrow, datetime.min.time().replace(hour=hour, minute=minute)))
        return next_time.astimezone(timezone.utc).isoformat()
    
    return None

def schedule_campaign(campaign: dict):
    """Schedule campaign based on type"""
    import pytz
    
    campaign_id = campaign['id']
    sp_tz = pytz.timezone('America/Sao_Paulo')
    
    # Remove existing jobs for this campaign
    try:
        scheduler.remove_job(campaign_id)
    except:
        pass
    
    if campaign['schedule_type'] == 'once':
        # Single execution
        scheduled_dt = datetime.fromisoformat(campaign['scheduled_time'].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        if scheduled_dt > now:
            scheduler.add_job(
                execute_campaign,
                trigger=DateTrigger(run_date=scheduled_dt),
                args=[campaign_id],
                id=campaign_id
            )
            logger.info(f"Campanha {campaign_id} agendada para {scheduled_dt}")
    
    elif campaign['schedule_type'] == 'interval':
        # Interval execution (every X hours)
        hours = campaign.get('interval_hours', 1)
        start_date = datetime.fromisoformat(campaign['start_date'].replace('Z', '+00:00')) if campaign.get('start_date') else datetime.now(timezone.utc)
        end_date = datetime.fromisoformat(campaign['end_date'].replace('Z', '+00:00')) if campaign.get('end_date') else None
        
        scheduler.add_job(
            execute_campaign,
            trigger=IntervalTrigger(hours=hours, start_date=start_date, end_date=end_date),
            args=[campaign_id],
            id=campaign_id
        )
        logger.info(f"Campanha {campaign_id} agendada a cada {hours} horas")
    
    elif campaign['schedule_type'] == 'specific_times':
        # Specific times daily - use São Paulo timezone
        times = campaign.get('specific_times', [])
        for i, time_str in enumerate(times):
            hour, minute = map(int, time_str.split(':'))
            job_id = f"{campaign_id}_time_{i}"
            
            try:
                scheduler.remove_job(job_id)
            except:
                pass
            
            from apscheduler.triggers.cron import CronTrigger
            start_date = datetime.fromisoformat(campaign['start_date'].replace('Z', '+00:00')) if campaign.get('start_date') else None
            end_date = datetime.fromisoformat(campaign['end_date'].replace('Z', '+00:00')) if campaign.get('end_date') else None
            
            # Use timezone='America/Sao_Paulo' to ensure correct time interpretation
            scheduler.add_job(
                execute_campaign,
                trigger=CronTrigger(hour=hour, minute=minute, timezone=sp_tz, start_date=start_date, end_date=end_date),
                args=[campaign_id],
                id=job_id
            )
        
        logger.info(f"Campanha {campaign_id} agendada para horários (Brasília): {times}")

@api_router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(data: CampaignCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    query = {'id': data.connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    if connection['status'] != 'connected':
        raise HTTPException(status_code=400, detail="Conexão não está ativa")
    
    # Process single image
    image_url = None
    if data.image_id:
        image = await db.images.find_one({'id': data.image_id})
        if image:
            image_url = image['url']
    
    # Process multiple messages with images
    messages_with_urls = None
    if data.messages:
        messages_with_urls = []
        for msg in data.messages:
            msg_data = {'message': msg.message, 'image_id': msg.image_id, 'image_url': None}
            if msg.image_id:
                img = await db.images.find_one({'id': msg.image_id})
                if img:
                    msg_data['image_url'] = img['url']
            messages_with_urls.append(msg_data)
    
    campaign = {
        'id': str(uuid.uuid4()),
        'title': data.title,
        'user_id': user['id'],
        'connection_id': data.connection_id,
        'group_ids': data.group_ids,
        'message': data.message,
        'image_id': data.image_id,
        'image_url': image_url,
        'messages': messages_with_urls,
        'schedule_type': data.schedule_type,
        'scheduled_time': data.scheduled_time,
        'interval_hours': data.interval_hours,
        'specific_times': data.specific_times,
        'delay_seconds': data.delay_seconds,
        'start_date': data.start_date,
        'end_date': data.end_date,
        'status': 'paused',  # Campaigns start paused
        'sent_count': 0,
        'total_count': len(data.group_ids),
        'current_message_index': 0,
        'current_group_index': 0,  # Track progress for resume
        'last_run': None,
        'next_run': None,
        'paused_at': None,
        'remaining_time_on_pause': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.campaigns.insert_one(campaign)
    await log_activity(user['id'], user['username'], 'create', 'campaign', campaign['id'], data.title, 'Campanha criada')
    
    return campaign

@api_router.get("/campaigns", response_model=List[CampaignResponse])
async def list_campaigns(page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    skip = (page - 1) * limit
    campaigns = await db.campaigns.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    return campaigns

@api_router.get("/campaigns/paginated")
async def list_campaigns_paginated(page: int = 1, limit: int = 12, user: dict = Depends(get_current_user)):
    """List campaigns with pagination info"""
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    skip = (page - 1) * limit
    total = await db.campaigns.count_documents(query)
    campaigns = await db.campaigns.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    return {
        'campaigns': campaigns,
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit
    }

@api_router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query, {'_id': 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    return campaign

@api_router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    # Calculate remaining time if there's a next_run
    remaining_seconds = None
    if campaign.get('next_run'):
        try:
            next_run_dt = datetime.fromisoformat(campaign['next_run'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            remaining_seconds = int((next_run_dt - now).total_seconds())
            if remaining_seconds < 0:
                remaining_seconds = None
        except:
            pass
    
    try:
        scheduler.remove_job(campaign_id)
        for i in range(20):
            try:
                scheduler.remove_job(f"{campaign_id}_time_{i}")
            except:
                pass
    except:
        pass
    
    await db.campaigns.update_one(
        {'id': campaign_id}, 
        {'$set': {
            'status': 'paused',
            'paused_at': datetime.now(timezone.utc).isoformat(),
            'remaining_time_on_pause': remaining_seconds
        }}
    )
    
    await log_activity(user['id'], user['username'], 'pause', 'campaign', campaign_id, campaign['title'], 'Campanha pausada')
    
    return {'status': 'paused', 'remaining_seconds': remaining_seconds}

@api_router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: str, data: CampaignCreate, user: dict = Depends(get_current_user)):
    """Atualizar campanha existente"""
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    # Não permitir edição de campanhas em execução
    if campaign['status'] == 'running':
        raise HTTPException(status_code=400, detail="Não é possível editar campanha em execução")
    
    # Get image URL if exists
    image_url = None
    if data.image_id:
        image = await db.images.find_one({'id': data.image_id})
        if image:
            image_url = image['url']
    
    # Process multiple messages with images
    messages_with_urls = None
    if data.messages:
        messages_with_urls = []
        for msg in data.messages:
            msg_data = {'message': msg.message, 'image_id': msg.image_id, 'image_url': None}
            if msg.image_id:
                img = await db.images.find_one({'id': msg.image_id})
                if img:
                    msg_data['image_url'] = img['url']
            messages_with_urls.append(msg_data)
    
    # IMPORTANTE: Limpar campos antigos baseado no novo schedule_type
    # Isso evita conflitos quando o tipo de agendamento muda
    update_data = {
        'title': data.title,
        'connection_id': data.connection_id,
        'group_ids': data.group_ids,
        'message': data.message,
        'image_id': data.image_id,
        'image_url': image_url,
        'messages': messages_with_urls,
        'schedule_type': data.schedule_type,
        'delay_seconds': data.delay_seconds,
        'start_date': data.start_date,
        'end_date': data.end_date,
        'total_count': len(data.group_ids),
        # Limpar next_run para forçar recálculo baseado no novo tipo
        'next_run': None,
    }
    
    # Definir campos específicos baseado no tipo de agendamento
    if data.schedule_type == 'once':
        update_data['scheduled_time'] = data.scheduled_time
        update_data['interval_hours'] = None
        update_data['specific_times'] = None
    elif data.schedule_type == 'interval':
        update_data['scheduled_time'] = None
        update_data['interval_hours'] = data.interval_hours
        update_data['specific_times'] = None
    elif data.schedule_type == 'specific_times':
        update_data['scheduled_time'] = None
        update_data['interval_hours'] = None
        update_data['specific_times'] = data.specific_times
    
    # Remove scheduled jobs
    try:
        scheduler.remove_job(campaign_id)
        for i in range(20):
            try:
                scheduler.remove_job(f"{campaign_id}_time_{i}")
            except:
                pass
    except:
        pass
    
    await db.campaigns.update_one({'id': campaign_id}, {'$set': update_data})
    await log_activity(user['id'], user['username'], 'update', 'campaign', campaign_id, data.title, 'Campanha atualizada')
    
    updated = await db.campaigns.find_one({'id': campaign_id}, {'_id': 0})
    return updated

@api_router.post("/campaigns/{campaign_id}/start")
async def start_campaign_now(campaign_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Iniciar campanha imediatamente - já começa enviando"""
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query, {'_id': 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    # Se for horários específicos, ativa a campanha mas não executa agora
    if campaign['schedule_type'] == 'specific_times':
        next_run = calculate_next_run(campaign)
        schedule_campaign(campaign)
        await db.campaigns.update_one(
            {'id': campaign_id}, 
            {'$set': {
                'status': 'active',
                'next_run': next_run,
                'paused_at': None,
                'remaining_time_on_pause': None
            }}
        )
        await log_activity(user['id'], user['username'], 'start', 'campaign', campaign_id, campaign['title'], 'Campanha ativada (horários específicos)')
        return {'status': 'active', 'message': 'Campanha ativada. Enviará nos horários configurados.', 'next_run': next_run}
    
    # Para interval, calcula o próximo envio após a execução atual
    next_run = None
    if campaign['schedule_type'] == 'interval':
        hours = campaign.get('interval_hours', 1)
        next_run = (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
    
    # Para outros tipos, executa imediatamente e reseta contador
    await db.campaigns.update_one(
        {'id': campaign_id}, 
        {'$set': {
            'status': 'running',
            'sent_count': 0,
            'last_run': datetime.now(timezone.utc).isoformat(),
            'next_run': next_run,
            'paused_at': None,
            'remaining_time_on_pause': None
        }}
    )
    background_tasks.add_task(execute_campaign, campaign_id)
    
    # Se for intervalo, também agenda as próximas execuções
    if campaign['schedule_type'] == 'interval':
        schedule_campaign(campaign)
    
    await log_activity(user['id'], user['username'], 'start', 'campaign', campaign_id, campaign['title'], 'Campanha iniciada')
    
    return {'status': 'running', 'message': 'Campanha iniciada!', 'next_run': next_run}

@api_router.post("/campaigns/{campaign_id}/duplicate", response_model=CampaignResponse)
async def duplicate_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    """Duplicar uma campanha existente"""
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    original = await db.campaigns.find_one(query, {'_id': 0})
    if not original:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    # Criar cópia
    new_campaign = {
        'id': str(uuid.uuid4()),
        'title': f"{original['title']} (cópia)",
        'user_id': user['id'],
        'connection_id': original['connection_id'],
        'group_ids': original['group_ids'],
        'message': original.get('message'),
        'image_id': original.get('image_id'),
        'image_url': original.get('image_url'),
        'messages': original.get('messages'),
        'schedule_type': original['schedule_type'],
        'scheduled_time': None,
        'interval_hours': original.get('interval_hours'),
        'specific_times': original.get('specific_times'),
        'delay_seconds': original['delay_seconds'],
        'start_date': None,
        'end_date': None,
        'status': 'paused',
        'sent_count': 0,
        'total_count': len(original['group_ids']),
        'current_message_index': 0,
        'last_run': None,
        'next_run': None,
        'paused_at': None,
        'remaining_time_on_pause': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.campaigns.insert_one(new_campaign)
    await log_activity(user['id'], user['username'], 'duplicate', 'campaign', new_campaign['id'], new_campaign['title'], 'Campanha duplicada')
    
    return new_campaign

@api_router.get("/campaigns/{campaign_id}/groups-info")
async def get_campaign_groups_info(campaign_id: str, user: dict = Depends(get_current_user)):
    """Obter informações dos grupos de uma campanha"""
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    # Buscar detalhes dos grupos
    groups_info = []
    for group_id in campaign.get('group_ids', []):
        group = await db.groups.find_one({'id': group_id}, {'_id': 0})
        if group:
            groups_info.append({
                'id': group['id'],
                'name': group.get('name', 'Grupo sem nome'),
                'group_id': group.get('group_id'),
                'participants_count': group.get('participants_count', 0)
            })
    
    return {
        'campaign_id': campaign_id,
        'campaign_title': campaign.get('title'),
        'total_groups': len(campaign.get('group_ids', [])),
        'groups': groups_info
    }

class CopyGroupsRequest(BaseModel):
    source_campaign_id: str

@api_router.post("/campaigns/{campaign_id}/copy-groups")
async def copy_groups_from_campaign(
    campaign_id: str, 
    data: CopyGroupsRequest,
    user: dict = Depends(get_current_user)
):
    """Copiar grupos de outra campanha para esta campanha"""
    # Verificar campanha destino
    dest_query = {'id': campaign_id}
    if user['role'] != 'admin':
        dest_query['user_id'] = user['id']
    
    dest_campaign = await db.campaigns.find_one(dest_query)
    if not dest_campaign:
        raise HTTPException(status_code=404, detail="Campanha de destino não encontrada")
    
    # Verificar campanha origem
    source_query = {'id': data.source_campaign_id}
    if user['role'] != 'admin':
        source_query['user_id'] = user['id']
    
    source_campaign = await db.campaigns.find_one(source_query)
    if not source_campaign:
        raise HTTPException(status_code=404, detail="Campanha de origem não encontrada")
    
    # Copiar grupos
    source_groups = source_campaign.get('group_ids', [])
    dest_groups = dest_campaign.get('group_ids', [])
    
    # Adicionar grupos que não existem ainda (evitar duplicatas)
    new_groups = list(set(dest_groups + source_groups))
    
    await db.campaigns.update_one(
        {'id': campaign_id},
        {'$set': {
            'group_ids': new_groups,
            'total_count': len(new_groups)
        }}
    )
    
    added_count = len(new_groups) - len(dest_groups)
    
    await log_activity(
        user['id'], 
        user['username'], 
        'copy_groups', 
        'campaign', 
        campaign_id, 
        dest_campaign.get('title'),
        f'Copiados {added_count} grupos de "{source_campaign.get("title")}"'
    )
    
    return {
        'message': f'{added_count} grupos adicionados',
        'previous_count': len(dest_groups),
        'new_count': len(new_groups),
        'source_campaign': source_campaign.get('title')
    }

@api_router.post("/campaigns/{campaign_id}/replace-groups")
async def replace_groups_from_campaign(
    campaign_id: str, 
    data: CopyGroupsRequest,
    user: dict = Depends(get_current_user)
):
    """Substituir grupos desta campanha pelos grupos de outra campanha"""
    # Verificar campanha destino
    dest_query = {'id': campaign_id}
    if user['role'] != 'admin':
        dest_query['user_id'] = user['id']
    
    dest_campaign = await db.campaigns.find_one(dest_query)
    if not dest_campaign:
        raise HTTPException(status_code=404, detail="Campanha de destino não encontrada")
    
    # Verificar campanha origem
    source_query = {'id': data.source_campaign_id}
    if user['role'] != 'admin':
        source_query['user_id'] = user['id']
    
    source_campaign = await db.campaigns.find_one(source_query)
    if not source_campaign:
        raise HTTPException(status_code=404, detail="Campanha de origem não encontrada")
    
    # Substituir grupos
    source_groups = source_campaign.get('group_ids', [])
    
    await db.campaigns.update_one(
        {'id': campaign_id},
        {'$set': {
            'group_ids': source_groups,
            'total_count': len(source_groups)
        }}
    )
    
    await log_activity(
        user['id'], 
        user['username'], 
        'replace_groups', 
        'campaign', 
        campaign_id, 
        dest_campaign.get('title'),
        f'Grupos substituídos por "{source_campaign.get("title")}" ({len(source_groups)} grupos)'
    )
    
    return {
        'message': f'Grupos substituídos com sucesso',
        'new_count': len(source_groups),
        'source_campaign': source_campaign.get('title')
    }

@api_router.post("/campaigns/{campaign_id}/resume")
async def resume_campaign(campaign_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Resume paused campaign - preserves delay"""
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query, {'_id': 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    # Calculate new next_run based on remaining time
    remaining = campaign.get('remaining_time_on_pause')
    now = datetime.now(timezone.utc)
    
    if remaining and remaining > 0:
        next_run = (now + timedelta(seconds=remaining)).isoformat()
    else:
        next_run = calculate_next_run(campaign)
    
    schedule_campaign(campaign)
    await db.campaigns.update_one(
        {'id': campaign_id}, 
        {'$set': {
            'status': 'active',
            'next_run': next_run,
            'paused_at': None,
            'remaining_time_on_pause': None
        }}
    )
    
    await log_activity(user['id'], user['username'], 'resume', 'campaign', campaign_id, campaign['title'], 'Campanha retomada')
    
    return {'status': 'active', 'next_run': next_run}

@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    try:
        scheduler.remove_job(campaign_id)
        # Remove specific time jobs
        for i in range(10):
            try:
                scheduler.remove_job(f"{campaign_id}_time_{i}")
            except:
                pass
    except:
        pass
    
    await db.campaigns.delete_one({'id': campaign_id})
    return {'message': 'Campanha deletada'}

# ============= Dashboard Stats =============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    
    total_connections = await db.connections.count_documents(query)
    active_connections = await db.connections.count_documents({**query, 'status': 'connected'})
    total_campaigns = await db.campaigns.count_documents(query)
    pending_campaigns = await db.campaigns.count_documents({**query, 'status': {'$in': ['pending', 'active']}})
    completed_campaigns = await db.campaigns.count_documents({**query, 'status': 'completed'})
    total_groups = await db.groups.count_documents(query)
    
    pipeline = [
        {'$match': query},
        {'$group': {'_id': None, 'total': {'$sum': '$sent_count'}}}
    ]
    result = await db.campaigns.aggregate(pipeline).to_list(1)
    total_messages_sent = result[0]['total'] if result else 0
    
    return DashboardStats(
        total_connections=total_connections,
        active_connections=active_connections,
        total_campaigns=total_campaigns,
        pending_campaigns=pending_campaigns,
        completed_campaigns=completed_campaigns,
        total_groups=total_groups,
        total_messages_sent=total_messages_sent
    )

# ============= Admin Stats =============

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({'role': 'reseller'})
    active_users = await db.users.count_documents({'role': 'reseller', 'active': True})
    total_connections = await db.connections.count_documents({})
    active_connections = await db.connections.count_documents({'status': 'connected'})
    total_campaigns = await db.campaigns.count_documents({})
    
    recent_campaigns = await db.campaigns.find({}, {'_id': 0}).sort('created_at', -1).limit(10).to_list(10)
    
    return {
        'total_users': total_users,
        'active_users': active_users,
        'total_connections': total_connections,
        'active_connections': active_connections,
        'total_campaigns': total_campaigns,
        'recent_campaigns': recent_campaigns
    }

# ============= Health Check =============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ============= Media Endpoint (serves from MongoDB if not in filesystem) =============

@api_router.get("/media/{filename}")
async def get_media_file(filename: str):
    """Serve media file - first tries filesystem, then MongoDB"""
    from fastapi.responses import FileResponse, Response
    import base64
    
    # Determine content type
    ext = filename.split('.')[-1].lower() if '.' in filename else 'jpg'
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    content_type = content_types.get(ext, 'image/jpeg')
    
    # First try filesystem
    filepath = UPLOADS_DIR / filename
    if filepath.exists():
        return FileResponse(filepath, media_type=content_type)
    
    # If not in filesystem, try to get from MongoDB
    image = await db.images.find_one({'filename': filename})
    if image and 'data' in image and image['data']:
        try:
            image_data = base64.b64decode(image['data'])
            return Response(content=image_data, media_type=image.get('content_type', content_type))
        except Exception as e:
            logger.error(f"Error decoding image from MongoDB: {e}")
    
    raise HTTPException(status_code=404, detail="Arquivo não encontrado")

# Include the router in the main app
app.include_router(api_router)

# Serve uploaded files - fallback to static files if available
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

@app.on_event("startup")
async def startup_event():
    scheduler.start()
    logger.info("Scheduler iniciado")
    
    # Create indexes for better query performance
    try:
        await db.send_logs.create_index([("user_id", 1), ("sent_at", -1)])
        await db.send_logs.create_index([("sent_at", -1)])
        await db.send_logs.create_index([("campaign_id", 1)])
        await db.send_logs.create_index([("status", 1)])
        logger.info("Indexes criados para send_logs")
    except Exception as e:
        logger.warning(f"Erro ao criar indexes: {e}")
    
    admin = await db.users.find_one({'username': 'admin'})
    if not admin:
        admin_user = {
            'id': str(uuid.uuid4()),
            'username': 'admin',
            'password': hash_password('admin123'),
            'role': 'admin',
            'max_connections': -1,
            'active': True,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Usuário admin criado: admin / admin123")
    
    # Start WhatsApp service if not running
    await start_whatsapp_service()
    
    # Resume campaigns that were running when server stopped
    running_campaigns = await db.campaigns.find({'status': 'running'}, {'_id': 0}).to_list(1000)
    for campaign in running_campaigns:
        try:
            current_index = campaign.get('current_group_index', 0)
            total_groups = len(campaign.get('group_ids', []))
            
            if current_index < total_groups:
                logger.info(f"Retomando campanha {campaign['id']} do grupo {current_index}/{total_groups}")
                # Use background task to resume campaign
                import asyncio
                asyncio.create_task(execute_campaign(campaign['id'], resume_from_index=current_index))
            else:
                # Campaign was completed but status wasn't updated
                logger.info(f"Campanha {campaign['id']} já foi concluída, atualizando status")
                if campaign['schedule_type'] == 'once':
                    await db.campaigns.update_one(
                        {'id': campaign['id']},
                        {'$set': {'status': 'completed', 'current_group_index': 0}}
                    )
                else:
                    next_run = calculate_next_run(campaign)
                    await db.campaigns.update_one(
                        {'id': campaign['id']},
                        {'$set': {'status': 'active', 'current_group_index': 0, 'next_run': next_run}}
                    )
        except Exception as e:
            logger.error(f"Erro ao retomar campanha {campaign['id']}: {e}")
    
    # Reload active campaigns (scheduled ones)
    active_campaigns = await db.campaigns.find({'status': {'$in': ['active', 'pending']}}, {'_id': 0}).to_list(1000)
    for campaign in active_campaigns:
        try:
            schedule_campaign(campaign)
        except Exception as e:
            logger.error(f"Erro ao recarregar campanha {campaign['id']}: {e}")

async def start_whatsapp_service():
    """Ensure WhatsApp service is running - with auto-setup"""
    import subprocess
    import asyncio
    
    global whatsapp_process
    
    # Check if WhatsApp service is responding
    try:
        async with httpx.AsyncClient(timeout=3.0) as http_client:
            response = await http_client.get(f"{WHATSAPP_SERVICE_URL}/health")
            if response.status_code == 200:
                logger.info("WhatsApp service já está rodando")
                return
    except:
        pass
    
    logger.info("WhatsApp service não está rodando. Iniciando auto-setup...")
    
    # Run auto-setup script
    try:
        result = subprocess.run(
            ['python3', '/app/backend/auto_setup.py'],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes max
            cwd='/app/backend'
        )
        
        if result.stdout:
            for line in result.stdout.split('\n'):
                if line.strip():
                    logger.info(f"[auto-setup] {line}")
        
        if result.stderr:
            for line in result.stderr.split('\n'):
                if line.strip():
                    logger.warning(f"[auto-setup] {line}")
        
        # Check if service is now running
        await asyncio.sleep(2)
        try:
            async with httpx.AsyncClient(timeout=3.0) as http_client:
                response = await http_client.get(f"{WHATSAPP_SERVICE_URL}/health")
                if response.status_code == 200:
                    logger.info("WhatsApp service iniciado com sucesso via auto-setup")
                    return
        except:
            pass
        
        logger.warning("Auto-setup concluído, mas serviço ainda não responde. Pode estar iniciando...")
        
    except subprocess.TimeoutExpired:
        logger.error("Auto-setup timeout - pode demorar mais para instalar dependências")
    except Exception as e:
        logger.error(f"Erro no auto-setup: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    client.close()
