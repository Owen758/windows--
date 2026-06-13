// 数据库模块 — 基于 sql.js (WASM SQLite) 的数据持久化
// 负责建表、CRUD、数据文件管理

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let dbPath = null;

// 确定数据存储目录：%APPDATA%/history-clipboard/
function getDataDir() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, '..', 'history-clipboard');
}

// 初始化数据库：创建目录、加载或新建数据库文件
async function initDatabase() {
  const SQL = await initSqlJs();
  const dataDir = getDataDir();

  // 确保目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'images'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'thumbnails'), { recursive: true });
  }

  dbPath = path.join(dataDir, 'data.db');

  // 尝试加载已有数据库，否则创建新库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 建表（如果不存在）
  db.run(`
    CREATE TABLE IF NOT EXISTS clipboard_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL,
      content     TEXT,
      image_path  TEXT,
      thumbnail   TEXT,
      pinned      INTEGER DEFAULT 0,
      created_at  TEXT    NOT NULL,
      source_app  TEXT
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_type ON clipboard_history(type);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_created ON clipboard_history(created_at DESC);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pinned ON clipboard_history(pinned);`);

  saveToDisk();
  console.log('[数据库] 初始化完成:', dbPath);
  return db;
}

// 将数据库内存状态写入磁盘文件
function saveToDisk() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// ---- CRUD 操作 ----

// 插入一条记录
function insertRecord({ type, content, image_path, thumbnail, source_app }) {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO clipboard_history (type, content, image_path, thumbnail, pinned, created_at, source_app)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [type, content || null, image_path || null, thumbnail || null, now, source_app || null]
  );
  saveToDisk();
  return getLastInsertId();
}

// 获取最后插入的 ID
function getLastInsertId() {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0]?.[0] || 0;
}

// 获取历史记录列表（支持搜索、分页）
function getHistory({ search = '', limit = 50, offset = 0 } = {}) {
  let sql, params;

  if (search) {
    const like = `%${search}%`;
    sql = `
      SELECT * FROM clipboard_history
      WHERE content LIKE ? AND type = 'text'
      ORDER BY pinned DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [like, limit, offset];
  } else {
    sql = `
      SELECT * FROM clipboard_history
      ORDER BY pinned DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  }

  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return [];

  // 将查询结果转为对象数组
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// 获取历史记录总数
function getHistoryCount(search = '') {
  let sql, params;

  if (search) {
    sql = "SELECT COUNT(*) as count FROM clipboard_history WHERE content LIKE ? AND type = 'text'";
    params = [`%${search}%`];
  } else {
    sql = 'SELECT COUNT(*) as count FROM clipboard_history';
    params = [];
  }

  const result = db.exec(sql, params);
  return result[0]?.values[0]?.[0] || 0;
}

// 切换置顶
function togglePin(id, pinned) {
  db.run('UPDATE clipboard_history SET pinned = ? WHERE id = ?', [pinned ? 1 : 0, id]);
  saveToDisk();
}

// 删除单条记录
function deleteRecord(id) {
  // 先查记录，删除关联图片文件
  const result = db.exec('SELECT image_path, thumbnail FROM clipboard_history WHERE id = ?', [id]);
  if (result.length && result[0].values.length) {
    const [imagePath, thumbPath] = result[0].values[0];
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  db.run('DELETE FROM clipboard_history WHERE id = ?', [id]);
  saveToDisk();
}

// 清空全部记录
function clearAll() {
  db.run('DELETE FROM clipboard_history');
  saveToDisk();

  // 删除所有图片和缩略图
  const dataDir = getDataDir();
  const imgDir = path.join(dataDir, 'images');
  const thumbDir = path.join(dataDir, 'thumbnails');
  if (fs.existsSync(imgDir)) {
    fs.readdirSync(imgDir).forEach(f => fs.unlinkSync(path.join(imgDir, f)));
  }
  if (fs.existsSync(thumbDir)) {
    fs.readdirSync(thumbDir).forEach(f => fs.unlinkSync(path.join(thumbDir, f)));
  }
}

// 获取数据统计
function getStats() {
  const countResult = db.exec('SELECT COUNT(*) as total FROM clipboard_history');
  const pinnedResult = db.exec('SELECT COUNT(*) as total FROM clipboard_history WHERE pinned = 1');
  const imageResult = db.exec('SELECT COUNT(*) as total FROM clipboard_history WHERE type = \'image\'');

  const dataDir = getDataDir();
  let imageSize = 0;
  const imgDir = path.join(dataDir, 'images');
  if (fs.existsSync(imgDir)) {
    fs.readdirSync(imgDir).forEach(f => {
      try { imageSize += fs.statSync(path.join(imgDir, f)).size; } catch (e) {}
    });
  }

  return {
    total: countResult?.[0]?.values[0]?.[0] || 0,
    pinned: pinnedResult?.[0]?.values[0]?.[0] || 0,
    images: imageResult?.[0]?.values[0]?.[0] || 0,
    imageSizeBytes: imageSize
  };
}

// 清理过期记录（保留天数，置顶项不过期）
function cleanExpired(retainDays) {
  const dataDir = getDataDir();

  // 先查出要删除的图片路径
  const result = db.exec(
    `SELECT id, image_path, thumbnail FROM clipboard_history
     WHERE pinned = 0 AND type = 'image' AND created_at < datetime('now', '-' || ? || ' days')`,
    [retainDays]
  );

  if (result.length && result[0].values.length) {
    result[0].values.forEach(row => {
      const [id, imagePath, thumbPath] = row;
      if (imagePath && fs.existsSync(imagePath)) {
        try { fs.unlinkSync(imagePath); } catch (e) {}
      }
      if (thumbPath && fs.existsSync(thumbPath)) {
        try { fs.unlinkSync(thumbPath); } catch (e) {}
      }
    });
  }

  // 删除过期记录（包括文字和图片元数据）
  db.run(
    "DELETE FROM clipboard_history WHERE pinned = 0 AND created_at < datetime('now', '-' || ? || ' days')",
    [retainDays]
  );
  saveToDisk();
}

// 关闭数据库
function closeDatabase() {
  if (db) {
    saveToDisk();
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  saveToDisk,
  insertRecord,
  getHistory,
  getHistoryCount,
  togglePin,
  deleteRecord,
  clearAll,
  getStats,
  cleanExpired,
  closeDatabase,
  getDataDir
};
