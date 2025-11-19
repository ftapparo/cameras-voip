const { contextBridge, ipcRenderer } = require('electron');

// Expõe ipcRenderer para o renderer process
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, ...args) => {
            ipcRenderer.send(channel, ...args);
        }
    }
});
