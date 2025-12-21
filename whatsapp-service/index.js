import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const logger = pino({ level: 'warn' });
const PORT = process.env.WHATSAPP_PORT || 3002;
const AUTH_DIR = path.join(__dirname, 'auth_sessions');
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'nexuzap';

// MongoDB client
let mongoClient = null;
let db = null;

// Store active connections
const connections = new Map();

// Keep-alive interval (check every 30 seconds)
const KEEPALIVE_INTERVAL = 30000;
// Connection timeout (if no response in 10 seconds, consider dead)
const CONNECTION_TIMEOUT = 10000;

// Ensure auth directory exists (fallback)
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Connect to MongoDB
async function connectMongo() {
    if (mongoClient && db) return db;
    
    try {
        mongoClient = new MongoClient(MONGO_URL);
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        console.log('MongoDB conectado para sessões WhatsApp');
        return db;
    } catch (error) {
        console.error('Erro ao conectar MongoDB:', error.message);
        return null;
    }
}

// Custom auth state that stores in MongoDB
async function useMongoAuthState(connectionId) {
    const database = await connectMongo();
    const collectionName = 'whatsapp_sessions';
    
    // Fallback to file-based auth if MongoDB not available
    if (!database) {
        console.log(`[${connectionId}] MongoDB não disponível, usando filesystem`);
        const sessionPath = path.join(AUTH_DIR, connectionId);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        return useMultiFileAuthState(sessionPath);
    }
    
    const collection = database.collection(collectionName);
    
    // Helper to read data from MongoDB
    const readData = async (key) => {
        try {
            const doc = await collection.findOne({ 
                connectionId, 
                key 
            });
            return doc?.data ? JSON.parse(doc.data, BufferJSON.reviver) : null;
        } catch (error) {
            console.error(`[${connectionId}] Erro ao ler ${key}:`, error.message);
            return null;
        }
    };
    
    // Helper to write data to MongoDB
    const writeData = async (key, data) => {
        try {
            const serialized = JSON.stringify(data, BufferJSON.replacer);
            await collection.updateOne(
                { connectionId, key },
                { 
                    $set: { 
                        connectionId,
                        key, 
                        data: serialized,
                        updatedAt: new Date()
                    } 
                },
                { upsert: true }
            );
        } catch (error) {
            console.error(`[${connectionId}] Erro ao salvar ${key}:`, error.message);
        }
    };
    
    // Helper to remove data from MongoDB
    const removeData = async (key) => {
        try {
            await collection.deleteOne({ connectionId, key });
        } catch (error) {
            console.error(`[${connectionId}] Erro ao remover ${key}:`, error.message);
        }
    };
    
    // Load credentials
    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
    }
    
    // Load keys
    const keys = {};
    
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const key = `${type}-${id}`;
                        let value = keys[key];
                        if (!value) {
                            value = await readData(key);
                            if (value) {
                                keys[key] = value;
                            }
                        }
                        if (value) {
                            data[id] = value;
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const key = `${category}-${id}`;
                            const value = data[category][id];
                            if (value) {
                                keys[key] = value;
                                tasks.push(writeData(key, value));
                            } else {
                                delete keys[key];
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', creds);
        }
    };
}

// Delete session from MongoDB
async function deleteMongoSession(connectionId) {
    const database = await connectMongo();
    if (database) {
        try {
            await database.collection('whatsapp_sessions').deleteMany({ connectionId });
            console.log(`[${connectionId}] Sessão removida do MongoDB`);
        } catch (error) {
            console.error(`[${connectionId}] Erro ao remover sessão:`, error.message);
        }
    }
    
    // Also try to remove from filesystem
    const sessionPath = path.join(AUTH_DIR, connectionId);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
    }
}

// Check if session exists in MongoDB
async function sessionExistsInMongo(connectionId) {
    const database = await connectMongo();
    if (!database) return false;
    
    try {
        const doc = await database.collection('whatsapp_sessions').findOne({ 
            connectionId, 
            key: 'creds' 
        });
        return !!doc;
    } catch (error) {
        return false;
    }
}

// Check if connection is truly alive by trying to fetch profile
async function isConnectionAlive(connectionId) {
    const conn = connections.get(connectionId);
    if (!conn || !conn.socket) return false;
    
    try {
        // Try to get own status - this will fail if connection is dead
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), CONNECTION_TIMEOUT)
        );
        
        const checkPromise = conn.socket.fetchStatus(conn.socket.user?.id);
        
        await Promise.race([checkPromise, timeoutPromise]);
        return true;
    } catch (error) {
        console.log(`[${connectionId}] Conexão parece estar morta: ${error.message}`);
        return false;
    }
}

// Keep-alive checker for all connections
async function keepAliveCheck() {
    for (const [connectionId, conn] of connections.entries()) {
        if (conn.status === 'connected') {
            const alive = await isConnectionAlive(connectionId);
            
            if (!alive) {
                console.log(`[${connectionId}] Keep-alive falhou, reconectando...`);
                conn.status = 'reconnecting';
                conn.lastKeepAliveFail = Date.now();
                
                // Try to close gracefully
                try {
                    conn.socket?.end();
                } catch (e) {}
                
                // Reconnect
                try {
                    await createConnection(connectionId);
                } catch (error) {
                    console.error(`[${connectionId}] Falha ao reconectar:`, error.message);
                    conn.status = 'disconnected';
                }
            } else {
                conn.lastKeepAliveSuccess = Date.now();
            }
        }
    }
}

// Start keep-alive checker
setInterval(keepAliveCheck, KEEPALIVE_INTERVAL);

async function createConnection(connectionId) {
    // Clean up existing connection if any
    const existingConn = connections.get(connectionId);
    if (existingConn?.socket) {
        try {
            existingConn.socket.end();
        } catch (e) {}
    }

    try {
        // Use MongoDB auth state
        const { state, saveCreds } = await useMongoAuthState(connectionId);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: ['Nexus Campaign', 'Chrome', '121.0.0'],
            connectTimeoutMs: 60000,
            qrTimeout: 60000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 2000,
        });

        const connectionData = {
            socket: sock,
            qrCode: null,
            qrImage: null,
            status: 'connecting',
            phoneNumber: null,
            groups: [],
            saveCreds,
            retryCount: 0,
            createdAt: Date.now(),
            lastKeepAliveSuccess: null,
            lastKeepAliveFail: null,
        };

        connections.set(connectionId, connectionData);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const conn = connections.get(connectionId);
            
            if (!conn) return;

            if (qr) {
                conn.qrCode = qr;
                conn.status = 'waiting_qr';
                conn.retryCount = 0;
                try {
                    conn.qrImage = await QRCode.toDataURL(qr, { 
                        width: 280, 
                        margin: 2,
                        color: { dark: '#000000', light: '#FFFFFF' }
                    });
                    console.log(`[${connectionId}] QR Code gerado com sucesso`);
                } catch (err) {
                    console.error('Erro ao gerar QR:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`[${connectionId}] Conexão fechada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);
                
                if (shouldReconnect && conn.status !== 'deleted' && conn.retryCount < 5) {
                    conn.retryCount++;
                    conn.status = 'reconnecting';
                    const delay = Math.min(3000 * conn.retryCount, 15000);
                    console.log(`[${connectionId}] Tentando reconectar em ${delay}ms (tentativa ${conn.retryCount})`);
                    
                    setTimeout(async () => {
                        if (connections.has(connectionId) && connections.get(connectionId).status !== 'deleted') {
                            try {
                                await createConnection(connectionId);
                            } catch (error) {
                                console.error(`[${connectionId}] Erro na reconexão:`, error.message);
                            }
                        }
                    }, delay);
                } else {
                    conn.status = 'disconnected';
                    conn.qrCode = null;
                    conn.qrImage = null;
                }
            } else if (connection === 'open') {
                conn.status = 'connected';
                conn.qrCode = null;
                conn.qrImage = null;
                conn.retryCount = 0;
                conn.lastKeepAliveSuccess = Date.now();
                conn.phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
                console.log(`[${connectionId}] WhatsApp conectado: ${conn.phoneNumber}`);
                
                // Fetch groups after connection
                setTimeout(() => fetchGroups(connectionId), 2000);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        return connectionData;
    } catch (error) {
        console.error(`[${connectionId}] Erro ao criar conexão:`, error);
        const conn = connections.get(connectionId);
        if (conn) {
            conn.status = 'error';
            conn.error = error.message;
        }
        throw error;
    }
}

async function fetchGroups(connectionId) {
    const conn = connections.get(connectionId);
    if (!conn || conn.status !== 'connected') {
        console.log(`[${connectionId}] Não é possível buscar grupos - status: ${conn?.status}`);
        return [];
    }

    // First check if connection is really alive
    const alive = await isConnectionAlive(connectionId);
    if (!alive) {
        console.log(`[${connectionId}] Conexão morta detectada ao buscar grupos, reconectando...`);
        conn.status = 'reconnecting';
        
        try {
            conn.socket?.end();
        } catch (e) {}
        
        setTimeout(() => createConnection(connectionId), 1000);
        return [];
    }

    try {
        console.log(`[${connectionId}] Buscando grupos...`);
        const groups = await conn.socket.groupFetchAllParticipating();
        conn.groups = Object.values(groups).map(group => ({
            id: group.id,
            name: group.subject,
            participants_count: group.participants?.length || 0,
            creation: group.creation,
            owner: group.owner
        }));
        console.log(`[${connectionId}] ${conn.groups.length} grupos sincronizados`);
        return conn.groups;
    } catch (error) {
        console.error(`[${connectionId}] Erro ao buscar grupos:`, error.message);
        
        if (error.message?.includes('timeout') || error.message?.includes('closed')) {
            console.log(`[${connectionId}] Conexão perdida, tentando reconectar...`);
            conn.status = 'reconnecting';
            setTimeout(() => createConnection(connectionId), 1000);
        }
        
        return [];
    }
}

async function sendMessageToGroup(connectionId, groupId, message, imageBuffer = null, caption = null) {
    const conn = connections.get(connectionId);
    if (!conn) {
        throw new Error('Conexão não encontrada');
    }
    
    if (conn.status !== 'connected') {
        throw new Error(`Conexão não está ativa (status: ${conn.status})`);
    }

    // Check if connection is really alive before sending
    const alive = await isConnectionAlive(connectionId);
    if (!alive) {
        console.log(`[${connectionId}] Conexão morta detectada antes de enviar, reconectando...`);
        conn.status = 'reconnecting';
        
        try {
            conn.socket?.end();
        } catch (e) {}
        
        setTimeout(() => createConnection(connectionId), 1000);
        throw new Error('Conexão perdida, reconectando automaticamente. Tente novamente em alguns segundos.');
    }

    try {
        const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
        
        console.log(`[${connectionId}] Enviando mensagem para ${jid}...`);
        
        let result;
        if (imageBuffer) {
            result = await conn.socket.sendMessage(jid, {
                image: imageBuffer,
                caption: caption || undefined
            });
        } else if (message) {
            result = await conn.socket.sendMessage(jid, { text: message });
        } else {
            throw new Error('Mensagem ou imagem é obrigatória');
        }
        
        if (!result || !result.key) {
            console.error(`[${connectionId}] Resultado inesperado do envio:`, result);
            throw new Error('Falha ao enviar mensagem - resposta inválida');
        }
        
        console.log(`[${connectionId}] ✓ Mensagem enviada para ${jid} (ID: ${result.key.id})`);
        return { success: true, messageId: result.key.id };
    } catch (error) {
        console.error(`[${connectionId}] ✗ Erro ao enviar para ${groupId}:`, error.message);
        
        if (error.message?.includes('timeout') || error.message?.includes('closed') || error.message?.includes('not open')) {
            conn.status = 'reconnecting';
            setTimeout(() => createConnection(connectionId), 1000);
        }
        
        throw error;
    }
}

// API Routes

app.get('/connections/:id/status', async (req, res) => {
    const conn = connections.get(req.params.id);
    if (!conn) {
        return res.json({ status: 'not_found' });
    }
    
    let reallyConnected = conn.status === 'connected';
    if (reallyConnected && req.query.verify === 'true') {
        reallyConnected = await isConnectionAlive(req.params.id);
        if (!reallyConnected) {
            conn.status = 'reconnecting';
            setTimeout(() => createConnection(req.params.id), 1000);
        }
    }
    
    res.json({
        status: conn.status,
        phoneNumber: conn.phoneNumber,
        groupsCount: conn.groups.length,
        hasQR: !!conn.qrImage,
        lastKeepAliveSuccess: conn.lastKeepAliveSuccess,
        lastKeepAliveFail: conn.lastKeepAliveFail,
        uptime: conn.createdAt ? Date.now() - conn.createdAt : 0
    });
});

app.post('/connections/:id/start', async (req, res) => {
    try {
        const connectionId = req.params.id;
        
        if (connections.has(connectionId)) {
            const existing = connections.get(connectionId);
            if (existing.status === 'connected') {
                const alive = await isConnectionAlive(connectionId);
                if (alive) {
                    return res.json({ status: 'already_connected', phoneNumber: existing.phoneNumber });
                } else {
                    console.log(`[${connectionId}] Status era 'connected' mas conexão está morta`);
                }
            }
            if (existing.status === 'connecting' || existing.status === 'waiting_qr') {
                return res.json({ status: existing.status, message: 'Conexão em andamento' });
            }
            try {
                existing.socket?.end();
            } catch (e) {}
        }
        
        await createConnection(connectionId);
        res.json({ status: 'connecting', message: 'Aguarde o QR Code' });
    } catch (error) {
        console.error('Erro ao iniciar:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/connections/:id/qr', (req, res) => {
    const conn = connections.get(req.params.id);
    if (!conn) {
        return res.json({ qr: null, qrImage: null, status: 'not_found' });
    }
    res.json({ 
        qr: conn.qrCode,
        qrImage: conn.qrImage,
        status: conn.status,
        phoneNumber: conn.phoneNumber
    });
});

app.get('/connections/:id/groups', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (!conn) {
        return res.json({ groups: [], status: 'not_found' });
    }
    
    if (conn.status !== 'connected') {
        return res.json({ groups: conn.groups || [], status: conn.status });
    }
    
    if (req.query.refresh === 'true' || conn.groups.length === 0) {
        await fetchGroups(connectionId);
    }
    
    res.json({ groups: conn.groups, status: conn.status });
});

app.post('/connections/:id/sync-groups', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (!conn) {
        return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    if (conn.status !== 'connected') {
        return res.status(400).json({ error: `Conexão não está ativa (status: ${conn.status})` });
    }
    
    const groups = await fetchGroups(connectionId);
    res.json({ groups, count: groups.length, status: conn.status });
});

app.post('/connections/:id/send', async (req, res) => {
    try {
        const { groupId, message, imageBase64, caption } = req.body;
        
        if (!groupId) {
            return res.status(400).json({ success: false, error: 'groupId é obrigatório' });
        }
        
        let imageBuffer = null;
        if (imageBase64) {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
        }
        
        const result = await sendMessageToGroup(req.params.id, groupId, message, imageBuffer, caption);
        res.json(result);
    } catch (error) {
        console.error('Erro no endpoint /send:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/connections/:id/disconnect', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (conn) {
        try {
            await conn.socket.logout();
        } catch (e) {}
        conn.status = 'disconnected';
        connections.delete(connectionId);
        
        // Delete from MongoDB
        await deleteMongoSession(connectionId);
    }
    
    res.json({ status: 'disconnected' });
});

app.delete('/connections/:id', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (conn) {
        conn.status = 'deleted';
        try {
            await conn.socket.logout();
        } catch (e) {}
        connections.delete(connectionId);
    }
    
    // Delete from MongoDB
    await deleteMongoSession(connectionId);
    
    res.json({ status: 'deleted' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connections: connections.size });
});

app.get('/connections', (req, res) => {
    const list = [];
    connections.forEach((conn, id) => {
        list.push({
            id,
            status: conn.status,
            phoneNumber: conn.phoneNumber,
            groupsCount: conn.groups.length,
            hasQR: !!conn.qrImage,
            lastKeepAliveSuccess: conn.lastKeepAliveSuccess,
            uptime: conn.createdAt ? Date.now() - conn.createdAt : 0
        });
    });
    res.json(list);
});

app.post('/connections/:id/reconnect', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (!conn) {
        return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    console.log(`[${connectionId}] Forçando reconexão...`);
    
    try {
        conn.socket?.end();
    } catch (e) {}
    
    try {
        await createConnection(connectionId);
        res.json({ status: 'reconnecting', message: 'Reconexão iniciada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-reconnect existing sessions on startup
async function autoReconnectSessions() {
    console.log('Verificando sessões existentes para reconexão automática...');
    
    // First check MongoDB for sessions
    const database = await connectMongo();
    if (database) {
        try {
            const sessions = await database.collection('whatsapp_sessions')
                .distinct('connectionId', { key: 'creds' });
            
            console.log(`Encontradas ${sessions.length} sessão(ões) no MongoDB para reconectar.`);
            
            for (const sessionId of sessions) {
                console.log(`Reconectando sessão do MongoDB: ${sessionId}`);
                try {
                    await createConnection(sessionId);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`Erro ao reconectar ${sessionId}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Erro ao buscar sessões do MongoDB:', error.message);
        }
    }
    
    // Also check filesystem for legacy sessions
    try {
        if (fs.existsSync(AUTH_DIR)) {
            const fileSessions = fs.readdirSync(AUTH_DIR).filter(dir => {
                const sessionPath = path.join(AUTH_DIR, dir);
                return fs.statSync(sessionPath).isDirectory();
            });
            
            for (const sessionId of fileSessions) {
                // Skip if already connected from MongoDB
                if (connections.has(sessionId)) continue;
                
                const sessionPath = path.join(AUTH_DIR, sessionId);
                const credsFile = path.join(sessionPath, 'creds.json');
                
                if (fs.existsSync(credsFile)) {
                    console.log(`Reconectando sessão do filesystem: ${sessionId}`);
                    try {
                        await createConnection(sessionId);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        console.error(`Erro ao reconectar ${sessionId}:`, error.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erro ao verificar sessões do filesystem:', error.message);
    }
    
    console.log('Reconexão automática concluída.');
}

app.listen(PORT, async () => {
    console.log(`Serviço WhatsApp rodando na porta ${PORT}`);
    console.log(`Keep-alive configurado para verificar a cada ${KEEPALIVE_INTERVAL/1000}s`);
    console.log(`Sessões serão persistidas no MongoDB: ${MONGO_URL}`);
    
    // Connect to MongoDB first
    await connectMongo();
    
    // Auto-reconnect after a short delay to ensure server is ready
    setTimeout(autoReconnectSessions, 3000);
});
