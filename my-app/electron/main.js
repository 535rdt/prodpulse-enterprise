const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

// Prevent Windows DWM occlusion calculation from flickering/blinking the window on modal triggers
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Single Instance Lock: Prevents duplicate conflicting application processes
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '../build/icon.ico');

  mainWindow = new BrowserWindow({
    title: 'ProdPulse - Enterprise Production Ops',
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    show: false,
    backgroundColor: '#0f172a',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    }
  });

  // Build sleek application menu with enterprise navigation & keyboard shortcuts
  const menuTemplate = [
    {
      label: 'ProdPulse',
      submenu: [
        {
          label: 'About ProdPulse',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(
                `window.alert("ProdPulse Enterprise Operations v1.0.0\\nBuilt for industrial shop floor management, batch telemetry, and equipment health.");`
              ).catch(() => {});
            }
          }
        },
        { type: 'separator' },
        { label: 'Quit ProdPulse', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
        { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(appMenu);

  // Seamless window presentation once DOM is fully rendered (no white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Intercept any external web navigation and open safely in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:') && !url.includes('localhost:5173')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Load production bundle or Vite development server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
