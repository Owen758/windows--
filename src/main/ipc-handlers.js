// IPC 通信处理模块 — 主进程侧
// 接收渲染进程的请求，调用数据库和剪贴板模块

const { ipcMain, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const database = require('./database');

function registerIpcHandlers() {
  // ---- 历史记录 ----

  // 获取历史列表
  ipcMain.handle('history:getList', (event, { search = '', limit = 50, offset = 0 } = {}) => {
    try {
      const items = database.getHistory({ search, limit, offset });
      const total = database.getHistoryCount(search);
      return { success: true, data: { items, total } };
    } catch (err) {
      console.error('[IPC] history:getList 错误:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 切换置顶
  ipcMain.handle('history:togglePin', (event, { id, pinned }) => {
    try {
      database.togglePin(id, pinned);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除单条记录
  ipcMain.handle('history:delete', (event, { id }) => {
    try {
      database.deleteRecord(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 清空全部
  ipcMain.handle('history:clearAll', () => {
    try {
      database.clearAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 复制到剪贴板
  ipcMain.handle('history:copyToClipboard', (event, { id }) => {
    try {
      // 查询记录
      const items = database.getHistory({ limit: 1, offset: id - 1 });
      // 精确查找
      const all = database.getHistory({ limit: 99999 });
      const record = all.find(item => item.id === id);

      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      if (record.type === 'text') {
        clipboard.writeText(record.content);
      } else if (record.type === 'image') {
        if (record.image_path && fs.existsSync(record.image_path)) {
          const image = nativeImage.createFromPath(record.image_path);
          clipboard.writeImage(image);
        } else {
          return { success: false, error: '图片文件不存在' };
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取单张图片数据（用于预览）
  ipcMain.handle('history:getImage', (event, { id }) => {
    try {
      const items = database.getHistory({ limit: 99999 });
      const record = items.find(item => item.id === id);

      if (!record || record.type !== 'image') {
        return { success: false, error: '不是图片记录' };
      }

      const imgPath = record.thumbnail || record.image_path;
      if (!imgPath || !fs.existsSync(imgPath)) {
        return { success: false, error: '图片文件不存在' };
      }

      const buffer = fs.readFileSync(imgPath);
      const base64 = buffer.toString('base64');
      return { success: true, data: `data:image/png;base64,${base64}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 设置 ----

  // 获取设置
  ipcMain.handle('settings:get', () => {
    try {
      const settingsPath = path.join(database.getDataDir(), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        return { success: true, data: JSON.parse(raw) };
      }
      // 默认设置
      return {
        success: true,
        data: {
          retainDays: 3,
          launchAtStartup: true,
          shortcut: 'Ctrl+Shift+V',
          theme: 'light',
          accentColor: '#4A90D9'
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 保存设置
  ipcMain.handle('settings:save', (event, settings) => {
    try {
      const settingsPath = path.join(database.getDataDir(), 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 统计 ----

  ipcMain.handle('stats:get', () => {
    try {
      const stats = database.getStats();
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  console.log('[IPC] 所有 handlers 注册完成');
}

module.exports = { registerIpcHandlers };
