const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json());

const logger = pino({ level: 'info' });
const PORT = process.env.WHATSAPP_PORT || 3002;
const AUTH_DIR = path.join(__dirname, 'auth_sessions');

// Store active connections
const connections = new Map();

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

async function createConnection(connectionId) {
    const sessionPath = path.join(AUTH_DIR, connectionId);
    
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Nexus WhatsApp', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
    });

    const connectionData = {
        socket: sock,
        qrCode: null,
        qrImage: null,
        status: 'connecting',
        phoneNumber: null,
        groups: [],
        saveCreds
    };

    connections.set(connectionId, connectionData);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const conn = connections.get(connectionId);
        
        if (!conn) return;

        if (qr) {
            conn.qrCode = qr;
            conn.status = 'waiting_qr';
            // Generate QR as base64 image
            try {
                conn.qrImage = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            } catch (err) {
                logger.error('QR generation error:', err);
            }
            logger.info(`[${connectionId}] QR Code gerado`);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.info(`[${connectionId}] Conexão fechada. Reconectar: ${shouldReconnect}`);
            
            conn.status = 'disconnected';
            conn.qrCode = null;
            conn.qrImage = null;
            
            if (shouldReconnect && conn.status !== 'deleted') {
                setTimeout(() => {
                    if (connections.has(connectionId)) {
                        createConnection(connectionId);
                    }
                }, 5000);
            }
        } else if (connection === 'open') {
            conn.status = 'connected';
            conn.qrCode = null;
            conn.qrImage = null;
            conn.phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id;
            logger.info(`[${connectionId}] Conectado: ${conn.phoneNumber}`);
            
            // Fetch groups after connection
            await fetchGroups(connectionId);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    return connectionData;
}

async function fetchGroups(connectionId) {
    const conn = connections.get(connectionId);
    if (!conn || conn.status !== 'connected') return [];

    try {
        const groups = await conn.socket.groupFetchAllParticipating();
        conn.groups = Object.values(groups).map(group => ({
            id: group.id,
            name: group.subject,
            participants_count: group.participants?.length || 0,
            creation: group.creation,
            owner: group.owner
        }));
        logger.info(`[${connectionId}] ${conn.groups.length} grupos encontrados`);
        return conn.groups;
    } catch (error) {
        logger.error(`[${connectionId}] Erro ao buscar grupos:`, error);
        return [];
    }
}

async function sendMessageToGroup(connectionId, groupId, message, imageBuffer = null, caption = null) {
    const conn = connections.get(connectionId);
    if (!conn || conn.status !== 'connected') {
        throw new Error('Conexão não está ativa');
    }

    try {
        const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
        
        if (imageBuffer) {
            // Send image with optional caption
            await conn.socket.sendMessage(jid, {
                image: imageBuffer,
                caption: caption || undefined
            });
        } else if (message) {
            // Send text only
            await conn.socket.sendMessage(jid, { text: message });
        }
        
        logger.info(`[${connectionId}] Mensagem enviada para ${jid}`);
        return { success: true };
    } catch (error) {
        logger.error(`[${connectionId}] Erro ao enviar mensagem:`, error);
        throw error;
    }
}

// API Routes

// Get connection status
app.get('/connections/:id/status', (req, res) => {
    const conn = connections.get(req.params.id);
    if (!conn) {
        return res.json({ status: 'not_found' });
    }
    res.json({
        status: conn.status,
        phoneNumber: conn.phoneNumber,
        groupsCount: conn.groups.length
    });
});

// Start/initialize connection
app.post('/connections/:id/start', async (req, res) => {
    try {
        const connectionId = req.params.id;
        
        if (connections.has(connectionId)) {
            const existing = connections.get(connectionId);
            if (existing.status === 'connected') {
                return res.json({ status: 'already_connected', phoneNumber: existing.phoneNumber });
            }
        }
        
        await createConnection(connectionId);
        res.json({ status: 'connecting' });
    } catch (error) {
        logger.error('Erro ao iniciar conexão:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get QR Code
app.get('/connections/:id/qr', (req, res) => {
    const conn = connections.get(req.params.id);
    if (!conn) {
        return res.json({ qr: null, status: 'not_found' });
    }
    res.json({ 
        qr: conn.qrCode,
        qrImage: conn.qrImage,
        status: conn.status 
    });
});

// Get groups
app.get('/connections/:id/groups', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (!conn || conn.status !== 'connected') {
        return res.json({ groups: [], status: conn?.status || 'not_found' });
    }
    
    // Refresh groups if requested
    if (req.query.refresh === 'true') {
        await fetchGroups(connectionId);
    }
    
    res.json({ groups: conn.groups, status: conn.status });
});

// Send message
app.post('/connections/:id/send', async (req, res) => {
    try {
        const { groupId, message, imageBase64, caption } = req.body;
        
        let imageBuffer = null;
        if (imageBase64) {
            // Remove data URL prefix if present
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
        }
        
        await sendMessageToGroup(req.params.id, groupId, message, imageBuffer, caption);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Disconnect
app.post('/connections/:id/disconnect', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (conn) {
        try {
            await conn.socket.logout();
        } catch (e) {
            // Ignore logout errors
        }
        conn.status = 'disconnected';
        connections.delete(connectionId);
        
        // Remove session files
        const sessionPath = path.join(AUTH_DIR, connectionId);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true });
        }
    }
    
    res.json({ status: 'disconnected' });
});

// Delete connection completely
app.delete('/connections/:id', async (req, res) => {
    const connectionId = req.params.id;
    const conn = connections.get(connectionId);
    
    if (conn) {
        conn.status = 'deleted';
        try {
            await conn.socket.logout();
        } catch (e) {
            // Ignore
        }
        connections.delete(connectionId);
    }
    
    // Remove session files
    const sessionPath = path.join(AUTH_DIR, connectionId);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
    }
    
    res.json({ status: 'deleted' });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', connections: connections.size });
});

// List all connections
app.get('/connections', (req, res) => {
    const list = [];
    connections.forEach((conn, id) => {
        list.push({
            id,
            status: conn.status,
            phoneNumber: conn.phoneNumber,
            groupsCount: conn.groups.length
        });
    });
    res.json(list);
});

app.listen(PORT, () => {
    logger.info(`Serviço WhatsApp rodando na porta ${PORT}`);
});
