// 自动清理模块 — 定期清理过期记录

const database = require('./database');

let cleanerTimer = null;
const CLEAN_INTERVAL = 12 * 60 * 60 * 1000; // 12 小时

// 启动自动清理
function startCleaner(retainDays) {
  if (cleanerTimer) return;

  console.log('[清理器] 启动，保留天数:', retainDays);

  // 立即执行一次清理
  performClean(retainDays);

  // 定时清理
  cleanerTimer = setInterval(() => {
    performClean(retainDays);
  }, CLEAN_INTERVAL);
}

// 停止自动清理
function stopCleaner() {
  if (cleanerTimer) {
    clearInterval(cleanerTimer);
    cleanerTimer = null;
    console.log('[清理器] 已停止');
  }
}

// 更新保留天数
function updateRetainDays(retainDays) {
  stopCleaner();
  startCleaner(retainDays);
}

// 执行清理
function performClean(retainDays) {
  try {
    const statsBefore = database.getStats();
    database.cleanExpired(retainDays);
    const statsAfter = database.getStats();
    const removed = statsBefore.total - statsAfter.total;
    if (removed > 0) {
      console.log(`[清理器] 清理了 ${removed} 条过期记录`);
    }
  } catch (err) {
    console.error('[清理器] 清理失败:', err.message);
  }
}

module.exports = {
  startCleaner,
  stopCleaner,
  updateRetainDays
};
