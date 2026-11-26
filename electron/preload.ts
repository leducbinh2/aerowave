import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { AeroWaveAPI, AppConfig, QueueItem } from '../shared/types';

const MEDIA_SCHEME = 'aerowave-media';

const api: AeroWaveAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (cb: (isMaximized: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, maximized: boolean) => cb(maximized);
    ipcRenderer.on('window:maximized-changed', listener);
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', listener);
    };
  },

  getToolchainStatus: () => ipcRenderer.invoke('system:toolchain'),
  getDiskInfo: (targetPath?: string) => ipcRenderer.invoke('system:disk-info', targetPath),

  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (partial: Partial<AppConfig>) => ipcRenderer.invoke('config:update', partial),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  openFolder: (targetPath?: string) => ipcRenderer.invoke('shell:open-folder', targetPath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-item', filePath),
  selectBackground: () => ipcRenderer.invoke('dialog:select-background'),

  getQueue: () => ipcRenderer.invoke('queue:get'),
  enqueueUrl: (url: string) => ipcRenderer.invoke('queue:enqueue', url),
  cancelItem: (id: string) => ipcRenderer.invoke('queue:cancel', id),
  retryItem: (id: string) => ipcRenderer.invoke('queue:retry', id),
  removeItem: (id: string) => ipcRenderer.invoke('queue:remove', id),
  clearCompleted: () => ipcRenderer.invoke('queue:clear-completed'),
  cancelAll: () => ipcRenderer.invoke('queue:cancel-all'),
  onQueueUpdate: (cb: (items: QueueItem[]) => void) => {
    const listener = (_event: IpcRendererEvent, items: QueueItem[]) => cb(items);
    ipcRenderer.on('queue:updated', listener);
    return () => {
      ipcRenderer.removeListener('queue:updated', listener);
    };
  },

  toMediaUrl: (filePath: string) =>
    `${MEDIA_SCHEME}://local?path=${encodeURIComponent(filePath)}`
};

contextBridge.exposeInMainWorld('aerowave', api);
