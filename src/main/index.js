const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const database = require('./database');
const clipboard = require('./clipboard');
const cleaner = require('./cleaner');
const { registerIpcHandlers } = require('./ipc-handlers');

// 判断是否为开发模式
const isDev = process.argv.includes('--dev');

let mainWindow = null;
let tray = null;
let isQuitting = false;
const DEFAULT_RETAIN_DAYS = 3;
const DEFAULT_SHORTCUT = 'Ctrl+Shift+V';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 320,
    minHeight: 450,
    maxWidth: 800,
    maxHeight: 1000,
    frame: false,
    transparent: false,
    resizable: true,
    show: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    positionWindow(mainWindow);
    mainWindow.show();
  });

  // 关闭窗口时隐藏到托盘，不退出
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// 将窗口定位到屏幕右下角
function positionWindow(win) {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const [winW, winH] = win.getSize();
  win.setPosition(width - winW - 20, height - winH - 20);
}

// ---- 系统托盘 ----
function createTray() {
  // 使用简单的 16x16 托盘图标（纯色方块，后续替换为设计图标）
  const { nativeImage } = require('electron');
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEESURBVDiNpZMxTsNAEEX/rNeOAwUlHVdA4gJcAokLUNBQcorQcAQkOq7AJbhAOtqEglQgIdJYjr1eirUjYcc4SJEo/mpm579m/isKIeB/nN5uG2hAl5FnxfuU+1qqq8XgBi2A26Uc1tLdlcLv8+UgtT7L3VvBeN8sRr+APrc3bS3mSgHP7fnpYLy3XoZpArwAqQH6WXvjA2s/9y/GguRVpUEhG+nXaE9mrycUOiPtA9Aw1oAQRhEEcAL2xbgLQAjZqDAwGsALIDbA+idwAuM2AXQByJIAPAFRDDgjBPDJ2IvLgBCCNcYjGYM0SgcYCrSVgr1mH8As8y60cBQTrNdeH4C4ScaDIG4W/wXRHj3sH+oI0AAAAABJRU5ErkJggg=='
  );
  tray = new Tray(icon);
  tray.setToolTip('历史粘贴板');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开历史粘贴板',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 单击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

// ---- 全局快捷键 ----
function registerShortcut(accelerator) {
  try {
    globalShortcut.unregisterAll();
    const ret = globalShortcut.register(accelerator, () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createWindow();
      }
    });

    if (ret) {
      console.log('[快捷键] 已注册:', accelerator);
    } else {
      console.error('[快捷键] 注册失败:', accelerator);
    }
  } catch (err) {
    console.error('[快捷键] 注册异常:', err.message);
  }
}

// ---- 开机自启 ----
function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: process.execPath
  });
}

// ---- 窗口控制 IPC ----
function registerWindowControls() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.hide());
}

// ---- 加载设置并应用 ----
async function loadAndApplySettings() {
  const fs = require('fs');
  const settingsPath = path.join(database.getDataDir(), 'settings.json');
  let settings = {
    retainDays: DEFAULT_RETAIN_DAYS,
    launchAtStartup: true,
    shortcut: DEFAULT_SHORTCUT,
    theme: 'light',
    accentColor: '#4A90D9'
  };

  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      settings = { ...settings, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('[设置] 加载失败，使用默认:', e.message);
  }

  // 应用设置
  cleaner.startCleaner(settings.retainDays);
  registerShortcut(settings.shortcut);
  setAutoLaunch(settings.launchAtStartup);

  return settings;
}

// ---- 应用生命周期 ----
app.whenReady().then(async () => {
  // 1. 初始化数据库
  await database.initDatabase();

  // 2. 注册 IPC 通信
  registerIpcHandlers();
  registerWindowControls();

  // 3. 创建系统托盘
  createTray();

  // 4. 加载并应用设置（快捷键、开机自启、清理器）
  await loadAndApplySettings();

  // 5. 启动剪贴板监控
  clipboard.startMonitoring();

  // 6. 创建主窗口
  createWindow();

  console.log('[主进程] 历史粘贴板启动完成');
});

app.on('window-all-closed', () => {
  // 不退出，保持在托盘运行
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  cleaner.stopCleaner();
  database.closeDatabase();
  clipboard.stopMonitoring();
});
