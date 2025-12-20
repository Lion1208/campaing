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

async def whatsapp_request(method: str, endpoint: str, json_data: dict = None):
    """Make request to WhatsApp service"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{WHATSAPP_SERVICE_URL}{endpoint}"
        if method == "GET":
            response = await client.get(url)
        elif method == "POST":
            response = await client.post(url, json=json_data)
        elif method == "DELETE":
            response = await client.delete(url)
        return response.json()

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
    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    from_date_str = from_date.isoformat()
    
    # Query filter based on role
    user_query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    
    # Count resellers
    resellers_count = 0
    if user['role'] == 'admin':
        resellers_count = await db.users.count_documents({'role': {'$in': ['reseller', 'master']}})
    elif user['role'] == 'master':
        resellers_count = await db.users.count_documents({'created_by': user['id']})
    
    # Count sends from campaigns
    campaigns = await db.campaigns.find(user_query, {'_id': 0}).to_list(1000)
    
    # Calculate total sends
    total_sends = sum(c.get('sent_count', 0) for c in campaigns)
    
    # Calculate sends today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    sends_today = 0
    sends_period = 0
    
    for c in campaigns:
        last_run = c.get('last_run')
        if last_run:
            try:
                last_run_dt = datetime.fromisoformat(last_run.replace('Z', '+00:00'))
                if last_run_dt >= today_start:
                    sends_today += c.get('sent_count', 0)
                if last_run_dt >= from_date:
                    sends_period += c.get('sent_count', 0)
            except:
                pass
    
    # Generate daily sends data for chart
    daily_sends = []
    for i in range(days):
        day_date = datetime.now(timezone.utc).date() - timedelta(days=days-1-i)
        day_sends = 0
        for c in campaigns:
            last_run = c.get('last_run')
            if last_run:
                try:
                    last_run_dt = datetime.fromisoformat(last_run.replace('Z', '+00:00'))
                    if last_run_dt.date() == day_date:
                        day_sends += c.get('sent_count', 0)
                except:
                    pass
        daily_sends.append(day_sends)
    
    # Success rate (simplified - based on completed vs total)
    completed = len([c for c in campaigns if c.get('status') == 'completed'])
    total_camps = len(campaigns)
    success_rate = int((completed / total_camps * 100) if total_camps > 0 else 100)
    
    return {
        'resellers_count': resellers_count,
        'sends_today': sends_today,
        'sends_period': sends_period,
        'total_sends': total_sends,
        'success_rate': success_rate,
        'daily_sends': daily_sends
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
    update_data = {}
    if data.username is not None:
        # Check if username is taken
        existing = await db.users.find_one({'username': data.username, 'id': {'$ne': user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Nome de usuário já existe")
        update_data['username'] = data.username
    if data.max_connections is not None:
        update_data['max_connections'] = data.max_connections
    if data.credits is not None:
        update_data['credits'] = data.credits
    if data.active is not None:
        update_data['active'] = data.active
    if data.expires_at is not None:
        update_data['expires_at'] = data.expires_at
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    result = await db.users.update_one({'id': user_id}, {'$set': update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    await log_activity(admin['id'], admin['username'], 'update', 'user', user_id, user['username'], 'Usuário atualizado')
    
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
    if data.max_connections is not None:
        update_data['max_connections'] = data.max_connections
    if data.active is not None:
        update_data['active'] = data.active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    await db.users.update_one({'id': user_id}, {'$set': update_data})
    
    updated = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    await log_activity(master['id'], master['username'], 'update', 'reseller', user_id, updated['username'], 'Revendedor atualizado')
    
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
async def list_connections(user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    connections = await db.connections.find(query, {'_id': 0}).to_list(1000)
    
    # Update status from WhatsApp service
    for conn in connections:
        try:
            status_data = await whatsapp_request("GET", f"/connections/{conn['id']}/status")
            if status_data.get('status') != 'not_found':
                conn['status'] = status_data.get('status', conn['status'])
                if status_data.get('phoneNumber'):
                    conn['phone_number'] = status_data['phoneNumber']
        except:
            pass
    
    return connections

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
    """Iniciar conexão WhatsApp - gera QR Code real"""
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    try:
        # Start connection on WhatsApp service
        result = await whatsapp_request("POST", f"/connections/{connection_id}/start")
        
        await db.connections.update_one(
            {'id': connection_id},
            {'$set': {'status': 'connecting'}}
        )
        
        return {'status': 'connecting', 'message': 'Conexão iniciada. Aguarde o QR Code.'}
    except httpx.ConnectError:
        logger.error(f"Serviço WhatsApp não está acessível")
        raise HTTPException(status_code=503, detail="Serviço WhatsApp não está disponível. Tente novamente em alguns segundos.")
    except Exception as e:
        logger.error(f"Erro ao conectar WhatsApp: {e}")
        # Try to reset and start fresh
        try:
            await whatsapp_request("DELETE", f"/connections/{connection_id}")
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Erro ao iniciar conexão: {str(e)}")

@api_router.get("/connections/{connection_id}/qr")
async def get_qr_code(connection_id: str, user: dict = Depends(get_current_user)):
    """Obter QR Code da conexão"""
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    try:
        result = await whatsapp_request("GET", f"/connections/{connection_id}/qr")
        
        if result.get('status') == 'connected':
            # Update connection as connected
            phone = result.get('phoneNumber')
            await db.connections.update_one(
                {'id': connection_id},
                {'$set': {'status': 'connected', 'phone_number': phone, 'qr_code': None, 'qr_image': None}}
            )
            # Sync groups
            await sync_groups(connection_id, user['id'])
        
        return {
            'qr_code': result.get('qr'),
            'qr_image': result.get('qrImage'),
            'status': result.get('status', 'connecting')
        }
    except Exception as e:
        logger.error(f"Erro ao obter QR: {e}")
        return {'qr_code': None, 'qr_image': None, 'status': 'error'}

async def sync_groups(connection_id: str, user_id: str):
    """Sync groups from WhatsApp"""
    try:
        result = await whatsapp_request("GET", f"/connections/{connection_id}/groups?refresh=true")
        groups = result.get('groups', [])
        
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
        
        logger.info(f"Sincronizados {len(groups)} grupos para conexão {connection_id}")
    except Exception as e:
        logger.error(f"Erro ao sincronizar grupos: {e}")

@api_router.post("/connections/{connection_id}/refresh-groups")
async def refresh_groups(connection_id: str, user: dict = Depends(get_current_user)):
    """Atualizar lista de grupos"""
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    await sync_groups(connection_id, user['id'])
    groups = await db.groups.find({'connection_id': connection_id}, {'_id': 0}).to_list(1000)
    return {'groups': groups, 'count': len(groups)}

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
    filepath = UPLOADS_DIR / filename
    
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    image = {
        'id': str(uuid.uuid4()),
        'filename': filename,
        'original_name': file.filename,
        'url': f"/uploads/{filename}",
        'user_id': user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.images.insert_one(image)
    return image

@api_router.get("/images", response_model=List[ImageResponse])
async def list_images(user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    images = await db.images.find(query, {'_id': 0}).to_list(1000)
    return images

@api_router.get("/images/paginated")
async def list_images_paginated(page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    """List images with pagination"""
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    skip = (page - 1) * limit
    total = await db.images.count_documents(query)
    images = await db.images.find(query, {'_id': 0}).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
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
    from fastapi.responses import FileResponse
    
    # Primeiro tenta encontrar a imagem sem filtro de usuário
    # Isso permite que qualquer usuário autenticado veja imagens em campanhas
    image = await db.images.find_one({'id': image_id})
    if not image:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    
    filepath = UPLOADS_DIR / image['filename']
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    
    # Determine content type
    ext = image['filename'].split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    content_type = content_types.get(ext, 'image/jpeg')
    
    return FileResponse(filepath, media_type=content_type)

@api_router.put("/images/{image_id}")
async def update_image(image_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Replace an existing image with a new file"""
    query = {'id': image_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    image = await db.images.find_one(query)
    if not image:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser uma imagem")
    
    # Delete old file
    old_filepath = UPLOADS_DIR / image['filename']
    if old_filepath.exists():
        old_filepath.unlink()
    
    # Save new file with unique name
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
    new_filename = f"img_{timestamp}_{unique_id}.{ext}"
    new_filepath = UPLOADS_DIR / new_filename
    
    async with aiofiles.open(new_filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Update database
    await db.images.update_one(
        {'id': image_id},
        {'$set': {
            'filename': new_filename,
            'original_name': file.filename,
            'url': f"/uploads/{new_filename}"
        }}
    )
    
    updated = await db.images.find_one({'id': image_id}, {'_id': 0})
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

async def execute_campaign(campaign_id: str):
    """Execute campaign - send messages to groups"""
    campaign = await db.campaigns.find_one({'id': campaign_id})
    if not campaign:
        logger.error(f"Campanha {campaign_id} não encontrada")
        return
    
    if campaign['status'] == 'paused':
        logger.info(f"Campanha {campaign_id} pausada, pulando execução")
        return
    
    await db.campaigns.update_one(
        {'id': campaign_id},
        {'$set': {'status': 'running', 'last_run': datetime.now(timezone.utc).isoformat()}}
    )
    
    sent_count = 0
    connection_id = campaign['connection_id']
    
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
            
            # Get image for selected message
            if selected_msg.get('image_id'):
                image = await db.images.find_one({'id': selected_msg['image_id']})
                if image:
                    filepath = UPLOADS_DIR / image['filename']
                    if filepath.exists():
                        async with aiofiles.open(filepath, 'rb') as f:
                            content = await f.read()
                            image_base64 = base64.b64encode(content).decode('utf-8')
        else:
            # Single message mode
            message_to_send = campaign.get('message')
            
            # Get image if exists
            if campaign.get('image_id'):
                image = await db.images.find_one({'id': campaign['image_id']})
                if image:
                    filepath = UPLOADS_DIR / image['filename']
                    if filepath.exists():
                        async with aiofiles.open(filepath, 'rb') as f:
                            content = await f.read()
                            image_base64 = base64.b64encode(content).decode('utf-8')
        
        for group_id in campaign['group_ids']:
            try:
                # Get actual group_id from our db
                group = await db.groups.find_one({'id': group_id})
                if not group:
                    continue
                
                await whatsapp_request("POST", f"/connections/{connection_id}/send", {
                    'groupId': group['group_id'],
                    'message': message_to_send,
                    'imageBase64': image_base64,
                    'caption': message_to_send if image_base64 else None
                })
                
                sent_count += 1
                await db.campaigns.update_one(
                    {'id': campaign_id},
                    {'$set': {'sent_count': sent_count}}
                )
                
                # Delay between messages
                await asyncio.sleep(campaign['delay_seconds'])
                
            except Exception as e:
                logger.error(f"Erro ao enviar para grupo {group_id}: {e}")
        
        # Update status based on schedule type
        if campaign['schedule_type'] == 'once':
            new_status = 'completed'
            await db.campaigns.update_one(
                {'id': campaign_id},
                {'$set': {'status': new_status, 'sent_count': sent_count, 'last_run': datetime.now(timezone.utc).isoformat(), 'next_run': None}}
            )
        else:
            # Para campanhas recorrentes, reseta o contador para próxima execução
            new_status = 'active'
            next_run = calculate_next_run(campaign)
            await db.campaigns.update_one(
                {'id': campaign_id},
                {'$set': {'status': new_status, 'sent_count': 0, 'last_run': datetime.now(timezone.utc).isoformat(), 'next_run': next_run}}
            )
        
        logger.info(f"Campanha {campaign_id} executada. Enviado para {sent_count} grupos.")
        
    except Exception as e:
        logger.error(f"Campanha {campaign_id} falhou: {str(e)}")
        await db.campaigns.update_one(
            {'id': campaign_id},
            {'$set': {'status': 'failed', 'error': str(e)}}
        )

def calculate_next_run(campaign: dict) -> str:
    """Calculate next run time for recurring campaigns"""
    now = datetime.now(timezone.utc)
    
    if campaign['schedule_type'] == 'interval':
        hours = campaign.get('interval_hours', 1)
        next_run = now + timedelta(hours=hours)
        return next_run.isoformat()
    
    elif campaign['schedule_type'] == 'specific_times':
        times = campaign.get('specific_times', [])
        if not times:
            return None
        
        # Find next time today or tomorrow
        today = now.date()
        for time_str in sorted(times):
            hour, minute = map(int, time_str.split(':'))
            next_time = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute))
            next_time = next_time.replace(tzinfo=timezone.utc)
            
            if next_time > now:
                return next_time.isoformat()
        
        # If no time today, use first time tomorrow
        tomorrow = today + timedelta(days=1)
        hour, minute = map(int, sorted(times)[0].split(':'))
        next_time = datetime.combine(tomorrow, datetime.min.time().replace(hour=hour, minute=minute))
        next_time = next_time.replace(tzinfo=timezone.utc)
        return next_time.isoformat()
    
    return None

def schedule_campaign(campaign: dict):
    """Schedule campaign based on type"""
    campaign_id = campaign['id']
    
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
        # Specific times daily
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
            
            scheduler.add_job(
                execute_campaign,
                trigger=CronTrigger(hour=hour, minute=minute, start_date=start_date, end_date=end_date),
                args=[campaign_id],
                id=job_id
            )
        
        logger.info(f"Campanha {campaign_id} agendada para horários: {times}")

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

# Include the router in the main app
app.include_router(api_router)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    scheduler.start()
    logger.info("Scheduler iniciado")
    
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
    
    # Reload active campaigns
    active_campaigns = await db.campaigns.find({'status': {'$in': ['active', 'pending']}}, {'_id': 0}).to_list(1000)
    for campaign in active_campaigns:
        try:
            schedule_campaign(campaign)
        except Exception as e:
            logger.error(f"Erro ao recarregar campanha {campaign['id']}: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    client.close()
