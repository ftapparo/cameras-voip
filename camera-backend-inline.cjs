// Backend inline para Electron - CommonJS
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuração do servidor
const PORT = 3001;

let server;
let wss;
let app;
let cameras = {};

// Função para carregar configurações de câmeras
function loadCameraConfig(configPath) {
    try {
        if (!fs.existsSync(configPath)) {
            console.log(`[Backend] ⚠️  Arquivo de configuração não encontrado: ${configPath}`);
            return {};
        }

        const ini = require('ini');
        const data = fs.readFileSync(configPath, 'utf-8');
        const config = ini.parse(data);
        const cameras = {};

        console.log('[Backend] 🔧 Configurações de câmeras carregadas:');
        
        Object.keys(config).forEach(sectionKey => {
            const section = config[sectionKey];
            
            // Pula comentários e seções vazias
            if (typeof section !== 'object' || !section.nome || !section.ip || !section.usuario || !section.senha) {
                return;
            }
            
            const id = sectionKey;
            cameras[id] = {
                id,
                name: section.nome,
                ip: section.ip,
                user: section.usuario,
                pass: section.senha,
                ramal: section.ramal || null,
                url: `http://${section.ip}/cgi-bin/mjpg/video.cgi?channel=1&subtype=1`
            };
            
            const ramalInfo = section.ramal ? ` - Ramal: ${section.ramal}` : '';
            console.log(`[Backend] - ${id}: ${section.nome} (${section.ip}) - User: ${section.usuario}${ramalInfo}`);
        });

        console.log(`✅ Total de câmeras válidas carregadas: ${Object.keys(cameras).length}`);
        return cameras;
    } catch (error) {
        console.error('[Backend] ❌ Erro ao carregar configuração de câmeras:', error);
        return {};
    }
}

// Função para criar servidor HTTP com WebSocket
function createServer() {
    app = express();
    
    // Middlewares
    app.use(express.json());
    
    // CORS headers
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        
        next();
    });

    // Endpoints REST
    app.get('/status', (req, res) => {
        res.json({
            status: 'running',
            cameras: Object.keys(cameras).length,
            timestamp: new Date().toISOString()
        });
    });

    app.get('/cameras', (req, res) => {
        const cameraList = Object.values(cameras).map(cam => ({
            id: cam.id,
            nome: cam.name,
            ip: cam.ip,
            ramal: cam.ramal,
            url: `/camera/${cam.id}`,
            snapshotUrl: `/snapshot/${cam.id}`,
            descricao: cam.name,
            hasVoip: Boolean(cam.ramal),
            hasCredentials: true
        }));
        
        // Retorna array direto para compatibilidade
        res.json(cameraList);
    });

    // Criar servidor HTTP
    server = http.createServer(app);
    
    // Criar WebSocket Server
    wss = new WebSocket.Server({ 
        server,
        perMessageDeflate: false,
        clientTracking: true,
        verifyClient: (info) => {
            // Permitir conexões de localhost
            return true;
        }
    });

    // Handling WebSocket connections
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const cameraId = url.searchParams.get('camera');
        
        if (!cameraId || !cameras[cameraId]) {
            console.log(`[WebSocket] ❌ Câmera inválida solicitada: ${cameraId}`);
            ws.close();
            return;
        }

        console.log(`[Backend] [WebSocket] Nova conexão para câmera: ${cameraId}`);
        console.log(`[Backend] [WebSocket] Iniciando stream da câmera ${cameraId} (${cameras[cameraId].name})`);
        
        startCameraStream(ws, cameras[cameraId]);
    });

    return new Promise((resolve, reject) => {
        server.listen(PORT, (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            console.log(`[Backend] 🚀 Camera Proxy Server running on http://localhost:${PORT}`);
            console.log(`🌐 WebSocket Server running on ws://localhost:${PORT}`);
            resolve();
        });
    });
}

// Função para iniciar stream de câmera
function startCameraStream(ws, camera) {
    const fetch = require('node-fetch');
    
    console.log(`[WebSocket] URL: ${camera.url}`);
    console.log(`[WebSocket] Credenciais: ${camera.user}/*****`);

    const auth = Buffer.from(`${camera.user}:${camera.pass}`).toString('base64');
    
    fetch(camera.url, {
        headers: {
            'Authorization': `Basic ${auth}`,
            'User-Agent': 'Mozilla/5.0'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`[Backend] [WebSocket] ✅ Stream da câmera ${camera.id} conectado`);

        // Para node-fetch v2, response.body é um stream do Node.js
        const stream = response.body;
        
        stream.on('data', (chunk) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(chunk, { binary: true });
                } catch (error) {
                    console.error(`[WebSocket] Erro ao enviar chunk para ${camera.id}:`, error.message);
                }
            }
        });

        stream.on('error', (error) => {
            console.error(`[WebSocket] Erro no stream da câmera ${camera.id}:`, error.message);
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        stream.on('end', () => {
            console.log(`[WebSocket] Stream da câmera ${camera.id} encerrado`);
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        ws.on('close', () => {
            console.log(`[WebSocket] Cliente desconectado da câmera ${camera.id}`);
            stream.destroy();
        });

        ws.on('error', (error) => {
            console.error(`[WebSocket] Erro na conexão WebSocket ${camera.id}:`, error.message);
            stream.destroy();
        });

    })
    .catch(error => {
        console.error(`[Backend] [WebSocket] Erro ao iniciar stream da câmera ${camera.id}:`, error);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
}

// Função principal de inicialização
async function startBackendInline(configPath) {
    try {
        // Carregar configurações de câmeras
        cameras = loadCameraConfig(configPath);
        
        if (Object.keys(cameras).length === 0) {
            throw new Error('Nenhuma câmera válida encontrada na configuração');
        }

        // Criar e iniciar servidor
        await createServer();
        
        // Log de informações
        console.log(`📷 Total de câmeras carregadas: ${Object.keys(cameras).length}`);
        console.log('\n📡 Endpoints disponíveis:');
        console.log('  - GET  /status           - Status do servidor');
        console.log('  - GET  /cameras          - Lista todas as câmeras');
        console.log('\n🎥 Câmeras disponíveis:');
        
        Object.values(cameras).forEach(camera => {
            const voipInfo = camera.ramal ? ' (VoIP)' : '';
            console.log(`  - ${camera.id}: ws://localhost:${PORT}/?camera=${camera.id}${voipInfo}`);
        });
        
        console.log(`\n📝 Para configurar câmeras, edite o arquivo: cameras.conf`);
        console.log(`\n🔗 Conexão WebSocket: ws://localhost:${PORT}/?camera=<CAMERA_ID>`);
        
        return true;
        
    } catch (error) {
        console.error('[Backend] ❌ Erro ao inicializar backend:', error);
        throw error;
    }
}

// Função para parar o backend
function stopBackendInline() {
    return new Promise((resolve) => {
        console.log('[Backend] Encerrando servidor...');
        
        if (wss) {
            wss.close();
        }
        
        if (server) {
            server.close(() => {
                console.log('[Backend] ✅ Servidor encerrado');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

module.exports = {
    startBackendInline,
    stopBackendInline
};