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
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

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

// Cache da versão do Baileys para evitar requisições desnecessárias
let cachedBaileysVersion = null;
let baileysVersionCacheTime = 0;
const BAILEYS_VERSION_CACHE_TTL = 3600000; // 1 hora

// Função otimizada para obter versão do Baileys com cache e fallback
async function getBaileysVersion() {
    const now = Date.now();
    
    // Se tem cache válido, usa
    if (cachedBaileysVersion && (now - baileysVersionCacheTime) < BAILEYS_VERSION_CACHE_TTL) {
        console.log(`[DEBUG] Usando versão cacheada do Baileys: ${cachedBaileysVersion.join('.')}`);
        return { version: cachedBaileysVersion };
    }
    
    try {
        // Tenta buscar versão mais recente com timeout curto
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const fetchPromise = fetchLatestBaileysVersion();
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        
        cachedBaileysVersion = result.version;
        baileysVersionCacheTime = now;
        console.log(`[DEBUG] Versão do Baileys atualizada: ${result.version.join('.')}`);
        return result;
    } catch (error) {
        console.warn(`[DEBUG] Falha ao buscar versão do Baileys: ${error.message}. Usando versão padrão.`);
        // Fallback para versão conhecida que funciona
        const fallbackVersion = [2, 3000, 1015901307];
        return { version: cachedBaileysVersion || fallbackVersion };
    }
}

// ============= BLINDAGEM TOTAL DO SERVIÇO =============
// Service will NEVER crash - all errors are caught and handled

// Global error handlers - prevent ANY crash
process.on('uncaughtException', (error) => {
    console.error('🛡️ [BLINDAGEM] Erro não capturado interceptado:', error.message);
    console.error(error.stack);
    // Service continues running - DO NOT exit
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🛡️ [BLINDAGEM] Promise rejeitada interceptada:', reason);
    // Service continues running - DO NOT exit
});

process.on('SIGTERM', () => {
    console.log('🛡️ [BLINDAGEM] Recebido SIGTERM - ignorando para manter serviço ativo');
    // Don't exit - supervisor will restart if needed
});

process.on('SIGINT', () => {
    console.log('🛡️ [BLINDAGEM] Recebido SIGINT - ignorando para manter serviço ativo');
    // Don't exit - supervisor will restart if needed
});

// MongoDB client
let mongoClient = null;
let db = null;
let mongoReconnectAttempts = 0;
const MAX_MONGO_RECONNECT_DELAY = 30000; // Max 30 seconds between reconnects

// Store active connections
const connections = new Map();

// Keep-alive interval (check every 30 seconds)
const KEEPALIVE_INTERVAL = 30000;
// Connection timeout (if no response in 10 seconds, consider dead)
const CONNECTION_TIMEOUT = 10000;
// Max retries for any operation
const MAX_OPERATION_RETRIES = 5;
// Service health tracking
let lastHealthCheck = Date.now();
let totalMessagesProcessed = 0;
let totalErrors = 0;

// Ensure auth directory exists (fallback)
try {
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
} catch (e) {
    console.error('🛡️ [BLINDAGEM] Erro ao criar diretório auth:', e.message);
}

// ============= SAFE WRAPPER FOR ALL ASYNC OPERATIONS =============
async function safeAsync(fn, fallback = null, context = 'operação') {
    try {
        return await fn();
    } catch (error) {
        console.error(`🛡️ [BLINDAGEM] Erro em ${context}:`, error.message);
        totalErrors++;
        return fallback;
    }
}

// Connect to MongoDB with auto-reconnect
async function connectMongo() {
    if (mongoClient && db) {
        try {
            // Ping to verify connection is alive
            await db.command({ ping: 1 });
            return db;
        } catch (e) {
            console.log('🛡️ [BLINDAGEM] MongoDB ping falhou, reconectando...');
            mongoClient = null;
            db = null;
        }
    }
    
    const reconnectWithBackoff = async () => {
        const delay = Math.min(1000 * Math.pow(2, mongoReconnectAttempts), MAX_MONGO_RECONNECT_DELAY);
        mongoReconnectAttempts++;
        
        try {
            console.log(`🛡️ [BLINDAGEM] Tentando conectar MongoDB (tentativa ${mongoReconnectAttempts})...`);
            mongoClient = new MongoClient(MONGO_URL, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 30000,
            });
            await mongoClient.connect();
            db = mongoClient.db(DB_NAME);
            
            // Setup connection monitoring
            mongoClient.on('close', () => {
                console.log('🛡️ [BLINDAGEM] MongoDB conexão fechada, tentando reconectar...');
                db = null;
                setTimeout(connectMongo, 3000);
            });
            
            mongoClient.on('error', (err) => {
                console.error('🛡️ [BLINDAGEM] MongoDB erro:', err.message);
            });
            
            console.log('✅ MongoDB conectado para sessões WhatsApp');
            mongoReconnectAttempts = 0; // Reset on success
            return db;
        } catch (error) {
            console.error(`🛡️ [BLINDAGEM] Erro ao conectar MongoDB (tentativa ${mongoReconnectAttempts}):`, error.message);
            
            // Schedule next reconnect attempt
            console.log(`🛡️ [BLINDAGEM] Próxima tentativa em ${delay/1000}s...`);
            setTimeout(connectMongo, delay);
            return null;
        }
    };
    
    return await reconnectWithBackoff();
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
        try {
            if (conn.status === 'connected') {
                const alive = await safeAsync(
                    () => isConnectionAlive(connectionId),
                    false,
                    `keepAlive-${connectionId}`
                );
                
                if (!alive) {
                    console.log(`🛡️ [BLINDAGEM] Keep-alive falhou para ${connectionId}, reconectando...`);
                    conn.status = 'reconnecting';
                    conn.lastKeepAliveFail = Date.now();
                    
                    // Try to close gracefully
                    try {
                        conn.socket?.end();
                    } catch (e) {}
                    
                    // Reconnect
                    await safeAsync(
                        () => createConnection(connectionId),
                        null,
                        `reconnect-${connectionId}`
                    );
                } else {
                    conn.lastKeepAliveSuccess = Date.now();
                }
            } else if (conn.status === 'disconnected' || conn.status === 'error') {
                // Try to auto-reconnect disconnected connections if session exists
                const hasSession = await safeAsync(
                    () => sessionExistsInMongo(connectionId),
                    false,
                    `checkSession-${connectionId}`
                );
                
                if (hasSession) {
                    console.log(`🛡️ [BLINDAGEM] Reconectando sessão existente: ${connectionId}`);
                    await safeAsync(
                        () => createConnection(connectionId),
                        null,
                        `autoReconnect-${connectionId}`
                    );
                }
            }
        } catch (error) {
            console.error(`🛡️ [BLINDAGEM] Erro no keepAlive para ${connectionId}:`, error.message);
        }
    }
}

// Watchdog - verifica saúde geral do serviço e tenta recuperar
async function serviceWatchdog() {
    try {
        // Check MongoDB connection
        if (!db) {
            console.log('🛡️ [WATCHDOG] MongoDB desconectado, tentando reconectar...');
            await connectMongo();
        }
        
        // Check if we have any dead connections that should be alive
        for (const [connectionId, conn] of connections.entries()) {
            if (conn.status === 'reconnecting' && conn.lastKeepAliveFail) {
                const timeSinceFailure = Date.now() - conn.lastKeepAliveFail;
                
                // If stuck in reconnecting for more than 2 minutes, force restart
                if (timeSinceFailure > 120000) {
                    console.log(`🛡️ [WATCHDOG] Conexão ${connectionId} travada em 'reconnecting' há ${timeSinceFailure/1000}s, forçando reinício...`);
                    
                    try {
                        conn.socket?.end();
                    } catch (e) {}
                    
                    connections.delete(connectionId);
                    
                    // Try to recreate
                    await safeAsync(
                        () => createConnection(connectionId),
                        null,
                        `watchdog-recreate-${connectionId}`
                    );
                }
            }
        }
        
        // Memory check - if using too much memory, cleanup old data
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > 500 * 1024 * 1024) { // > 500MB
            console.log('🛡️ [WATCHDOG] Uso de memória alto, executando garbage collection...');
            if (global.gc) {
                global.gc();
            }
        }
        
    } catch (error) {
        console.error('🛡️ [WATCHDOG] Erro no watchdog:', error.message);
    }
}

// Start keep-alive checker
setInterval(keepAliveCheck, KEEPALIVE_INTERVAL);

// Start watchdog (every 60 seconds)
setInterval(serviceWatchdog, 60000);

async function createConnection(connectionId) {
    console.log(`[DEBUG] createConnection(${connectionId}) iniciado`);
    
    // Clean up existing connection if any
    const existingConn = connections.get(connectionId);
    if (existingConn?.socket) {
        console.log(`[DEBUG] Limpando conexão existente para ${connectionId}`);
        try {
            existingConn.socket.end();
        } catch (e) {
            console.log(`[DEBUG] Erro ao limpar conexão: ${e.message}`);
        }
    }

    try {
        console.log(`[DEBUG] Obtendo estado de autenticação do MongoDB...`);
        // Use MongoDB auth state
        const { state, saveCreds } = await useMongoAuthState(connectionId);
        console.log(`[DEBUG] Estado obtido. Creds existente: ${state.creds ? 'sim' : 'não'}`);
        
        console.log(`[DEBUG] Obtendo versão do Baileys (com cache)...`);
        const { version } = await getBaileysVersion();
        console.log(`[DEBUG] Versão do Baileys: ${version.join('.')}`);
        
        console.log(`[DEBUG] Criando socket WhatsApp...`);
        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: ['Ubuntu', 'Chrome', '114.0.5735.198'], // Config compatível com QR e Pairing
            connectTimeoutMs: 60000,
            qrTimeout: 60000,
            defaultQueryTimeoutMs: 60000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 2000,
            // Adiciona retry automático
            msgRetryCounterMap: {},
            maxMsgRetryCount: 5,
        });
        console.log(`[DEBUG] Socket criado com sucesso`);

        const connectionData = {
            socket: sock,
            qrCode: null,
            qrImage: null,
            pairingCode: null,
            status: 'connecting',
            phoneNumber: null,
            groups: [],
            saveCreds,
            retryCount: 0,
            maxRetries: 10,
            createdAt: Date.now(),
            lastKeepAliveSuccess: null,
            lastKeepAliveFail: null,
            lastError: null,
        };

        connections.set(connectionId, connectionData);
        console.log(`[DEBUG] Conexão ${connectionId} adicionada ao Map. Total de conexões: ${connections.size}`);

        sock.ev.on('connection.update', async (update) => {
            try {
                const { connection, lastDisconnect, qr } = update;
                const conn = connections.get(connectionId);
                
                console.log(`[DEBUG] connection.update para ${connectionId}:`, { connection, hasQR: !!qr });
                
                if (!conn) {
                    console.log(`[DEBUG] Conexão ${connectionId} não encontrada no update handler!`);
                    return;
                }

                if (qr) {
                    console.log(`[DEBUG] QR Code recebido para ${connectionId}. Gerando imagem...`);
                    conn.qrCode = qr;
                    conn.status = 'waiting_qr';
                    conn.retryCount = 0;
                    try {
                        conn.qrImage = await QRCode.toDataURL(qr, { 
                            width: 280, 
                            margin: 2,
                            color: { dark: '#000000', light: '#FFFFFF' }
                        });
                        console.log(`[DEBUG] [${connectionId}] QR Code gerado com sucesso. Tamanho: ${conn.qrImage?.length || 0} chars`);
                    } catch (err) {
                        console.error(`[DEBUG] Erro ao gerar QR Code:`, err.message);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const errorMsg = lastDisconnect?.error?.message || 'Unknown error';
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    conn.lastError = errorMsg;
                    console.log(`[DEBUG] [${connectionId}] Conexão fechada. Código: ${statusCode}. Erro: ${errorMsg}. Reconectar: ${shouldReconnect}`);
                    
                    // Sempre tenta reconectar exceto se foi logout explícito
                    if (shouldReconnect && conn.status !== 'deleted') {
                        conn.retryCount++;
                        conn.status = 'reconnecting';
                        
                        // Backoff exponencial com limite
                        const delay = Math.min(3000 * Math.pow(1.5, conn.retryCount - 1), 60000);
                        console.log(`🛡️ [${connectionId}] Tentando reconectar em ${delay/1000}s (tentativa ${conn.retryCount})`);
                        
                        setTimeout(async () => {
                            const currentConn = connections.get(connectionId);
                            if (currentConn && currentConn.status !== 'deleted') {
                                try {
                                    await createConnection(connectionId);
                                } catch (error) {
                                    console.error(`🛡️ [${connectionId}] Erro na reconexão:`, error.message);
                                    // Agenda próxima tentativa mesmo com erro
                                    currentConn.status = 'disconnected';
                                    currentConn.lastError = error.message;
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
                    conn.lastError = null;
                    conn.phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
                    console.log(`✅ [${connectionId}] WhatsApp conectado: ${conn.phoneNumber}`);
                    
                    // Fetch groups after connection - GARANTIR que seja executado
                    setTimeout(async () => {
                        try {
                            console.log(`[${connectionId}] 🔄 Buscando grupos após conexão...`);
                            const groups = await fetchGroups(connectionId);
                            console.log(`[${connectionId}] ✅ ${groups.length} grupos carregados na memória`);
                        } catch (error) {
                            console.error(`[${connectionId}] ❌ Erro ao buscar grupos após conexão:`, error.message);
                        }
                    }, 3000);
                }
            } catch (error) {
                console.error(`🛡️ [BLINDAGEM] Erro no handler connection.update:`, error.message);
            }
        });

        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
            } catch (error) {
                console.error(`🛡️ [BLINDAGEM] Erro ao salvar credenciais:`, error.message);
            }
        });

        return connectionData;
    } catch (error) {
        console.error(`🛡️ [${connectionId}] Erro ao criar conexão:`, error.message);
        const conn = connections.get(connectionId);
        if (conn) {
            conn.status = 'error';
            conn.lastError = error.message;
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
        // Try to auto-reconnect if not connected
        console.log(`🛡️ [BLINDAGEM] Tentando reconectar ${connectionId} antes de enviar...`);
        try {
            await createConnection(connectionId);
            // Wait a bit for connection to establish
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const updatedConn = connections.get(connectionId);
            if (!updatedConn || updatedConn.status !== 'connected') {
                throw new Error(`Conexão não está ativa após reconexão (status: ${updatedConn?.status})`);
            }
        } catch (reconnectError) {
            throw new Error(`Conexão não está ativa (status: ${conn.status}). Erro na reconexão: ${reconnectError.message}`);
        }
    }

    // Get fresh connection reference after possible reconnect
    const activeConn = connections.get(connectionId);
    
    // Retry logic for message sending
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_OPERATION_RETRIES; attempt++) {
        try {
            // Check if connection is really alive before sending
            if (attempt > 1) {
                console.log(`🛡️ [BLINDAGEM] Tentativa ${attempt}/${MAX_OPERATION_RETRIES} de envio para ${groupId}...`);
            }
            
            const alive = await isConnectionAlive(connectionId);
            if (!alive) {
                console.log(`🛡️ [BLINDAGEM] Conexão morta detectada antes de enviar, tentando reconectar...`);
                activeConn.status = 'reconnecting';
                
                try {
                    activeConn.socket?.end();
                } catch (e) {}
                
                await createConnection(connectionId);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const recheckConn = connections.get(connectionId);
                if (!recheckConn || recheckConn.status !== 'connected') {
                    lastError = new Error('Falha ao reconectar');
                    continue;
                }
            }

            const jid = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
            const currentConn = connections.get(connectionId);
            
            console.log(`[${connectionId}] Enviando mensagem para ${jid}... (tentativa ${attempt})`);
            
            let result;
            if (imageBuffer) {
                result = await currentConn.socket.sendMessage(jid, {
                    image: imageBuffer,
                    caption: caption || undefined
                });
            } else if (message) {
                result = await currentConn.socket.sendMessage(jid, { text: message });
            } else {
                throw new Error('Mensagem ou imagem é obrigatória');
            }
            
            if (!result || !result.key) {
                console.error(`[${connectionId}] Resultado inesperado do envio:`, result);
                throw new Error('Falha ao enviar mensagem - resposta inválida');
            }
            
            console.log(`[${connectionId}] ✓ Mensagem enviada para ${jid} (ID: ${result.key.id})`);
            totalMessagesProcessed++;
            return { success: true, messageId: result.key.id };
            
        } catch (error) {
            lastError = error;
            console.error(`🛡️ [BLINDAGEM] Erro no envio (tentativa ${attempt}/${MAX_OPERATION_RETRIES}):`, error.message);
            
            // Handle specific errors that require reconnection
            if (error.message?.includes('timeout') || 
                error.message?.includes('closed') || 
                error.message?.includes('not open') ||
                error.message?.includes('Connection Closed') ||
                error.message?.includes('rate-overlimit')) {
                
                const currentConn = connections.get(connectionId);
                if (currentConn) {
                    currentConn.status = 'reconnecting';
                    try {
                        currentConn.socket?.end();
                    } catch (e) {}
                }
                
                // Wait before retry with exponential backoff
                const backoffDelay = Math.min(2000 * attempt, 10000);
                console.log(`🛡️ [BLINDAGEM] Aguardando ${backoffDelay/1000}s antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                
                // Try to reconnect
                try {
                    await createConnection(connectionId);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (reconnectError) {
                    console.error(`🛡️ [BLINDAGEM] Erro na reconexão:`, reconnectError.message);
                }
            } else {
                // For other errors, just wait a bit and retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
    
    // All retries exhausted
    totalErrors++;
    throw lastError || new Error('Falha após múltiplas tentativas');
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
        console.log(`[DEBUG] POST /connections/${connectionId}/start chamado`);
        
        if (connections.has(connectionId)) {
            const existing = connections.get(connectionId);
            console.log(`[DEBUG] Conexão existente encontrada. Status: ${existing.status}`);
            
            if (existing.status === 'connected') {
                console.log(`[DEBUG] Verificando se conexão está viva...`);
                const alive = await isConnectionAlive(connectionId);
                console.log(`[DEBUG] Conexão viva: ${alive}`);
                if (alive) {
                    return res.json({ status: 'already_connected', phoneNumber: existing.phoneNumber });
                } else {
                    console.log(`[${connectionId}] Status era 'connected' mas conexão está morta`);
                }
            }
            if (existing.status === 'connecting' || existing.status === 'waiting_qr') {
                console.log(`[DEBUG] Conexão já em andamento, retornando status atual`);
                return res.json({ status: existing.status, message: 'Conexão em andamento' });
            }
            try {
                console.log(`[DEBUG] Fechando socket existente`);
                existing.socket?.end();
            } catch (e) {
                console.log(`[DEBUG] Erro ao fechar socket: ${e.message}`);
            }
        } else {
            console.log(`[DEBUG] Nenhuma conexão existente para ${connectionId}`);
        }
        
        console.log(`[DEBUG] Iniciando criação de conexão para ${connectionId} em background...`);
        
        // NÃO esperar a conexão completar - retorna imediatamente e cria em background
        // Isso evita timeout do backend
        res.json({ status: 'connecting', message: 'Aguarde o QR Code (criando conexão...)' });
        
        // Criar conexão em background (sem await)
        createConnection(connectionId).catch(error => {
            console.error(`[DEBUG] Erro ao criar conexão em background:`, error.message);
            const conn = connections.get(connectionId);
            if (conn) {
                conn.status = 'error';
                conn.lastError = error.message;
            }
        });
        
    } catch (error) {
        console.error(`[DEBUG] Erro ao iniciar conexão:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para gerar código de pareamento (alternativa ao QR code)
app.post('/connections/:id/pairing-code', async (req, res) => {
    try {
        const connectionId = req.params.id;
        let { phoneNumber } = req.body;
        console.log(`[DEBUG] POST /connections/${connectionId}/pairing-code chamado. Phone: ${phoneNumber}`);
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Número de telefone é obrigatório' });
        }
        
        // Limpar número - remover +, espaços, traços
        phoneNumber = phoneNumber.replace(/[\s\-\+\(\)]/g, '');
        
        // Adicionar código do Brasil se não tiver código de país
        if (phoneNumber.length === 11 && phoneNumber.startsWith('9')) {
            phoneNumber = '55' + phoneNumber;
        } else if (phoneNumber.length === 11) {
            phoneNumber = '55' + phoneNumber;
        } else if (phoneNumber.length === 10) {
            phoneNumber = '55' + phoneNumber;
        }
        
        console.log(`[${connectionId}] Solicitando pairing code para: ${phoneNumber}`);
        
        // Fechar conexão existente se houver
        const existingConn = connections.get(connectionId);
        if (existingConn?.socket) {
            try {
                existingConn.socket.end();
            } catch (e) {}
        }
        
        // Criar conexão específica para pairing code
        const { state, saveCreds } = await useMongoAuthState(connectionId);
        const { version } = await getBaileysVersion();
        
        // IMPORTANTE: Browser config específico para pairing code funcionar
        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: ['Ubuntu', 'Chrome', '114.0.5735.198'], // Config necessário para pairing
            connectTimeoutMs: 60000,
            markOnlineOnConnect: true,
        });

        const connectionData = {
            socket: sock,
            qrCode: null,
            qrImage: null,
            pairingCode: null,
            status: 'connecting',
            phoneNumber: null,
            groups: [],
            saveCreds,
            retryCount: 0,
            maxRetries: 10,
            createdAt: Date.now(),
            lastKeepAliveSuccess: null,
            lastKeepAliveFail: null,
            lastError: null,
        };

        connections.set(connectionId, connectionData);

        // Setup event handlers
        sock.ev.on('connection.update', async (update) => {
            try {
                const { connection, lastDisconnect } = update;
                const conn = connections.get(connectionId);
                
                if (!conn) return;

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    console.log(`🛡️ [${connectionId}] Pairing - Conexão fechada. Código: ${statusCode}`);
                    
                    if (shouldReconnect && conn.status === 'waiting_code') {
                        // Manter estado se estava esperando código
                    } else {
                        conn.status = 'disconnected';
                    }
                } else if (connection === 'open') {
                    conn.status = 'connected';
                    conn.pairingCode = null;
                    conn.phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
                    console.log(`✅ [${connectionId}] WhatsApp conectado via pairing: ${conn.phoneNumber}`);
                    
                    setTimeout(() => safeAsync(() => fetchGroups(connectionId), [], `fetchGroups-${connectionId}`), 2000);
                }
            } catch (error) {
                console.error(`🛡️ [BLINDAGEM] Erro no handler pairing:`, error.message);
            }
        });

        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
            } catch (error) {
                console.error(`🛡️ [BLINDAGEM] Erro ao salvar credenciais:`, error.message);
            }
        });
        
        // Aguardar um pouco para o socket estar pronto
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Solicitar código de pareamento
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`[${connectionId}] Pairing code gerado: ${code}`);
            
            // Salvar código na conexão
            connectionData.pairingCode = code;
            connectionData.status = 'waiting_code';
            
            res.json({ 
                success: true, 
                code: code,
                message: 'Digite este código no WhatsApp do seu celular',
                instructions: 'Vá em Configurações > Aparelhos conectados > Conectar um aparelho > Conectar com número de telefone'
            });
        } catch (error) {
            console.error(`[${connectionId}] Erro ao gerar pairing code:`, error.message);
            res.status(500).json({ error: `Falha ao gerar código: ${error.message}` });
        }
    } catch (error) {
        console.error('Erro ao gerar pairing code:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/connections/:id/qr', (req, res) => {
    const connectionId = req.params.id;
    console.log(`[DEBUG] GET /connections/${connectionId}/qr chamado`);
    
    const conn = connections.get(connectionId);
    if (!conn) {
        console.log(`[DEBUG] Conexão ${connectionId} não encontrada no Map de conexões`);
        console.log(`[DEBUG] Conexões ativas: ${Array.from(connections.keys()).join(', ') || 'nenhuma'}`);
        return res.json({ qr: null, qrImage: null, status: 'not_found' });
    }
    
    console.log(`[DEBUG] Conexão encontrada. Status: ${conn.status}, temQR: ${conn.qrImage ? 'sim' : 'não'}, temQRCode: ${conn.qrCode ? 'sim' : 'não'}`);
    if (conn.lastError) {
        console.log(`[DEBUG] Último erro: ${conn.lastError}`);
    }
    res.json({ 
        qr: conn.qrCode,
        qrImage: conn.qrImage,
        status: conn.status,
        phoneNumber: conn.phoneNumber,
        pairingCode: conn.pairingCode
    });
});

app.get('/connections/:id/groups', async (req, res) => {
    const connectionId = req.params.id;
    console.log(`[${connectionId}] 📥 GET /groups - refresh=${req.query.refresh}`);
    const conn = connections.get(connectionId);
    
    if (!conn) {
        console.log(`[${connectionId}] ❌ Conexão não encontrada no Map`);
        return res.json({ groups: [], status: 'not_found' });
    }
    
    console.log(`[${connectionId}] Status: ${conn.status}, grupos em memória: ${conn.groups?.length || 0}`);
    
    if (conn.status !== 'connected') {
        console.log(`[${connectionId}] ⚠️ Não conectado, retornando grupos em cache`);
        return res.json({ groups: conn.groups || [], status: conn.status });
    }
    
    if (req.query.refresh === 'true' || conn.groups.length === 0) {
        console.log(`[${connectionId}] 🔄 Buscando grupos (refresh ou cache vazio)...`);
        const groups = await fetchGroups(connectionId);
        console.log(`[${connectionId}] ✅ Retornando ${groups.length} grupos`);
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
    lastHealthCheck = Date.now();
    res.json({ 
        status: 'ok', 
        connections: connections.size,
        uptime: process.uptime(),
        totalMessagesProcessed,
        totalErrors,
        memoryUsage: process.memoryUsage(),
        mongoConnected: !!db,
        lastHealthCheck: new Date(lastHealthCheck).toISOString()
    });
});

// Detailed health endpoint for monitoring
app.get('/health/detailed', async (req, res) => {
    const connectionDetails = [];
    for (const [id, conn] of connections.entries()) {
        connectionDetails.push({
            id,
            status: conn.status,
            phoneNumber: conn.phoneNumber,
            groupsCount: conn.groups.length,
            retryCount: conn.retryCount,
            lastKeepAliveSuccess: conn.lastKeepAliveSuccess,
            lastKeepAliveFail: conn.lastKeepAliveFail,
            uptime: conn.createdAt ? Date.now() - conn.createdAt : 0
        });
    }
    
    res.json({
        status: 'ok',
        service: {
            uptime: process.uptime(),
            pid: process.pid,
            totalMessagesProcessed,
            totalErrors,
            memoryUsage: process.memoryUsage()
        },
        mongo: {
            connected: !!db,
            reconnectAttempts: mongoReconnectAttempts
        },
        connections: connectionDetails
    });
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
    console.log('🔄 [AUTO-CONNECT] Verificando sessões existentes para reconexão automática...');
    
    const database = await connectMongo();
    if (!database) {
        console.log('🔄 [AUTO-CONNECT] MongoDB não disponível, tentando novamente em 10s...');
        setTimeout(autoReconnectSessions, 10000);
        return;
    }
    
    try {
        // IMPORTANTE: Buscar conexões do banco principal (que o usuário criou no sistema)
        const backendConnections = await database.collection('connections')
            .find({ status: { $in: ['connected', 'disconnected', 'reconnecting'] } })
            .toArray();
        
        console.log(`🔄 [AUTO-CONNECT] Encontradas ${backendConnections.length} conexão(ões) no banco principal.`);
        
        // Para cada conexão do backend, verificar se há sessão salva e reconectar
        for (const conn of backendConnections) {
            const connectionId = conn.id;
            
            // Verificar se já está conectado
            if (connections.has(connectionId)) {
                const existing = connections.get(connectionId);
                if (existing.status === 'connected') {
                    console.log(`🔄 [AUTO-CONNECT] ${connectionId} já está conectado, pulando...`);
                    continue;
                }
            }
            
            // Verificar se há credenciais salvas no MongoDB
            const hasSession = await database.collection('whatsapp_sessions')
                .findOne({ connectionId, key: 'creds' });
            
            if (hasSession) {
                console.log(`🔄 [AUTO-CONNECT] Reconectando ${connectionId} (${conn.name || 'sem nome'})...`);
                try {
                    await createConnection(connectionId);
                    // Aguardar um pouco entre reconexões para não sobrecarregar
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (error) {
                    console.error(`🔄 [AUTO-CONNECT] Erro ao reconectar ${connectionId}:`, error.message);
                }
            } else {
                console.log(`🔄 [AUTO-CONNECT] ${connectionId} não tem sessão salva, ignorando.`);
            }
        }
        
        // Também verificar sessões órfãs no whatsapp_sessions
        const orphanSessions = await database.collection('whatsapp_sessions')
            .distinct('connectionId', { key: 'creds' });
        
        for (const sessionId of orphanSessions) {
            if (!connections.has(sessionId)) {
                // Verificar se existe no backend
                const backendConn = await database.collection('connections').findOne({ id: sessionId });
                if (backendConn) {
                    console.log(`🔄 [AUTO-CONNECT] Reconectando sessão órfã: ${sessionId}`);
                    try {
                        await createConnection(sessionId);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        console.error(`🔄 [AUTO-CONNECT] Erro ao reconectar sessão órfã ${sessionId}:`, error.message);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('🔄 [AUTO-CONNECT] Erro ao buscar sessões:', error.message);
    }
    
    // Also check filesystem for legacy sessions
    try {
        if (fs.existsSync(AUTH_DIR)) {
            const fileSessions = fs.readdirSync(AUTH_DIR).filter(dir => {
                const sessionPath = path.join(AUTH_DIR, dir);
                return fs.statSync(sessionPath).isDirectory();
            });
            
            for (const sessionId of fileSessions) {
                // Skip if already connected
                if (connections.has(sessionId)) continue;
                
                const sessionPath = path.join(AUTH_DIR, sessionId);
                const credsFile = path.join(sessionPath, 'creds.json');
                
                if (fs.existsSync(credsFile)) {
                    console.log(`🔄 [AUTO-CONNECT] Reconectando sessão do filesystem: ${sessionId}`);
                    try {
                        await createConnection(sessionId);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        console.error(`🔄 [AUTO-CONNECT] Erro ao reconectar ${sessionId}:`, error.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('🔄 [AUTO-CONNECT] Erro ao verificar sessões do filesystem:', error.message);
    }
    
    console.log('🔄 [AUTO-CONNECT] Reconexão automática concluída.');
    
    // Agendar próxima verificação periódica (a cada 5 minutos)
    setTimeout(periodicConnectionCheck, 5 * 60 * 1000);
}

// Verificação periódica de conexões - garante que tudo fique conectado
async function periodicConnectionCheck() {
    console.log('🔄 [PERIODIC] Verificando status de todas as conexões...');
    
    const database = await connectMongo();
    if (!database) {
        setTimeout(periodicConnectionCheck, 60000);
        return;
    }
    
    try {
        // Buscar todas as conexões que deveriam estar conectadas
        const backendConnections = await database.collection('connections')
            .find({ status: 'connected' })
            .toArray();
        
        for (const conn of backendConnections) {
            const connectionId = conn.id;
            const activeConn = connections.get(connectionId);
            
            if (!activeConn) {
                // Conexão deveria estar ativa mas não está no serviço
                console.log(`🔄 [PERIODIC] Conexão ${connectionId} marcada como conectada mas não está ativa, reconectando...`);
                
                const hasSession = await database.collection('whatsapp_sessions')
                    .findOne({ connectionId, key: 'creds' });
                
                if (hasSession) {
                    try {
                        await createConnection(connectionId);
                    } catch (error) {
                        console.error(`🔄 [PERIODIC] Erro ao reconectar ${connectionId}:`, error.message);
                    }
                }
            } else if (activeConn.status !== 'connected') {
                // Conexão existe mas não está conectada
                console.log(`🔄 [PERIODIC] Conexão ${connectionId} status: ${activeConn.status}, tentando reconectar...`);
                
                if (activeConn.status !== 'connecting' && activeConn.status !== 'waiting_qr') {
                    try {
                        await createConnection(connectionId);
                    } catch (error) {
                        console.error(`🔄 [PERIODIC] Erro ao reconectar ${connectionId}:`, error.message);
                    }
                }
            }
        }
        
        // Atualizar status no banco de dados para conexões ativas
        for (const [connectionId, conn] of connections.entries()) {
            if (conn.status === 'connected' && conn.phoneNumber) {
                await database.collection('connections').updateOne(
                    { id: connectionId },
                    { 
                        $set: { 
                            status: 'connected', 
                            phone_number: conn.phoneNumber,
                            last_seen: new Date().toISOString()
                        } 
                    }
                );
            }
        }
        
    } catch (error) {
        console.error('🔄 [PERIODIC] Erro na verificação periódica:', error.message);
    }
    
    // Agendar próxima verificação
    setTimeout(periodicConnectionCheck, 5 * 60 * 1000);
}

// ============= AUTO-RECOVERY SYSTEM =============
// Sistema de auto-recuperação para resolver problemas automaticamente

// Função para matar processos na porta
async function killProcessOnPort(port) {
    console.log(`🔧 [AUTO-RECOVERY] Tentando liberar porta ${port}...`);
    
    try {
        // Tenta com fuser (Linux)
        await execAsync(`fuser -k ${port}/tcp 2>/dev/null || true`);
        console.log(`🔧 [AUTO-RECOVERY] fuser executado`);
    } catch (e) {
        // Ignora erro
    }
    
    try {
        // Tenta matar processos node antigos nesta porta
        await execAsync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`);
        console.log(`🔧 [AUTO-RECOVERY] lsof+kill executado`);
    } catch (e) {
        // Ignora erro
    }
    
    // Aguarda um pouco para a porta ser liberada
    await new Promise(resolve => setTimeout(resolve, 2000));
}

// Função para verificar se porta está disponível
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });
        
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        
        server.listen(port);
    });
}

// Função principal de inicialização com auto-recovery
async function startServer(port, maxRetries = 5) {
    let currentPort = port;
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            console.log(`🚀 [AUTO-RECOVERY] Tentativa ${retries + 1}/${maxRetries} de iniciar na porta ${currentPort}...`);
            
            // Tenta iniciar o servidor
            await new Promise((resolve, reject) => {
                const server = app.listen(currentPort, async () => {
                    console.log(`🚀 Serviço WhatsApp rodando na porta ${currentPort}`);
                    console.log(`🛡️ Keep-alive configurado para verificar a cada ${KEEPALIVE_INTERVAL/1000}s`);
                    console.log(`📦 Sessões serão persistidas no MongoDB: ${MONGO_URL}`);
                    console.log(`🔄 Auto-reconexão habilitada`);
                    console.log(`🔧 Auto-recovery ativado`);
                    
                    // Connect to MongoDB
                    await connectMongo();
                    
                    // Auto-reconnect sessions
                    setTimeout(autoReconnectSessions, 3000);
                    
                    resolve();
                });
                
                server.once('error', (err) => {
                    reject(err);
                });
            });
            
            // Se chegou aqui, servidor iniciou com sucesso
            return;
            
        } catch (error) {
            console.error(`🔧 [AUTO-RECOVERY] Erro ao iniciar: ${error.message}`);
            
            if (error.code === 'EADDRINUSE') {
                console.log(`🔧 [AUTO-RECOVERY] Porta ${currentPort} em uso. Tentando liberar...`);
                
                // Tenta liberar a porta
                await killProcessOnPort(currentPort);
                
                retries++;
                
                if (retries >= maxRetries) {
                    console.error(`🔧 [AUTO-RECOVERY] Falha após ${maxRetries} tentativas. Desistindo.`);
                    // Não faz exit - deixa o processo vivo para supervisor reiniciar
                }
            } else {
                // Outro tipo de erro
                retries++;
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
}

// Inicia o servidor com auto-recovery
startServer(PORT);
