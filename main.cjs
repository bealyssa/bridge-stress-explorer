// Electron main process
const { app, BrowserWindow } = require('electron');
const path = require('path');

let splashWindow;
let mainWindow;

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 950,
        show: false, // Don't show immediately
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load Vite dev server in development, or index.html in production
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:8080');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    // Once main window is ready, hide splash and show main
    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            if (splashWindow) {
                splashWindow.close();
            }
            mainWindow.show();
        }, 3000); // Show splash for 3 seconds minimum
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createWindow() {
    createSplashWindow();
    createMainWindow();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
