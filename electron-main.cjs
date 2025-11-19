const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'public', 'icon-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // Removido se não existir, mas pode ser necessário
    },
  });

  mainWindow.removeMenu(); // Remove a barra de menu padrão

  // Carrega o build do Vite (modo produção) ou localhost (modo dev)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Electron] Modo desenvolvimento - carregando http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('[Electron] Carregando arquivo:', indexPath);
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('[Electron] Erro ao carregar index.html:', err);
      mainWindow.webContents.executeJavaScript(`document.body.innerHTML = '<h2 style="color:red">Erro ao carregar index.html</h2><pre>${err}</pre>'`);
    });
  }

  // Abre DevTools para debug
  mainWindow.webContents.openDevTools();

  // Evento para quando a janela é fechada
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Impede garbage collection agressivo de objetos da WebAPI
  // Isso pode ajudar com o JsSIP que usa WebRTC
  mainWindow.webContents.session.setPreloads([]);
}

app.whenReady().then(() => {
  console.log('[Electron] App pronto, criando janela');
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
    app.quit();
  }
});

// Log para debug
console.log('[Electron] Arquivo electron-main.cjs carregado');
