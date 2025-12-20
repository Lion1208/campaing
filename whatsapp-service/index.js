const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const logger = pino({ level: 'warn' });
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

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
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
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
        });

        const connectionData = {
            socket: sock,
            qrCode: null,
            qrImage: null,
            status: 'connecting',
            phoneNumber: null,
            groups: [],
            saveCreds,
            retryCount: 0
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
                    setTimeout(() => {
                        if (connections.has(connectionId) && connections.get(connectionId).status !== 'deleted') {
                            createConnection(connectionId);
                        }
                    }, 3000 * conn.retryCount);
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
        console.log(`[${connectionId}] ${conn.groups.length} grupos sincronizados`);
        return conn.groups;
    } catch (error) {
        console.error(`[${connectionId}] Erro ao buscar grupos:`, error);
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
            await conn.socket.sendMessage(jid, {
                image: imageBuffer,
                caption: caption || undefined
            });
        } else if (message) {
            await conn.socket.sendMessage(jid, { text: message });
        }
        
        console.log(`[${connectionId}] Mensagem enviada para ${jid}`);
        return { success: true };
    } catch (error) {
        console.error(`[${connectionId}] Erro ao enviar:`, error);
        throw error;
    }
}

// API Routes

app.get('/connections/:id/status', (req, res) => {
    const conn = connections.get(req.params.id);
    if (!conn) {
        return res.json({ status: 'not_found' });
    }
    res.json({
        status: conn.status,
        phoneNumber: conn.phoneNumber,
        groupsCount: conn.groups.length,
        hasQR: !!conn.qrImage
    });
});

app.post('/connections/:id/start', async (req, res) => {
    try {
        const connectionId = req.params.id;
        
        // Stop existing connection if any
        if (connections.has(connectionId)) {
            const existing = connections.get(connectionId);
            if (existing.status === 'connected') {
                return res.json({ status: 'already_connected', phoneNumber: existing.phoneNumber });
            }
            // Close existing socket
            try {
                existing.socket?.end();
            } catch (e) {}
            connections.delete(connectionId);
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
    
    if (!conn || conn.status !== 'connected') {
        return res.json({ groups: [], status: conn?.status || 'not_found' });
    }
    
    if (req.query.refresh === 'true') {
        await fetchGroups(connectionId);
    }
    
    res.json({ groups: conn.groups, status: conn.status });
});

app.post('/connections/:id/send', async (req, res) => {
    try {
        const { groupId, message, imageBase64, caption } = req.body;
        
        let imageBuffer = null;
        if (imageBase64) {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
        }
        
        await sendMessageToGroup(req.params.id, groupId, message, imageBuffer, caption);
        res.json({ success: true });
    } catch (error) {
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
        
        const sessionPath = path.join(AUTH_DIR, connectionId);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true });
        }
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
    
    const sessionPath = path.join(AUTH_DIR, connectionId);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true });
    }
    
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
            hasQR: !!conn.qrImage
        });
    });
    res.json(list);
});

// Auto-reconnect existing sessions on startup
async function autoReconnectSessions() {
    console.log('Verificando sessões existentes para reconexão automática...');
    
    try {
        if (!fs.existsSync(AUTH_DIR)) {
            console.log('Nenhuma pasta de sessões encontrada.');
            return;
        }
        
        const sessions = fs.readdirSync(AUTH_DIR).filter(dir => {
            const sessionPath = path.join(AUTH_DIR, dir);
            return fs.statSync(sessionPath).isDirectory();
        });
        
        console.log(`Encontradas ${sessions.length} sessão(ões) para reconectar.`);
        
        for (const sessionId of sessions) {
            const sessionPath = path.join(AUTH_DIR, sessionId);
            const credsFile = path.join(sessionPath, 'creds.json');
            
            // Only reconnect if credentials exist (was previously authenticated)
            if (fs.existsSync(credsFile)) {
                console.log(`Reconectando sessão: ${sessionId}`);
                try {
                    await createConnection(sessionId);
                    // Wait a bit between connections to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`Erro ao reconectar ${sessionId}:`, error.message);
                }
            } else {
                console.log(`Sessão ${sessionId} não possui credenciais, pulando.`);
            }
        }
        
        console.log('Reconexão automática concluída.');
    } catch (error) {
        console.error('Erro na reconexão automática:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Serviço WhatsApp rodando na porta ${PORT}`);
    
    // Auto-reconnect after a short delay to ensure server is ready
    setTimeout(autoReconnectSessions, 3000);
});
