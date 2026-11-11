const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

require('dotenv').config();

let mainWindow;
let mongoProcess = null;

// Determine paths based on environment (development vs packaged)
const isPackaged = app.isPackaged;
const mongoBinDir = isPackaged 
    ? path.join(process.resourcesPath, 'mongodb-bin', 'bin')
    : path.join(__dirname, '..', 'mongodb-bin', 'bin');
const mongodExe = path.join(mongoBinDir, 'mongod.exe');

async function startDatabase() {
    // 1. Setup persistent data directory
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'db');
    
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
    }

    console.log(`Starting MongoDB. Data path: ${dbPath}`);
    const mongoPort = 27018; // Use 27018 to avoid conflicts

    // 2. Spawn portable MongoDB
    mongoProcess = spawn(mongodExe, ['--dbpath', dbPath, '--port', mongoPort.toString()]);

    mongoProcess.stdout.on('data', (data) => {
        // console.log(`mongod: ${data}`);
    });
    
    mongoProcess.stderr.on('data', (data) => {
        console.error(`mongod err: ${data}`);
    });

    // 3. Inject the connection string into memory for server.js
    process.env.MONGO_URI = `mongodb://127.0.0.1:${mongoPort}/kamysoft_offline`;
    
    // 4. Use a dedicated port for the offline app to avoid clashing with dev servers
    process.env.PORT = '8099';
    
    // 5. Set upload directory to user data path since ASAR is read-only
    process.env.UPLOADS_DIR = path.join(userDataPath, 'uploads');

    // 6. Login secret: server.js refuses to start without a strong JWT_SECRET.
    //    Generate one per installation and keep it in the user data folder.
    if (!process.env.JWT_SECRET) {
        const secretFile = path.join(userDataPath, 'jwt-secret');
        let secret = fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8').trim() : '';
        if (secret.length < 32) {
            secret = require('crypto').randomBytes(48).toString('hex');
            fs.writeFileSync(secretFile, secret, { mode: 0o600 });
        }
        process.env.JWT_SECRET = secret;
    }

    // 7. The offline desktop app keeps its first-run demo logins (local database only)
    if (process.env.SEED_DEMO_USERS === undefined) {
        process.env.SEED_DEMO_USERS = 'true';
    }

    // Wait a brief moment for mongod to initialize
    return new Promise(resolve => setTimeout(resolve, 3000));
}

async function startServer() {
    console.log(`Starting Node Server...`);
    // Require server.js which will pick up the injected MONGO_URI
    try {
        require('../server.js');
    } catch (e) {
        console.error("Failed to start local server:", e);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: '26i ERP',
        icon: path.join(__dirname, 'build', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    Menu.setApplicationMenu(null);

    const port = process.env.PORT || 8089;
    
    const loadWithRetry = async () => {
        await mainWindow.webContents.session.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
        mainWindow.loadURL(`http://localhost:${port}/?desktop=true`).catch((e) => {
            console.log('Server not ready, retrying in 1s...');
            setTimeout(loadWithRetry, 1000);
        });
    };
    
    // Give server.js a second to bind to the port, but retry if it takes longer
    setTimeout(loadWithRetry, 1500);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(async () => {
    // Orchestration Flow
    await startDatabase();
    await startServer();

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});



// Ensure graceful shutdown of the database engine
app.on('before-quit', () => {
    if (mongoProcess) {
        console.log("Shutting down MongoDB...");
        mongoProcess.kill('SIGINT');
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
