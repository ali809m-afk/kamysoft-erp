const { contextBridge, ipcRenderer } = require('electron');

// The print-preview popup was removed: printing uses the page's own print dialog (window.print()).
contextBridge.exposeInMainWorld('electronAPI', {});
