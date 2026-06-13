const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的 API（通过 contextBridge 防止直接访问 Node.js）
contextBridge.exposeInMainWorld('clipboardAPI', {
  // 平台信息
  platform: process.platform,

  // ---- 历史记录 ----
  /** 获取历史记录列表 */
  getHistory: (params) => ipcRenderer.invoke('history:getList', params),

  /** 切换置顶 */
  togglePin: (id, pinned) => ipcRenderer.invoke('history:togglePin', { id, pinned }),

  /** 删除单条记录 */
  deleteItem: (id) => ipcRenderer.invoke('history:delete', { id }),

  /** 清空全部记录 */
  clearAll: () => ipcRenderer.invoke('history:clearAll'),

  /** 复制到剪贴板 */
  copyToClipboard: (id) => ipcRenderer.invoke('history:copyToClipboard', { id }),

  /** 获取图片 base64 数据（用于预览） */
  getImageData: (id) => ipcRenderer.invoke('history:getImage', { id }),

  // ---- 设置 ----
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // ---- 统计 ----
  getStats: () => ipcRenderer.invoke('stats:get'),

  // ---- 窗口控制 ----
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // ---- 新记录事件 ----
  onNewItem: (callback) => {
    ipcRenderer.on('clipboard:newItem', (event, item) => callback(item));
  },
  removeNewItemListener: () => {
    ipcRenderer.removeAllListeners('clipboard:newItem');
  }
});
