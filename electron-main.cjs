const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let backendProcess = null;
let isAppQuitting = false;

// Verificação de instância única mais rigorosa
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Electron] Outra instância já está rodando, encerrando imediatamente...');
  // Forçar encerramento imediato sem cleanup
  process.exit(0);
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Se uma segunda instância for iniciada, focar na primeira
    console.log('[Electron] Segunda instância detectada, focando na janela principal');
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });
}

// Limpeza periódica de memória mais eficiente
function cleanupMemory() {
  if (global.gc && !isAppQuitting) {
    global.gc();
    console.log('[Memory] Limpeza de memória executada');
  }
  
  // Log do uso atual de memória apenas se significativo
  const memUsage = process.memoryUsage();
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  if (rssMB > 100) { // Só loga se usar mais que 100MB
    console.log(`[Memory] RSS: ${rssMB}MB, Heap: ${heapMB}MB`);
  }
}

// Executar limpeza a cada 5 minutos (menos freqüente para economizar CPU)
let memoryCleanupInterval = setInterval(cleanupMemory, 5 * 60 * 1000);

// Função para encontrar o caminho do preload script
function findPreloadPath() {
  const isDev = !app.isPackaged;
  
  const possiblePaths = [
    // 1. Desenvolvimento
    path.join(__dirname, 'preload.js'),
    // 2. Build local (npm run electron:build)  
    path.join(process.cwd(), 'preload.js'),
    // 3. Aplicação instalada - resources/app
    path.join(process.resourcesPath, 'app', 'preload.js'),
    // 4. Aplicação instalada - resources/app.asar.unpacked
    path.join(process.resourcesPath, 'app.asar.unpacked', 'preload.js'),
    // 5. Aplicação instalada - mesmo diretório do executável
    path.join(path.dirname(process.execPath), 'preload.js'),
    // 6. Aplicação instalada - resources
    path.join(process.resourcesPath, 'preload.js'),
    // 7. App path
    path.join(app.getAppPath(), 'preload.js')
  ];
  
  console.log('[Preload] Procurando preload.js...');
  for (const testPath of possiblePaths) {
    console.log(`[Preload] Testando: ${testPath}`);
    if (fs.existsSync(testPath)) {
      console.log(`[Preload] ✅ Encontrado: ${testPath}`);
      return testPath;
    } else {
      console.log(`[Preload] ❌ Não encontrado: ${testPath}`);
    }
  }
  
  const fallbackPath = path.join(__dirname, 'preload.js');
  console.log(`[Preload] ⚠️ Usando fallback: ${fallbackPath}`);
  return fallbackPath;
}

// Função para encontrar os caminhos corretos dos arquivos
function findBackendPaths() {
  const isDev = !app.isPackaged;
  console.log('[Backend] Modo desenvolvimento:', isDev);
  console.log('[Backend] __dirname:', __dirname);
  console.log('[Backend] process.execPath:', process.execPath);
  console.log('[Backend] process.resourcesPath:', process.resourcesPath);
  console.log('[Backend] app.getAppPath():', app.getAppPath());
  
  let backendPath, workingDir;
  
  if (isDev) {
    // Modo desenvolvimento
    backendPath = path.join(__dirname, 'camera-proxy-server.mjs');
    workingDir = __dirname;
    console.log('[Backend] Usando caminhos de desenvolvimento');
  } else {
    // Aplicação empacotada - testa múltiplos caminhos possíveis
    const execDir = path.dirname(process.execPath);
    const possiblePaths = [
      // Caminho padrão do electron-builder
      { backend: path.join(process.resourcesPath, 'app.asar.unpacked', 'camera-proxy-server.mjs'), workDir: path.join(process.resourcesPath, 'app.asar.unpacked') },
      // Caminho relativo ao executável
      { backend: path.join(execDir, 'resources', 'app.asar.unpacked', 'camera-proxy-server.mjs'), workDir: path.join(execDir, 'resources', 'app.asar.unpacked') },
      // Pasta atual
      { backend: path.join(process.cwd(), 'camera-proxy-server.mjs'), workDir: process.cwd() },
      // Pasta do executável
      { backend: path.join(execDir, 'camera-proxy-server.mjs'), workDir: execDir },
      // Pasta resources na mesma pasta do executável
      { backend: path.join(execDir, 'resources', 'camera-proxy-server.mjs'), workDir: path.join(execDir, 'resources') }
    ];
    
    console.log('[Backend] Testando caminhos possíveis:');
    for (const testPath of possiblePaths) {
      console.log(`[Backend] Testando: ${testPath.backend}`);
      if (fs.existsSync(testPath.backend)) {
        backendPath = testPath.backend;
        workingDir = testPath.workDir;
        console.log(`[Backend] ✅ Encontrado em: ${backendPath}`);
        break;
      } else {
        console.log(`[Backend] ❌ Não encontrado: ${testPath.backend}`);
      }
    }
    
    if (!backendPath) {
      const allPaths = possiblePaths.map(p => p.backend).join('\n  - ');
      throw new Error(`Backend não encontrado em nenhum dos caminhos:\n  - ${allPaths}`);
    }
  }
  
  return { backendPath, workingDir };
}

// Função para iniciar o backend proxy
function startBackend() {
  return new Promise((resolve, reject) => {
    try {
      const { backendPath, workingDir } = findBackendPaths();
      const isDev = !app.isPackaged;
      
      console.log('[Backend] Caminho do backend:', backendPath);
      console.log('[Backend] Diretório de trabalho:', workingDir);
      
      // Verifica se o arquivo existe
      if (!fs.existsSync(backendPath)) {
        throw new Error(`Arquivo backend não encontrado: ${backendPath}`);
      }
      
      // Verifica outros arquivos necessários
      const camerasConfPath = path.join(workingDir, 'cameras.conf');
      
      console.log('[Backend] Arquivo cameras.conf em:', camerasConfPath);
      console.log('[Backend] cameras.conf existe:', fs.existsSync(camerasConfPath));
      
      // Usa caminho correto para node
      const nodeCommand = 'node';
      console.log('[Backend] Comando Node.js:', nodeCommand);
      
      // Configura NODE_PATH para módulos empacotados
      const nodePath = isDev ? '' : path.join(workingDir, 'node_modules');
      console.log('[Backend] NODE_PATH:', nodePath);
      
      // Inicia processo do backend com otimizações agressivas
      backendProcess = spawn(nodeCommand, [
        '--max-old-space-size=96', // Reduzir ainda mais
        '--optimize-for-size',
        '--gc-interval=200', // Menos freqüente
        '--no-lazy', // Compilar imediatamente
        '--max-semi-space-size=8', // Limitar semi-space
        backendPath
      ], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: isDev ? 'development' : 'production',
          NODE_PATH: nodePath,
          UV_THREADPOOL_SIZE: '2', // Reduzir threads
          NODE_OPTIONS: '--max-old-space-size=96'
        },
        windowsHide: true // Ocultar janela do processo no Windows
      });
      
      let backendStarted = false;
      
      backendProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log('[Backend]', output);
        
        // Detecta quando o servidor está rodando
        if (output.includes('Camera Proxy Server running') || output.includes('localhost:3001')) {
          if (!backendStarted) {
            backendStarted = true;
            console.log('[Backend] ✅ Servidor confirmado como iniciado');
            resolve();
          }
        }
      });
      
      backendProcess.stderr.on('data', (data) => {
        console.error('[Backend Error]', data.toString().trim());
      });
      
      backendProcess.on('close', (code) => {
        console.log(`[Backend] Processo encerrado com código ${code}`);
        backendProcess = null;
        
        if (!backendStarted) {
          reject(new Error(`Backend encerrou antes de inicializar. Código: ${code}`));
        }
      });
      
      backendProcess.on('error', (error) => {
        console.error('[Backend] Erro ao iniciar:', error);
        reject(error);
      });
      
      // Timeout aumentado para 10 segundos
      setTimeout(() => {
        if (!backendStarted) {
          console.log('[Backend] ⚠️ Timeout - Servidor pode não ter iniciado corretamente');
          // Não rejeita, deixa continuar para debug
          resolve();
        }
      }, 10000);
      
    } catch (error) {
      console.error('[Backend] Erro:', error);
      reject(error);
    }
  });
}

// Função para parar o backend de forma mais rigorosa
function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    console.log('[Backend] Encerrando servidor...');
    
    // Tentar encerramento gracioso primeiro
    backendProcess.kill('SIGTERM');
    
    // Forçar encerramento após 3 segundos se não responder
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        console.log('[Backend] Forçando encerramento...');
        backendProcess.kill('SIGKILL');
      }
    }, 3000);
    
    backendProcess = null;
  }
}

async function createWindow() {
  try {
    // Inicia backend primeiro
    console.log('[Electron] Iniciando backend...');
    await startBackend();
    
    // Testa conectividade com o backend
    console.log('[Electron] Testando conectividade com backend...');
    try {
      await new Promise((resolve, reject) => {
        const req = http.request('http://localhost:3001/status', (res) => {
          console.log('[Electron] ✅ Backend respondendo com status:', res.statusCode);
          resolve();
        });
        req.on('error', (err) => {
          console.warn('[Electron] ⚠️ Backend pode não estar respondendo:', err.message);
          resolve(); // Continua mesmo com erro
        });
        req.setTimeout(10000, () => { // Aumenta timeout para 10s
          console.warn('[Electron] ⚠️ Timeout ao testar backend');
          resolve();
        });
        req.end();
      });
    } catch (err) {
      console.warn('[Electron] ⚠️ Erro ao testar backend:', err.message);
    }
    
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: path.join(__dirname, 'public', 'icon-512x512.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: findPreloadPath(),
        webSecurity: false, // Permite acesso a conteúdo de outras origens (necessário para proxy de câmeras)
        allowRunningInsecureContent: true, // Permite conteúdo HTTP em contexto HTTPS
        experimentalFeatures: false, // Desabilitar para economizar recursos
        backgroundThrottling: false, // Evitar throttling em background
        offscreen: false, // Renderização normal
        enableRemoteModule: false, // Desabilitar módulo remoto
        spellcheck: false, // Desabilitar corretor ortográfico
        additionalArguments: ['--max-old-space-size=256'] // Limitar uso de memória
      },
    });

    mainWindow.removeMenu(); // Remove a barra de menu padrão

    // Carrega o build do Vite (modo produção) ou localhost (modo dev)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Electron] Modo desenvolvimento - carregando http://localhost:5173');
      mainWindow.loadURL('http://localhost:5173');
      // Abre DevTools automaticamente em desenvolvimento
      mainWindow.webContents.openDevTools();
    } else {
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      console.log('[Electron] Carregando arquivo:', indexPath);
      mainWindow.loadFile(indexPath).catch((err) => {
        console.error('[Electron] Erro ao carregar index.html:', err);
        mainWindow.webContents.executeJavaScript(`document.body.innerHTML = '<h2 style="color:red">Erro ao carregar index.html</h2><pre>${err}</pre>'`);
      });
    }

    // Abre DevTools para debug
    //mainWindow.webContents.openDevTools();

    // Evento para quando a janela é fechada
    mainWindow.on('closed', () => {
      console.log('[Electron] Janela principal fechada');
      mainWindow = null;
    });
    
    // Evento para debug de fechamento
    mainWindow.on('close', (event) => {
      console.log('[Electron] Janela principal sendo fechada...');
    });
    
    // Evento quando janela carrega
    mainWindow.webContents.once('dom-ready', () => {
      console.log('[Electron] DOM pronto - aplicação carregada');
    });
    
    // Evento de erro na janela
    mainWindow.webContents.on('crashed', () => {
      console.error('[Electron] ⚠️ Janela principal crashou');
    });
    
    console.log('[Electron] ✅ Janela principal criada com sucesso');
    
  } catch (error) {
    console.error('[Electron] Erro ao criar janela:', error);
    
    // Cria janela de erro se backend falhar
    mainWindow = new BrowserWindow({
      width: 800,
      height: 400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    mainWindow.loadURL(`data:text/html,<h2 style="color:red">Erro ao iniciar backend</h2><p>${error.message}</p>`);
  }
}


app.whenReady().then(() => {
  console.log('[Electron] App pronto, criando janela');
  
  // Configurações otimizadas do Chromium para BAIXO USO DE CPU
  app.commandLine.appendSwitch('--disable-web-security');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor,TranslateUI,BlinkGenPropertyTrees,MediaRouter,DialMediaRouteProvider');
  app.commandLine.appendSwitch('--autoplay-policy', 'no-user-gesture-required');
  app.commandLine.appendSwitch('--disable-background-timer-throttling');
  app.commandLine.appendSwitch('--disable-renderer-backgrounding');
  app.commandLine.appendSwitch('--ignore-certificate-errors');
  app.commandLine.appendSwitch('--allow-running-insecure-content');
  app.commandLine.appendSwitch('--disable-site-isolation-trials');
  
  // Otimizações AGRESSIVAS de performance e CPU
  app.commandLine.appendSwitch('--max-old-space-size', '192'); // Reduzir mais
  app.commandLine.appendSwitch('--optimize-for-size');
  app.commandLine.appendSwitch('--memory-pressure-off');
  app.commandLine.appendSwitch('--disable-background-networking');
  app.commandLine.appendSwitch('--disable-default-apps');
  app.commandLine.appendSwitch('--disable-extensions');
  app.commandLine.appendSwitch('--disable-sync');
  app.commandLine.appendSwitch('--disable-translate');
  app.commandLine.appendSwitch('--disable-ipc-flooding-protection');
  app.commandLine.appendSwitch('--renderer-process-limit', '2'); // Reduzir processos
  app.commandLine.appendSwitch('--max-active-webgl-contexts', '2'); // Reduzir contextos
  
  // Novas otimizações para reduzir CPU
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-threaded-animation');
  app.commandLine.appendSwitch('--disable-threaded-scrolling');
  app.commandLine.appendSwitch('--disable-checker-imaging');
  app.commandLine.appendSwitch('--disable-new-content-rendering-timeout');
  app.commandLine.appendSwitch('--disable-partial-raster');
  app.commandLine.appendSwitch('--disable-skia-runtime-opts');
  app.commandLine.appendSwitch('--disable-low-latency-dxva');
  app.commandLine.appendSwitch('--disable-hardware-acceleration'); // Usar CPU em vez de GPU para vídeo
  app.commandLine.appendSwitch('--num-raster-threads', '2'); // Limitar threads de rasterização
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Electron] Reativando - criando nova janela');
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  isAppQuitting = true;
  
  // Limpar interval de limpeza de memória
  if (memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval);
  }
  
  console.log('[Electron] Todas as janelas fechadas, encerrando app');
  stopBackend(); // Para o backend antes de encerrar
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup quando app encerra
app.on('before-quit', (event) => {
  if (!isAppQuitting) {
    isAppQuitting = true;
    console.log('[Electron] App encerrando, parando backend...');
    
    // Limpar interval
    if (memoryCleanupInterval) {
      clearInterval(memoryCleanupInterval);
    }
    
    stopBackend();
    
    // Dar um tempo para limpeza
    setTimeout(() => {
      app.exit(0);
    }, 1000);
  }
});

// Handler adicional para garantir cleanup em caso de crash
process.on('exit', () => {
  console.log('[Process] Processo encerrando, cleanup final...');
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGKILL');
  }
});

// Handler para toggle do DevTools
ipcMain.handle('toggle-devtools', () => {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      console.log('[Electron] Fechando DevTools...');
      mainWindow.webContents.closeDevTools();
      return false;
    } else {
      console.log('[Electron] Abrindo DevTools...');
      mainWindow.webContents.openDevTools();
      return true;
    }
  }
  return false;
});

// Log para debug
console.log('[Electron] Arquivo electron-main.cjs carregado');
