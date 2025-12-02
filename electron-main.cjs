const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let backendProcess = null;

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
      
      // Inicia processo do backend
      backendProcess = spawn(nodeCommand, [backendPath], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: isDev ? 'development' : 'production',
          NODE_PATH: nodePath
        }
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

// Função para parar o backend
function stopBackend() {
  if (backendProcess) {
    console.log('[Backend] Encerrando servidor...');
    backendProcess.kill();
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
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false, // Permite acesso a conteúdo de outras origens (necessário para proxy de câmeras)
        allowRunningInsecureContent: true, // Permite conteúdo HTTP em contexto HTTPS
        experimentalFeatures: true // Habilita recursos experimentais do Chromium
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
  
  // Configura argumentos do Chromium para melhor suporte a vídeo/streaming
  app.commandLine.appendSwitch('--disable-web-security');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
  app.commandLine.appendSwitch('--enable-experimental-web-platform-features');
  app.commandLine.appendSwitch('--autoplay-policy', 'no-user-gesture-required');
  app.commandLine.appendSwitch('--disable-background-timer-throttling');
  app.commandLine.appendSwitch('--disable-renderer-backgrounding');
  app.commandLine.appendSwitch('--ignore-certificate-errors');
  app.commandLine.appendSwitch('--allow-running-insecure-content');
  app.commandLine.appendSwitch('--disable-site-isolation-trials');
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Electron] Reativando - criando nova janela');
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    console.log('[Electron] Todas as janelas fechadas, encerrando app');
    stopBackend(); // Para o backend antes de encerrar
    app.quit();
  }
});

// Cleanup quando app encerra
app.on('before-quit', () => {
  console.log('[Electron] App encerrando, parando backend...');
  stopBackend();
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
