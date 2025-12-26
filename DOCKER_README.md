# 🐳 NexuZap - Docker Installation Guide

## 📋 Prerequisites

- Docker Engine 24.0+
- Docker Compose 2.0+
- 2GB RAM minimum
- 20GB disk space

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/Lion1208/campaing.git
cd campaing
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend  
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your settings
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Check Status

```bash
docker-compose ps
```

### 5. Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- Login: admin / admin123

---

## 📊 Managing Services

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f whatsapp-service
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend

# Rebuild after code changes
docker-compose up -d --build

# Remove everything (including volumes)
docker-compose down -v
```

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :8001
sudo lsof -i :3002

# Kill the process
sudo kill -9 <PID>
```

### Container Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Restart service
docker-compose restart <service-name>

# Rebuild and restart
docker-compose up -d --build <service-name>
```

### MongoDB Connection Issues

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Access MongoDB shell
docker-compose exec mongodb mongosh

# Check MongoDB logs
docker-compose logs mongodb
```

---

## 💾 Backup & Restore

### Backup

```bash
# Backup MongoDB
docker-compose exec mongodb mongodump --out /tmp/backup
docker cp nexuzap-mongodb:/tmp/backup ./mongodb_backup

# Backup volumes
docker run --rm -v campaing_mongodb_data:/data -v $(pwd):/backup ubuntu tar czf /backup/mongodb_backup.tar.gz /data
```

### Restore

```bash
# Restore MongoDB
docker cp ./mongodb_backup nexuzap-mongodb:/tmp/backup
docker-compose exec mongodb mongorestore /tmp/backup
```

---

## 🔒 Production Deployment

### 1. Update Environment Variables

Edit `docker-compose.yml` for production:

```yaml
services:
  backend:
    environment:
      - WHATSAPP_SERVICE_URL=http://whatsapp-service:3002
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=nexuzap_production
      - CORS_ORIGINS=https://yourdomain.com
      - JWT_SECRET=${JWT_SECRET}  # Use secrets!
```

### 2. Use Nginx Reverse Proxy

Create `/etc/nginx/sites-available/nexuzap`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Setup SSL with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com
```

### 4. Auto-start on Boot

```bash
# Enable Docker service
sudo systemctl enable docker

# Create systemd service
sudo nano /etc/systemd/system/nexuzap.service
```

Content:

```ini
[Unit]
Description=NexuZap Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/nexuzap
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl enable nexuzap
sudo systemctl start nexuzap
```

---

## 🔄 Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

---

## 📈 Monitoring

### Resource Usage

```bash
# Overall stats
docker stats

# Specific container
docker stats nexuzap-backend
```

### Health Checks

```bash
# Check all containers
docker-compose ps

# Check logs for errors
docker-compose logs --tail=100 | grep -i error
```

---

## ⚡ Performance Tuning

### docker-compose.yml optimizations:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          memory: 512M
```

---

## 🆚 Docker vs Traditional Installation

| Feature | Docker | Traditional |
|---------|--------|-------------|
| Installation Time | 5 min | 15 min |
| Isolation | ✅ Full | ❌ Shared |
| Portability | ✅ High | ⚠️ Medium |
| Resource Usage | ⚠️ Higher | ✅ Lower |
| Updates | ✅ Easy | ⚠️ Manual |
| Debugging | ⚠️ Harder | ✅ Easier |

---

## 📞 Support

- GitHub: https://github.com/Lion1208/campaing
- Issues: https://github.com/Lion1208/campaing/issues
