// 剪贴板监控模块 — 实时监控剪贴板变化，记录文字和图片

const { clipboard, nativeImage } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const database = require('./database');

let monitorTimer = null;
let lastTextContent = '';
let lastImageHash = '';
const MONITOR_INTERVAL = 500; // 轮询间隔：500ms

// 开始监控剪贴板
function startMonitoring() {
  if (monitorTimer) return;

  console.log('[剪贴板] 开始监控（间隔:', MONITOR_INTERVAL, 'ms）');

  monitorTimer = setInterval(() => {
    checkClipboard();
  }, MONITOR_INTERVAL);
}

// 停止监控
function stopMonitoring() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
    console.log('[剪贴板] 监控已停止');
  }
}

// 检查剪贴板内容
function checkClipboard() {
  // 检查图片（优先，因为图片复制也会触发文本检测）
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    const pngBuffer = image.toPNG();
    const hash = crypto.createHash('md5').update(pngBuffer).digest('hex');

    if (hash !== lastImageHash) {
      lastImageHash = hash;
      // 更新 lastTextContent，防止同一操作被文本检测重复记录
      lastTextContent = '';
      handleImageCapture(image, pngBuffer);
      return;
    }
  }

  // 检查文字
  const text = clipboard.readText();
  if (text && text !== lastTextContent) {
    lastTextContent = text;
    // 更新 lastImageHash，防止同一操作被图片检测重复记录
    lastImageHash = '';
    handleTextCapture(text);
  }
}

// 处理文字复制
function handleTextCapture(text) {
  // 去重：如果最近一条文字记录内容相同，跳过
  const recent = database.getHistory({ limit: 1 });
  if (recent.length && recent[0].type === 'text' && recent[0].content === text) {
    return;
  }

  const id = database.insertRecord({
    type: 'text',
    content: text
  });

  console.log('[剪贴板] 记录文字 id:', id, '预览:', text.slice(0, 30));
}

// 处理图片复制
function handleImageCapture(image, pngBuffer) {
  const dataDir = database.getDataDir();
  const imgDir = path.join(dataDir, 'images');
  const thumbDir = path.join(dataDir, 'thumbnails');

  // 用时间戳+hash生成唯一文件名
  const timestamp = Date.now();
  const hash = crypto.createHash('md5').update(pngBuffer).digest('hex').slice(0, 8);
  const fileName = `${timestamp}_${hash}.png`;
  const imagePath = path.join(imgDir, fileName);

  // 保存原始图片
  fs.writeFileSync(imagePath, pngBuffer);

  // 生成缩略图（缩小到 120px 宽，保持比例）
  let thumbnailPath = '';
  try {
    const thumb = image.resize({ width: 120 });
    const thumbBuffer = thumb.toPNG();
    const thumbFileName = `${timestamp}_${hash}_thumb.png`;
    thumbnailPath = path.join(thumbDir, thumbFileName);
    fs.writeFileSync(thumbnailPath, thumbBuffer);
  } catch (err) {
    console.error('[剪贴板] 缩略图生成失败:', err.message);
  }

  const id = database.insertRecord({
    type: 'image',
    image_path: imagePath,
    thumbnail: thumbnailPath || imagePath  // 没有缩略图就用原图
  });

  console.log('[剪贴板] 记录图片 id:', id, '文件:', fileName);
}

module.exports = {
  startMonitoring,
  stopMonitoring
};
