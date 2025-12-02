import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import ini from 'ini';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Map para rastrear streams ativos
const activeStreams = new Map();

// Habilita CORS para todas as requisições
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Função para carregar configuração das câmeras
function loadCameraConfig() {
  try {
    const configPath = path.join(process.cwd(), 'cameras.conf');
    
    if (!fs.existsSync(configPath)) {
      console.log('⚠️  Arquivo cameras.conf não encontrado, criando template...');
      createConfigTemplate();
      return {};
    }
    
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config = ini.parse(configFile);
    
    console.log('📷 Configurações de câmeras carregadas:');
    
    const cameras = {};
    Object.entries(config).forEach(([cameraId, cameraData]) => {
      if (cameraData.ip && cameraData.usuario && cameraData.senha) {
        // Extrai o último octeto do IP para usar como ID numérico
        const ipParts = cameraData.ip.split('.');
        const numericId = ipParts[3];
        
        cameras[cameraId] = {
          id: cameraId,
          numericId: numericId, // Adiciona ID numérico para compatibilidade
          nome: cameraData.nome || cameraId,
          ip: cameraData.ip,
          ramal: cameraData.ramal || null,
          usuario: cameraData.usuario,
          senha: cameraData.senha,
          descricao: cameraData.descricao || '',
          hasVoip: Boolean(cameraData.ramal && cameraData.ramal.trim())
        };
        
        console.log(`  - ${cameraId}: ${cameraData.nome} (${cameraData.ip}) - User: ${cameraData.usuario}${cameraData.ramal ? ` - Ramal: ${cameraData.ramal}` : ''}`);
      } else {
        console.warn(`⚠️  Câmera ${cameraId} tem configuração incompleta (faltam ip, usuario ou senha)`);
      }
    });
    
    console.log(`✅ Total de câmeras válidas carregadas: ${Object.keys(cameras).length}`);
    return cameras;
  } catch (error) {
    console.error('❌ Erro ao carregar configuração das câmeras:', error);
    return {};
  }
}

// Função para criar template de configuração
function createConfigTemplate() {
  const template = `# Configuração das Câmeras
# Edite este arquivo para adicionar/modificar câmeras

[cam1]
nome=Camera Principal
ip=192.168.1.100
ramal=
usuario=admin
senha=password
descricao=Camera principal da entrada

[cam2]
nome=Camera Secundaria
ip=192.168.1.101
ramal=9001
usuario=admin
senha=password
descricao=Camera com interfone (ramal 9001)

# Para adicionar mais câmeras, copie o padrão acima
# Certifique-se de preencher todos os campos obrigatórios:
# - nome: Nome da câmera
# - ip: Endereço IP da câmera
# - ramal: Número do ramal (deixe vazio se não tiver VoIP)
# - usuario: Usuário para autenticação
# - senha: Senha para autenticação
# - descricao: Descrição da localização/função
`;

  try {
    fs.writeFileSync('cameras.conf', template, 'utf8');
    console.log('✅ Template de configuração criado: cameras.conf');
    console.log('📝 Edite o arquivo cameras.conf para configurar suas câmeras');
  } catch (error) {
    console.error('❌ Erro ao criar template de configuração:', error);
  }
}

// Carrega configuração das câmeras
let cameras = loadCameraConfig();

// Função para calcular resposta digest
function calculateDigestResponse(username, password, realm, method, uri, nonce, qop, nc, cnonce) {
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  
  let response;
  if (qop) {
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
  } else {
    response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  }
  
  return response;
}

// Endpoint para snapshots (fotos individuais)
app.use('/snapshot/:cameraId', async (req, res) => {
  const cameraId = req.params.cameraId;
  const camera = cameras[cameraId];
  
  if (!camera) {
    console.log(`❌ Camera ${cameraId} não encontrada para snapshot. Câmeras disponíveis: ${Object.keys(cameras).join(', ')}`);
    return res.status(404).json({ 
      error: `Camera ${cameraId} not found`,
      availableCameras: Object.keys(cameras)
    });
  }
  
  try {
    const targetUrl = `http://${camera.ip}/cgi-bin/snapshot.cgi?channel=1&subtype=1`;
    
    console.log(`[${camera.id}] ${camera.nome} - Snapshot: ${targetUrl}`);
    console.log(`[${camera.id}] Usando credenciais: ${camera.usuario}/*****`);
    
    // Primeira requisição para obter challenge
    const initialResponse = await fetch(targetUrl, {
      method: req.method,
      headers: { 'User-Agent': 'Camera-Proxy/1.0' }
    });
    
    if (initialResponse.status === 401) {
      const authHeader = initialResponse.headers.get('www-authenticate');
      
      if (authHeader && authHeader.includes('Digest')) {
        const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
        const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
        const qop = authHeader.match(/qop="?([^",\s]+)"?/)?.[1];
        
        if (realm && nonce) {
          const nc = '00000001';
          const cnonce = crypto.randomBytes(16).toString('hex');
          const uri = '/cgi-bin/snapshot.cgi?channel=1&subtype=1';
          
          const response = calculateDigestResponse(
            camera.usuario, camera.senha, realm, req.method, uri, nonce, qop, nc, cnonce
          );
          
          let authValue = `Digest username="${camera.usuario}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
          if (qop) {
            authValue += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
          }
          
          console.log(`[${camera.id}] Enviando autenticação Digest...`);
          
          // Segunda requisição com autenticação
          const authResponse = await fetch(targetUrl, {
            method: req.method,
            headers: {
              'Authorization': authValue,
              'User-Agent': 'Camera-Proxy/1.0'
            }
          });
          
          console.log(`[${camera.id}] Resposta da autenticação snapshot: ${authResponse.status} ${authResponse.statusText}`);
          
          if (authResponse.ok) {
            // Configura headers CORS para imagem
            res.set({
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': '*',
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            });
            
            res.status(authResponse.status);
            
            // Envia a imagem diretamente
            const imageBuffer = await authResponse.arrayBuffer();
            res.send(Buffer.from(imageBuffer));
            return;
          }
        }
      }
    } else if (initialResponse.ok) {
      // Se a primeira requisição foi bem-sucedida (sem autenticação necessária)
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true', 
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'image/jpeg'
      });
      
      res.status(initialResponse.status);
      
      const imageBuffer = await initialResponse.arrayBuffer();
      res.send(Buffer.from(imageBuffer));
      return;
    }
    
    // Se chegou aqui, algo deu errado
    res.status(500).json({ error: `Failed to get snapshot from camera ${cameraId}` });
    
  } catch (error) {
    console.error(`[${camera.id}] ❌ Erro no snapshot:`, error);
    res.status(500).json({ error: 'Internal proxy error', details: error.message });
  }
});

// Middleware genérico para qualquer câmera (streaming)
app.use('/camera/:cameraId', async (req, res) => {
  const cameraId = req.params.cameraId;
  const camera = cameras[cameraId];
  
  if (!camera) {
    console.log(`❌ Camera ${cameraId} não encontrada. Câmeras disponíveis: ${Object.keys(cameras).join(', ')}`);
    return res.status(404).json({ 
      error: `Camera ${cameraId} not found`,
      availableCameras: Object.keys(cameras)
    });
  }
  
  try {
    const targetUrl = `http://${camera.ip}/cgi-bin/video.cgi?channel=1&subtype=1`;
    
    console.log(`[${camera.id}] ${camera.nome} - Tentando acessar: ${targetUrl}`);
    console.log(`[${camera.id}] Usando credenciais: ${camera.usuario}/*****`);
    
    // Primeira requisição para obter challenge
    const initialResponse = await fetch(targetUrl, {
      method: req.method,
      headers: { 'User-Agent': 'Camera-Proxy/1.0' }
    });
    
    if (initialResponse.status === 401) {
      const authHeader = initialResponse.headers.get('www-authenticate');
      
      if (authHeader && authHeader.includes('Digest')) {
        const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
        const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
        const qop = authHeader.match(/qop="?([^",\s]+)"?/)?.[1];
        
        if (realm && nonce) {
          const nc = '00000001';
          const cnonce = crypto.randomBytes(16).toString('hex');
          const uri = '/cgi-bin/video.cgi?channel=1&subtype=1';
          
          const response = calculateDigestResponse(
            camera.usuario, camera.senha, realm, req.method, uri, nonce, qop, nc, cnonce
          );
          
          let authValue = `Digest username="${camera.usuario}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
          if (qop) {
            authValue += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
          }
          
          console.log(`[${camera.id}] Enviando autenticação Digest...`);
          
          // Segunda requisição com autenticação
          const authResponse = await fetch(targetUrl, {
            method: req.method,
            headers: {
              'Authorization': authValue,
              'User-Agent': 'Camera-Proxy/1.0'
            }
          });
          
          console.log(`[${camera.id}] Resposta da autenticação: ${authResponse.status} ${authResponse.statusText}`);
          
          if (authResponse.ok) {
            console.log(`[${camera.id}] ✅ Autenticação bem-sucedida - streaming iniciado`);
            
            // Configura headers CORS
            res.set({
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            });
            
            // Copia headers da resposta (exceto CORS conflitantes)
            authResponse.headers.forEach((value, key) => {
              if (!key.toLowerCase().startsWith('access-control-')) {
                res.set(key, value);
              }
            });
            
            res.status(authResponse.status);
            
            // Stream da resposta
            const reader = authResponse.body.getReader();
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
              res.end();
            } catch (streamError) {
              console.error(`[${camera.id}] Erro no streaming:`, streamError);
              res.end();
            }
            return;
          }
        }
      }
    } else if (initialResponse.ok) {
      // Se a primeira requisição foi bem-sucedida (sem autenticação necessária)
      console.log(`[${camera.id}] ✅ Acesso direto bem-sucedido (sem autenticação necessária)`);
      
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true', 
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      
      initialResponse.headers.forEach((value, key) => {
        if (!key.toLowerCase().startsWith('access-control-')) {
          res.set(key, value);
        }
      });
      
      res.status(initialResponse.status);
      
      const reader = initialResponse.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (streamError) {
        console.error(`[${camera.id}] Erro no streaming:`, streamError);
        res.end();
      }
      return;
    }
    
    // Se chegou aqui, algo deu errado
    res.status(500).json({ error: `Failed to authenticate with camera ${cameraId}` });
    
  } catch (error) {
    console.error(`[${camera.id}] ❌ Erro no proxy:`, error);
    res.status(500).json({ error: 'Internal proxy error', details: error.message });
  }
});

// Endpoint para listar câmeras disponíveis
app.get('/cameras', (req, res) => {
  const cameraList = Object.entries(cameras).map(([id, camera]) => ({
    id: camera.id,
    numericId: id,
    nome: camera.nome,
    ip: camera.ip,
    descricao: camera.descricao,
    ramal: camera.ramal,
    hasVoip: camera.hasVoip,
    url: `/camera/${id}`,
    snapshotUrl: `/snapshot/${id}`,
    // Não expor credenciais na API
    hasCredentials: !!(camera.usuario && camera.senha)
  }));
  
  res.json(cameraList);
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    cameras: Object.keys(cameras).length,
    configLoaded: Object.keys(cameras).length > 0,
    configFile: 'cameras.conf',
    endpoints: Object.entries(cameras).map(([id, camera]) => ({
      id: camera.id,
      name: camera.nome,
      url: `/camera/${id}`,
      hasVoip: camera.hasVoip
    }))
  });
});

// Endpoint para recarregar configuração
app.post('/reload-config', (req, res) => {
  try {
    console.log('🔄 Recarregando configuração das câmeras...');
    const newCameras = loadCameraConfig();
    
    // Substitui todas as câmeras
    cameras = newCameras;
    
    res.json({ 
      success: true, 
      message: 'Configuração recarregada com sucesso',
      camerasCount: Object.keys(cameras).length,
      cameras: Object.entries(cameras).map(([id, camera]) => ({
        id: camera.id,
        nome: camera.nome,
        ip: camera.ip,
        hasVoip: camera.hasVoip
      }))
    });
    
    console.log(`✅ Configuração recarregada - ${Object.keys(cameras).length} câmeras ativas`);
  } catch (error) {
    console.error('❌ Erro ao recarregar configuração:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao recarregar configuração', 
      error: error.message 
    });
  }
});

// Função para iniciar stream de uma câmera via WebSocket
async function startCameraStream(ws, cameraId) {
  try {
    const camera = cameras[cameraId];
    if (!camera) {
      console.log(`❌ WebSocket: Camera ${cameraId} não encontrada. Câmeras disponíveis: ${Object.keys(cameras).join(', ')}`);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Câmera ${cameraId} não encontrada`,
        availableCameras: Object.keys(cameras)
      }));
      return;
    }

    console.log(`[WebSocket] Iniciando stream da câmera ${cameraId} (${camera.nome})`);

    const streamUrl = `http://${camera.ip}/cgi-bin/mjpg/video.cgi?channel=1&subtype=1`;
    
    console.log(`[WebSocket] URL: ${streamUrl}`);
    console.log(`[WebSocket] Credenciais: ${camera.usuario}/*****`);
    
    // Primeira requisição para obter challenge de autenticação
    const initialResponse = await fetch(streamUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Camera-Proxy-WS/1.0' }
    });

    let finalResponse = initialResponse;

    // Se precisar de autenticação Digest
    if (initialResponse.status === 401) {
      const authHeader = initialResponse.headers.get('www-authenticate');
      
      if (authHeader && authHeader.includes('Digest')) {
        const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
        const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
        const qop = authHeader.match(/qop="?([^",\s]+)"?/)?.[1];
        
        if (realm && nonce) {
          const nc = '00000001';
          const cnonce = crypto.randomBytes(16).toString('hex');
          const uri = '/cgi-bin/mjpg/video.cgi?channel=1&subtype=1';
          
          const response = calculateDigestResponse(
            camera.usuario, camera.senha, realm, 'GET', uri, nonce, qop, nc, cnonce
          );
          
          let authValue = `Digest username="${camera.usuario}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
          if (qop) {
            authValue += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
          }
          
          console.log(`[WebSocket] Enviando autenticação Digest para câmera ${cameraId}...`);
          
          // Segunda requisição com autenticação
          finalResponse = await fetch(streamUrl, {
            method: 'GET',
            headers: {
              'Authorization': authValue,
              'User-Agent': 'Camera-Proxy-WS/1.0'
            }
          });
          
          console.log(`[WebSocket] Resposta da autenticação: ${finalResponse.status} ${finalResponse.statusText}`);
        }
      }
    }

    if (!finalResponse.ok) {
      throw new Error(`HTTP ${finalResponse.status}: ${finalResponse.statusText}`);
    }

    console.log(`[WebSocket] ✅ Stream da câmera ${cameraId} conectado`);
    
    // Envia confirmação de conexão
    ws.send(JSON.stringify({ type: 'connected', cameraId, cameraName: camera.nome }));

    const reader = finalResponse.body.getReader();
    let buffer = new Uint8Array(0);
    
    // Função para processar chunks MJPEG
    const processChunks = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          
          if (done) break;
          
          // Verifica se WebSocket ainda está aberto
          if (ws.readyState !== ws.OPEN) {
            console.log(`[WebSocket] Conexão fechada para câmera ${cameraId}`);
            break;
          }
          
          // Adiciona novo chunk ao buffer
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;
          
          // Procura por frames JPEG completos
          let startIdx = 0;
          while (true) {
            const jpegStart = findJpegStart(buffer, startIdx);
            if (jpegStart === -1) break;
            
            const jpegEnd = findJpegEnd(buffer, jpegStart + 2);
            if (jpegEnd === -1) break;
            
            // Extrai frame JPEG completo
            const jpegFrame = buffer.slice(jpegStart, jpegEnd + 2);
            
            // Envia frame via WebSocket como ArrayBuffer
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ 
                type: 'frame', 
                cameraId,
                timestamp: Date.now(),
                size: jpegFrame.length
              }));
              // Envia o frame como ArrayBuffer
              ws.send(jpegFrame.buffer.slice(jpegFrame.byteOffset, jpegFrame.byteOffset + jpegFrame.byteLength));
             }
            
            startIdx = jpegEnd + 2;
          }
          
          // Mantém dados restantes no buffer
          if (startIdx > 0) {
            buffer = buffer.slice(startIdx);
          }
        }
      } catch (error) {
        console.error(`[WebSocket] Erro no stream da câmera ${cameraId}:`, error);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
      } finally {
        reader.releaseLock();
      }
    };

    processChunks();

  } catch (error) {
    console.error(`[WebSocket] Erro ao iniciar stream da câmera ${cameraId}:`, error);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }
}

// Função para encontrar início de JPEG (FF D8)
function findJpegStart(buffer, startIdx = 0) {
  for (let i = startIdx; i < buffer.length - 1; i++) {
    if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8) {
      return i;
    }
  }
  return -1;
}

// Função para encontrar fim de JPEG (FF D9)
function findJpegEnd(buffer, startIdx = 0) {
  for (let i = startIdx; i < buffer.length - 1; i++) {
    if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
      return i;
    }
  }
  return -1;
}

// WebSocket connection handler
wss.on('connection', (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const cameraId = url.searchParams.get('camera');
  
  console.log(`[WebSocket] Nova conexão para câmera: ${cameraId}`);

  if (!cameraId) {
    ws.send(JSON.stringify({ type: 'error', message: 'ID da câmera não especificado' }));
    ws.close();
    return;
  }

  // Armazena stream ativo
  const streamId = `${cameraId}-${Date.now()}`;
  activeStreams.set(streamId, { ws, cameraId, startTime: Date.now() });

  // Inicia stream da câmera
  startCameraStream(ws, cameraId);

  // Cleanup quando conexão fecha
  ws.on('close', () => {
    console.log(`[WebSocket] Conexão fechada para câmera ${cameraId}`);
    activeStreams.delete(streamId);
  });

  ws.on('error', (error) => {
    console.error(`[WebSocket] Erro na conexão da câmera ${cameraId}:`, error);
    activeStreams.delete(streamId);
  });

  // Handler para mensagens do cliente
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocket] Mensagem recebida da câmera ${cameraId}:`, message);
      
      // Pode adicionar comandos específicos aqui se necessário
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      console.error(`[WebSocket] Erro ao processar mensagem:`, error);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Camera Proxy Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server running on ws://localhost:${PORT}`);
  console.log(`📋 Total de câmeras carregadas: ${Object.keys(cameras).length}`);
  console.log('\n📡 Endpoints disponíveis:');
  console.log(`  - GET  /status           - Status do servidor`);
  console.log(`  - GET  /cameras          - Lista todas as câmeras`);
  console.log(`  - POST /reload-config    - Recarrega configuração`);
  console.log('\n📹 Câmeras disponíveis:');
  
  if (Object.keys(cameras).length === 0) {
    console.log('  ⚠️  Nenhuma câmera configurada. Edite o arquivo cameras.conf');
  } else {
    Object.entries(cameras).forEach(([id, camera]) => {
      console.log(`  - ${camera.id}: ws://localhost:${PORT}/?camera=${id} ${camera.hasVoip ? '(VoIP)' : ''}`);
    });
  }
  
  console.log('\n📝 Para configurar câmeras, edite o arquivo: cameras.conf');
  console.log('\n🎯 Conexão WebSocket: ws://localhost:3001/?camera=<CAMERA_ID>');
});