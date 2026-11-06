// Vorwahlen-Quiz – Desktop-Hülle (Electron) um die Web-App in ./web
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// Nur eine Instanz zulassen
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    title: 'Vorwahlen-Quiz',
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'web', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, 'web', 'index.html'));

  // Links (z. B. Kartenquellen) im Standardbrowser öffnen, nie im App-Fenster
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });
  // F11 = Vollbild (zusätzlich zur Taste F in der App)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  {
    label: 'Ansicht',
    submenu: [
      { role: 'reload', label: 'Neu laden' },
      { role: 'togglefullscreen', label: 'Vollbild' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Originalgröße' },
      { role: 'zoomIn', label: 'Vergrößern' },
      { role: 'zoomOut', label: 'Verkleinern' },
      { type: 'separator' },
      { role: 'quit', label: 'Beenden' },
    ],
  },
]));

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
