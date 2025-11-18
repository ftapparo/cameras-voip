const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'public', 'icon-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.removeMenu(); // Remove a barra de menu padrão
  // Carrega o build do Vite (modo produção) ou localhost (modo dev)
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      console.log('Carregando arquivo:', indexPath);
      win.loadFile(indexPath).catch((err) => {
        console.error('Erro ao carregar index.html:', err);
        win.webContents.executeJavaScript(`document.body.innerHTML = '<h2 style="color:red">Erro ao carregar index.html</h2><pre>${err}</pre>'`);
      });
  }
  // Abre DevTools para debug
  win.webContents.openDevTools();
  }


app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
