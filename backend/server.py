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
import aiofiles
import json

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
    role: str = "reseller"  # admin or reseller
    max_connections: int = 1

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    role: str
    max_connections: int
    active: bool
    created_at: str

class UserUpdate(BaseModel):
    max_connections: Optional[int] = None
    active: Optional[bool] = None

class ConnectionCreate(BaseModel):
    name: str

class ConnectionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    user_id: str
    status: str  # disconnected, connecting, connected
    qr_code: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: str

class GroupResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    connection_id: str
    group_id: str
    name: str
    participants_count: int

class CampaignCreate(BaseModel):
    title: str
    connection_id: str
    group_ids: List[str]
    message: Optional[str] = None
    image_id: Optional[str] = None
    scheduled_time: str  # ISO format
    delay_seconds: int = 5  # Delay between messages

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
    scheduled_time: str
    delay_seconds: int
    status: str  # pending, running, completed, failed
    sent_count: int
    total_count: int
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

# ============= Auth Endpoints =============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    # Check if username exists
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
    
    if not user.get('active', True):
        raise HTTPException(status_code=401, detail="Usuário desativado")
    
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

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'max_connections': user['max_connections']
    }

# ============= Admin - User Management =============

@api_router.get("/admin/users", response_model=List[UserResponse])
async def list_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({'role': 'reseller'}, {'_id': 0, 'password': 0}).to_list(1000)
    return users

@api_router.post("/admin/users", response_model=UserResponse)
async def create_user(data: UserCreate, admin: dict = Depends(get_admin_user)):
    existing = await db.users.find_one({'username': data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    
    user = {
        'id': str(uuid.uuid4()),
        'username': data.username,
        'password': hash_password(data.password),
        'role': 'reseller',
        'max_connections': data.max_connections,
        'active': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    del user['password']
    return user

@api_router.put("/admin/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, data: UserUpdate, admin: dict = Depends(get_admin_user)):
    update_data = {}
    if data.max_connections is not None:
        update_data['max_connections'] = data.max_connections
    if data.active is not None:
        update_data['active'] = data.active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    result = await db.users.update_one({'id': user_id}, {'$set': update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    return user

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.users.delete_one({'id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Also delete user's connections, campaigns, etc.
    await db.connections.delete_many({'user_id': user_id})
    await db.campaigns.delete_many({'user_id': user_id})
    await db.groups.delete_many({'user_id': user_id})
    
    return {'message': 'Usuário deletado com sucesso'}

# ============= Connections =============

@api_router.get("/connections", response_model=List[ConnectionResponse])
async def list_connections(user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    connections = await db.connections.find(query, {'_id': 0}).to_list(1000)
    return connections

@api_router.post("/connections", response_model=ConnectionResponse)
async def create_connection(data: ConnectionCreate, user: dict = Depends(get_current_user)):
    # Check connection limit for resellers
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
    """Iniciar conexão WhatsApp - gera QR Code simulado"""
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    # Simular geração de QR Code (em produção, usar whatsapp-web.js)
    qr_data = f"whatsapp://connect/{connection_id}/{uuid.uuid4()}"
    
    await db.connections.update_one(
        {'id': connection_id},
        {'$set': {'status': 'connecting', 'qr_code': qr_data}}
    )
    
    return {'qr_code': qr_data, 'status': 'connecting'}

@api_router.post("/connections/{connection_id}/simulate-connect")
async def simulate_connection(connection_id: str, user: dict = Depends(get_current_user)):
    """Simular conexão bem-sucedida (para demo)"""
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    # Simular conexão bem-sucedida
    phone = f"+55 11 9{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    
    await db.connections.update_one(
        {'id': connection_id},
        {'$set': {
            'status': 'connected',
            'qr_code': None,
            'phone_number': phone
        }}
    )
    
    # Simular grupos
    sample_groups = [
        {'name': 'Marketing Digital', 'participants_count': 156},
        {'name': 'Vendas Online', 'participants_count': 89},
        {'name': 'Equipe Comercial', 'participants_count': 45},
        {'name': 'Clientes Premium', 'participants_count': 234},
        {'name': 'Parceiros', 'participants_count': 67},
    ]
    
    for group_data in sample_groups:
        group = {
            'id': str(uuid.uuid4()),
            'connection_id': connection_id,
            'user_id': user['id'],
            'group_id': f"group_{uuid.uuid4().hex[:8]}@g.us",
            'name': group_data['name'],
            'participants_count': group_data['participants_count']
        }
        await db.groups.update_one(
            {'connection_id': connection_id, 'name': group_data['name']},
            {'$set': group},
            upsert=True
        )
    
    return {'status': 'connected', 'phone_number': phone}

@api_router.post("/connections/{connection_id}/disconnect")
async def disconnect_whatsapp(connection_id: str, user: dict = Depends(get_current_user)):
    query = {'id': connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    await db.connections.update_one(
        {'id': connection_id},
        {'$set': {'status': 'disconnected', 'qr_code': None, 'phone_number': None}}
    )
    
    # Remove groups
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
    
    await db.groups.delete_many({'connection_id': connection_id})
    
    return {'message': 'Conexão deletada'}

# ============= Groups =============

@api_router.get("/connections/{connection_id}/groups", response_model=List[GroupResponse])
async def list_groups(connection_id: str, user: dict = Depends(get_current_user)):
    # Verify connection ownership
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
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
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

@api_router.delete("/images/{image_id}")
async def delete_image(image_id: str, user: dict = Depends(get_current_user)):
    query = {'id': image_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    image = await db.images.find_one(query)
    if not image:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")
    
    # Delete file
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
        logger.error(f"Campaign {campaign_id} not found")
        return
    
    await db.campaigns.update_one(
        {'id': campaign_id},
        {'$set': {'status': 'running'}}
    )
    
    sent_count = 0
    try:
        # In production, use whatsapp-web.js to send messages
        # For now, simulate sending
        import asyncio
        
        for group_id in campaign['group_ids']:
            # Simulate sending
            await asyncio.sleep(campaign['delay_seconds'])
            sent_count += 1
            
            await db.campaigns.update_one(
                {'id': campaign_id},
                {'$set': {'sent_count': sent_count}}
            )
        
        await db.campaigns.update_one(
            {'id': campaign_id},
            {'$set': {'status': 'completed', 'sent_count': sent_count}}
        )
        logger.info(f"Campaign {campaign_id} completed. Sent to {sent_count} groups.")
        
    except Exception as e:
        logger.error(f"Campaign {campaign_id} failed: {str(e)}")
        await db.campaigns.update_one(
            {'id': campaign_id},
            {'$set': {'status': 'failed', 'error': str(e)}}
        )

@api_router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(data: CampaignCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    # Verify connection ownership
    query = {'id': data.connection_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    connection = await db.connections.find_one(query)
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    
    if connection['status'] != 'connected':
        raise HTTPException(status_code=400, detail="Conexão não está ativa")
    
    # Get image URL if exists
    image_url = None
    if data.image_id:
        image = await db.images.find_one({'id': data.image_id})
        if image:
            image_url = image['url']
    
    campaign = {
        'id': str(uuid.uuid4()),
        'title': data.title,
        'user_id': user['id'],
        'connection_id': data.connection_id,
        'group_ids': data.group_ids,
        'message': data.message,
        'image_id': data.image_id,
        'image_url': image_url,
        'scheduled_time': data.scheduled_time,
        'delay_seconds': data.delay_seconds,
        'status': 'pending',
        'sent_count': 0,
        'total_count': len(data.group_ids),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.campaigns.insert_one(campaign)
    
    # Schedule the campaign
    try:
        scheduled_dt = datetime.fromisoformat(data.scheduled_time.replace('Z', '+00:00'))
        
        # If scheduled time is in the past or within 1 minute, execute immediately
        now = datetime.now(timezone.utc)
        if scheduled_dt <= now + timedelta(minutes=1):
            background_tasks.add_task(execute_campaign, campaign['id'])
        else:
            scheduler.add_job(
                execute_campaign,
                trigger=DateTrigger(run_date=scheduled_dt),
                args=[campaign['id']],
                id=campaign['id']
            )
    except Exception as e:
        logger.error(f"Error scheduling campaign: {str(e)}")
        background_tasks.add_task(execute_campaign, campaign['id'])
    
    return campaign

@api_router.get("/campaigns", response_model=List[CampaignResponse])
async def list_campaigns(user: dict = Depends(get_current_user)):
    query = {} if user['role'] == 'admin' else {'user_id': user['id']}
    campaigns = await db.campaigns.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    return campaigns

@api_router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query, {'_id': 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    return campaign

@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    query = {'id': campaign_id}
    if user['role'] != 'admin':
        query['user_id'] = user['id']
    
    campaign = await db.campaigns.find_one(query)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    
    # Cancel scheduled job if pending
    if campaign['status'] == 'pending':
        try:
            scheduler.remove_job(campaign_id)
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
    pending_campaigns = await db.campaigns.count_documents({**query, 'status': 'pending'})
    completed_campaigns = await db.campaigns.count_documents({**query, 'status': 'completed'})
    total_groups = await db.groups.count_documents(query)
    
    # Calculate total messages sent
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
    
    # Get recent campaigns
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
    # Start scheduler
    scheduler.start()
    logger.info("Scheduler started")
    
    # Create admin user if not exists
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
        logger.info("Admin user created: admin / admin123")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    client.close()
