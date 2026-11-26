import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppConfig, QueueItem } from '../shared/types';
import { getDefaultConfig, loadConfig, updateConfig } from './config';
import { DownloadManager } from './downloader';
import { MEDIA_SCHEME_PRIVILEGES, registerMediaProtocol } from './mediaProtocol';
import { checkToolchain, getDiskInfo } from './system';

protocol.registerSchemesAsPrivileged([MEDIA_SCHEME_PRIVILEGES]);

let mainWindow: BrowserWindow | null = null;
let currentConfig: AppConfig = getDefaultConfig();

const downloadManager = new DownloadManager((items: QueueItem[]) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('queue:updated', items);
  }
});

function resolveAppIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(process.resourcesPath, 'icon.png')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0b1221',
    show: false,
    icon: resolveAppIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  ipcMain.handle('system:toolchain', async () => {
    return checkToolchain();
  });

  ipcMain.handle('system:disk-info', async (_event, targetPath?: string) => {
    return getDiskInfo(targetPath || currentConfig.downloadDir);
  });

  ipcMain.handle('config:get', async () => {
    return currentConfig;
  });

  ipcMain.handle('config:update', async (_event, partial: Partial<AppConfig>) => {
    currentConfig = await updateConfig(currentConfig, partial);
    return currentConfig;
  });

  ipcMain.handle('dialog:select-folder', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn thư mục lưu nhạc',
      defaultPath: currentConfig.downloadDir,
      properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || res.filePaths.length === 0) {
      return null;
    }
    const selected = res.filePaths[0];
    currentConfig = await updateConfig(currentConfig, { downloadDir: selected });
    return selected;
  });

  ipcMain.handle('shell:open-folder', async (_event, targetPath?: string) => {
    const dir = targetPath || currentConfig.downloadDir;
    await fs.promises.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  });

  ipcMain.handle('shell:show-item', async (_event, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('dialog:select-background', async () => {
    if (!mainWindow) return currentConfig;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn hình nền HUD',
      properties: ['openFile'],
      filters: [
        {
          name: 'Hình ảnh',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp']
        }
      ]
    });
    if (res.canceled || res.filePaths.length === 0) {
      return currentConfig;
    }
    currentConfig = await updateConfig(currentConfig, {
      customBgPath: res.filePaths[0]
    });
    return currentConfig;
  });

  ipcMain.handle('queue:get', async () => {
    return downloadManager.getQueue();
  });

  ipcMain.handle('queue:enqueue', async (_event, url: string) => {
    return downloadManager.enqueueUrl(
      url,
      currentConfig.format,
      currentConfig.embedMeta,
      currentConfig.downloadDir
    );
  });

  ipcMain.handle('queue:cancel', async (_event, id: string) => {
    await downloadManager.cancelItem(id);
  });

  ipcMain.handle('queue:retry', async (_event, id: string) => {
    await downloadManager.retryItem(id, currentConfig.downloadDir);
  });

  ipcMain.handle('queue:remove', async (_event, id: string) => {
    await downloadManager.removeItem(id);
  });

  ipcMain.handle('queue:clear-completed', async () => {
    downloadManager.clearCompleted();
  });

  ipcMain.handle('queue:cancel-all', async () => {
    await downloadManager.cancelAll();
  });
}

void app.whenReady().then(async () => {
  registerMediaProtocol();
  currentConfig = await loadConfig();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let isQuitting = false;
app.on('before-quit', (event) => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();
  void downloadManager.destroyAll().finally(() => {
    app.exit(0);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
