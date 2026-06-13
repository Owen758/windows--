// 历史粘贴板 — 渲染进程主脚本
// 阶段 2-3：UI + 卡片列表 + 搜索 + 操作

(function () {
  'use strict';

  const API = window.clipboardAPI;
  if (!API) {
    console.error('❌ clipboardAPI 未注入，请检查 preload.js');
    return;
  }

  // ---- 状态 ----
  const state = {
    items: [],           // 全部记录
    pinnedItems: [],     // 置顶记录
    recentItems: [],     // 普通记录
    searchQuery: '',
    pageSize: 50,
    currentOffset: 0,
    totalCount: 0,
    hasMore: false,
    isLoading: false
  };

  // ---- DOM 引用 ----
  const dom = {
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    pinnedSection: document.getElementById('pinned-section'),
    pinnedList: document.getElementById('pinned-list'),
    historyList: document.getElementById('history-list'),
    recentSection: document.getElementById('recent-section'),
    loadMore: document.getElementById('load-more'),
    btnLoadMore: document.getElementById('btn-load-more'),
    emptyState: document.getElementById('empty-state'),
    imagePreview: document.getElementById('image-preview'),
    previewImage: document.getElementById('preview-image'),
    btnClosePreview: document.getElementById('btn-close-preview'),
    toast: document.getElementById('toast'),
    btnMinimize: document.getElementById('btn-minimize'),
    btnMaximize: document.getElementById('btn-maximize'),
    btnClose: document.getElementById('btn-close')
  };

  // ---- 初始化 ----
  function init() {
    bindWindowControls();
    bindSearchEvents();
    bindModalEvents();
    loadHistory();
    // 每 2 秒检查新记录（监听剪贴板变化）
    setInterval(checkNewItems, 2000);
  }

  // ---- 窗口控制 ----
  function bindWindowControls() {
    dom.btnMinimize.addEventListener('click', () => API.minimizeWindow());
    dom.btnMaximize.addEventListener('click', () => API.maximizeWindow());
    dom.btnClose.addEventListener('click', () => API.closeWindow());
  }

  // ---- 搜索事件 ----
  function bindSearchEvents() {
    let debounceTimer;
    dom.searchInput.addEventListener('input', () => {
      const val = dom.searchInput.value.trim();
      dom.btnClearSearch.classList.toggle('visible', val.length > 0);

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = val;
        state.currentOffset = 0;
        loadHistory();
      }, 250);
    });

    dom.btnClearSearch.addEventListener('click', () => {
      dom.searchInput.value = '';
      dom.btnClearSearch.classList.remove('visible');
      state.searchQuery = '';
      state.currentOffset = 0;
      loadHistory();
    });
  }

  // ---- 图片预览弹窗 ----
  function bindModalEvents() {
    dom.btnClosePreview.addEventListener('click', () => {
      dom.imagePreview.style.display = 'none';
    });
    document.querySelector('.modal-backdrop').addEventListener('click', () => {
      dom.imagePreview.style.display = 'none';
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dom.imagePreview.style.display = 'none';
      }
    });
  }

  // ---- 加载历史记录 ----
  async function loadHistory(append = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    try {
      const result = await API.getHistory({
        search: state.searchQuery,
        limit: state.pageSize,
        offset: state.currentOffset
      });

      if (!result.success) {
        console.error('加载历史失败:', result.error);
        return;
      }

      const { items, total } = result.data;
      state.totalCount = total;
      state.hasMore = state.currentOffset + state.pageSize < total;

      if (append) {
        state.items = [...state.items, ...items];
      } else {
        state.items = items;
      }

      // 分离置顶和普通
      state.pinnedItems = state.items.filter(i => i.pinned === 1);
      state.recentItems = state.items.filter(i => i.pinned !== 1);

      renderAll();
    } catch (err) {
      console.error('加载历史异常:', err);
    } finally {
      state.isLoading = false;
    }
  }

  // ---- 检查新记录（用于实时更新） ----
  async function checkNewItems() {
    try {
      const result = await API.getHistory({ limit: 1, offset: 0 });
      if (!result.success || !result.data.items.length) return;

      const latest = result.data.items[0];
      const currentLatest = state.items[0];

      // 如果有新记录且不在当前列表里
      if (!currentLatest || latest.id > currentLatest.id) {
        state.currentOffset = 0;
        await loadHistory();
      }
    } catch (e) {
      // 静默失败
    }
  }

  // ---- 渲染全部 ----
  function renderAll() {
    renderPinnedList();
    renderHistoryList();

    // 显示/隐藏 置顶区域
    dom.pinnedSection.style.display = state.pinnedItems.length ? 'block' : 'none';

    // 显示/隐藏 空状态和加载更多
    const totalVisible = state.pinnedItems.length + state.recentItems.length;
    dom.emptyState.style.display = totalVisible === 0 ? 'flex' : 'none';
    dom.loadMore.style.display = state.hasMore ? 'block' : 'none';
  }

  // ---- 渲染置顶列表 ----
  function renderPinnedList() {
    dom.pinnedList.innerHTML = '';
    state.pinnedItems.forEach(item => {
      dom.pinnedList.appendChild(createCard(item));
    });
  }

  // ---- 渲染历史列表 ----
  function renderHistoryList() {
    dom.historyList.innerHTML = '';
    state.recentItems.forEach(item => {
      dom.historyList.appendChild(createCard(item));
    });
  }

  // ---- 创建卡片 ----
  function createCard(item) {
    const card = document.createElement('div');
    card.className = 'card' + (item.pinned ? ' pinned' : '');
    card.dataset.id = item.id;

    const isImage = item.type === 'image';
    const icon = isImage ? '🖼️' : '📝';

    const timeStr = formatTime(item.created_at);
    const contentPreview = isImage ? '' : escapeHtml(item.content || '');

    card.innerHTML = `
      <div class="card-header">
        <span class="card-type-icon">${icon}</span>
        <div class="card-content">
          ${isImage
            ? `<img class="card-image-preview" src="" data-id="${item.id}" alt="图片">`
            : `<div class="card-text">${contentPreview}</div>`
          }
          <div class="card-time">${timeStr}</div>
        </div>
        <div class="card-actions">
          <button class="btn-pin${item.pinned ? ' active' : ''}" title="${item.pinned ? '取消置顶' : '置顶'}">📌</button>
          <button class="btn-delete" title="删除">🗑️</button>
        </div>
      </div>
    `;

    // 事件绑定
    const pinBtn = card.querySelector('.btn-pin');
    const deleteBtn = card.querySelector('.btn-delete');
    const textDiv = card.querySelector('.card-text');
    const imageEl = card.querySelector('.card-image-preview');

    // 点击卡片主体：复制到剪贴板
    card.addEventListener('click', (e) => {
      // 不响应操作按钮的点击
      if (e.target.closest('.card-actions')) return;

      copyToClipboard(item.id);
    });

    // 置顶/取消置顶
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePin(item);
    });

    // 删除
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(item);
    });

    // 图片加载
    if (isImage && imageEl) {
      loadImageThumb(item, imageEl);
      imageEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showImagePreview(item);
      });
    }

    // 文字展开/收起
    if (textDiv && item.content && item.content.length > 150) {
      textDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        textDiv.classList.toggle('expanded');
      });
    }

    return card;
  }

  // ---- 加载图片缩略图 ----
  async function loadImageThumb(item, imgEl) {
    try {
      const result = await API.getImageData(item.id);
      if (result.success) {
        imgEl.src = result.data;
      }
    } catch (e) {
      console.error('加载图片失败:', e);
    }
  }

  // ---- 复制到剪贴板 ----
  async function copyToClipboard(id) {
    try {
      const result = await API.copyToClipboard(id);
      if (result.success) {
        showToast('✅ 已复制到剪贴板');
        // 复制后刷新列表（被复制的项目提到最前面）
        state.currentOffset = 0;
        await loadHistory();
      } else {
        showToast('❌ ' + (result.error || '复制失败'));
      }
    } catch (e) {
      showToast('❌ 操作失败');
    }
  }

  // ---- 切换置顶 ----
  async function togglePin(item) {
    const newPinned = item.pinned ? 0 : 1;
    try {
      const result = await API.togglePin(item.id, newPinned);
      if (result.success) {
        item.pinned = newPinned;
        state.pinnedItems = state.items.filter(i => i.pinned === 1);
        state.recentItems = state.items.filter(i => i.pinned !== 1);
        renderAll();
        showToast(newPinned ? '📌 已置顶' : '已取消置顶');
      }
    } catch (e) {
      showToast('❌ 操作失败');
    }
  }

  // ---- 删除 ----
  async function deleteItem(item) {
    try {
      const result = await API.deleteItem(item.id);
      if (result.success) {
        state.items = state.items.filter(i => i.id !== item.id);
        state.pinnedItems = state.pinnedItems.filter(i => i.id !== item.id);
        state.recentItems = state.recentItems.filter(i => i.id !== item.id);
        renderAll();
        showToast('🗑️ 已删除');
      }
    } catch (e) {
      showToast('❌ 删除失败');
    }
  }

  // ---- 图片预览 ----
  async function showImagePreview(item) {
    try {
      const result = await API.getImageData(item.id);
      if (result.success) {
        dom.previewImage.src = result.data;
        dom.imagePreview.style.display = 'flex';
      }
    } catch (e) {
      showToast('❌ 无法加载图片');
    }
  }

  // ---- 加载更多 ----
  dom.btnLoadMore.addEventListener('click', async () => {
    state.currentOffset += state.pageSize;
    await loadHistory(true);
  });

  // ---- 工具函数 ----
  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHr < 24) return `${diffHr} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${min}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.style.display = 'block';
    clearTimeout(dom.toast._timeout);
    dom.toast._timeout = setTimeout(() => {
      dom.toast.style.display = 'none';
    }, 2000);
  }

  // ---- 启动 ----
  init();
  console.log('✅ 历史粘贴板 UI 已就绪');
})();
