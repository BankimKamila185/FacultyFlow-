const { app, BrowserWindow, Notification, ipcMain, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');

// Set App Identity for macOS and Windows Notifications
app.name = 'FacultyFlow';
const BUNDLE_ID = 'com.facultyflow.app';

// Ensure consistent naming for notification grouping
app.name = 'FacultyFlow';

if (process.platform === 'darwin' || process.platform === 'win32') {
  app.setAppUserModelId(BUNDLE_ID);
}

// Backend Process Supervisor
let backendProcess = null;

function startBackend() {
  const isDev = !app.isPackaged;
  const backendPath = isDev 
    ? path.join(__dirname, '../../backend/dist/server.js')
    : path.join(process.resourcesPath, 'app/backend/dist/server.js');

  console.log(`[MAIN] Starting backend from: ${backendPath}`);

  try {
    const { fork } = require('child_process');
    backendProcess = fork(backendPath, [], {
      env: {
        ...process.env,
        PORT: '4000',
        NODE_ENV: isDev ? 'development' : 'production'
      },
      stdio: 'inherit'
    });

    backendProcess.on('error', (err) => {
      console.error('[BACKEND] Process error:', err);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[BACKEND] Process exited with code ${code}`);
    });
  } catch (err) {
    console.error('[MAIN] Failed to start backend:', err);
  }
}

function createWindow() {
  const isDev = !app.isPackaged;
  
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar', // Provides the modern translucent macOS look
    visualEffectState: 'active',
    backgroundColor: '#00000000', // Set to transparent to allow vibrancy to show
  });

  win.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../dist/index.html')}`
  );

  // Only open DevTools in development mode
  if (isDev) {
    win.webContents.openDevTools({ mode: 'right' });
  }

  // Handle errors
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode} ${errorDescription}`);
  });
}

// Handle multiple notifications by creating an instance each time
ipcMain.handle('send-notification', (event, { title, body }) => {
  console.log(`[MAIN] Requesting notification: "${title}" - "${body}"`);
  try {
    // Add a invisible variation to ensure macOS doesn't suppress identical consecutive notifications
    const displayBody = body + (process.platform === 'darwin' ? '\u200B' : ''); // Zero-width space
    
    const iconPath = path.join(app.getAppPath(), 'public/pwa-192x192.png');

    // NATIVE macOS SYSTEM FORCE (AppleScript)
    // This bypasses the typical Electron permission gate which is failing for ad-hoc apps.
    if (process.platform === 'darwin') {
      try {
        const script = `display notification "${displayBody}" with title "${title || 'FacultyFlow'}" subtitle "System Alert"`;
        exec(`osascript -e '${script}'`);
        console.log('[MAIN] AppleScript force trigger executed');
      } catch (err) {
        console.error('[MAIN] AppleScript Error:', err);
      }
    }

    // Audible confirmation
    shell.beep();

    const notification = new Notification({ 
      title: title || 'FacultyFlow', 
      subtitle: 'Native macOS Notification',
      body: displayBody || '',
      silent: false,
      icon: iconPath
    });
    
    notification.on('show', () => console.log('[MAIN] Notification displayed successfully'));
    notification.on('error', (err) => console.error('[MAIN] Notification error event:', err));
    
    notification.show();
    return { success: true, timestamp: Date.now() };
  } catch (err) {
    console.error('[MAIN] Notification exception:', err);
    return { success: false, error: err.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('will-quit', () => {
  if (backendProcess) {
    console.log('[MAIN] Killing backend process...');
    backendProcess.kill();
  }
});
