// 设置面板逻辑 — 阶段 6

(function () {
  'use strict';

  const API = window.clipboardAPI;
  if (!API) return;

  // 默认设置
  const defaults = {
    retainDays: 3,
    launchAtStartup: true,
    shortcut: 'Ctrl+Shift+V',
    theme: 'light',
    accentColor: '#4A90D9'
  };

  let currentSettings = { ...defaults };
  let recordingShortcut = false;

  // ---- DOM ----
  const settingsBtn = document.getElementById('btn-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsBackdrop = document.getElementById('settings-backdrop');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // ---- 初始化 ----
  async function init() {
    if (!settingsBtn) return;

    await loadSettings();
    bindEvents();
  }

  async function loadSettings() {
    try {
      const result = await API.getSettings();
      if (result.success) {
        currentSettings = { ...defaults, ...result.data };
        populateForm(currentSettings);
      }
    } catch (e) {
      console.error('加载设置失败:', e);
    }
  }

  function populateForm(s) {
    setRadio('retainDays', s.retainDays);
    setToggle('launchAtStartup', s.launchAtStartup);
    setShortcutDisplay(s.shortcut);
    setRadio('theme', s.theme);
    document.querySelectorAll('.color-swatch').forEach(el => {
      el.classList.toggle('active', el.dataset.color === s.accentColor);
    });
    document.getElementById('accent-picker').value = s.accentColor;
  }

  function setRadio(name, value) {
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function setToggle(name, value) {
    const el = document.getElementById(name);
    if (el) el.checked = value;
  }

  function setShortcutDisplay(shortcut) {
    const el = document.getElementById('shortcut-display');
    if (el) el.textContent = shortcut;
  }

  function bindEvents() {
    // 打开设置面板
    settingsBtn.addEventListener('click', () => {
      settingsPanel.style.display = 'block';
    });

    // 关闭设置面板
    function closePanel() {
      settingsPanel.style.display = 'none';
    }
    btnCloseSettings.addEventListener('click', closePanel);
    settingsBackdrop.addEventListener('click', closePanel);

    // 保存设置
    btnSaveSettings.addEventListener('click', async () => {
      await saveSettings();
      closePanel();
    });

    // 颜色色块
    document.querySelectorAll('.color-swatch').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('accent-picker').value = el.dataset.color;
      });
    });

    // 取色器
    const accentPicker = document.getElementById('accent-picker');
    if (accentPicker) {
      accentPicker.addEventListener('input', () => {
        document.querySelectorAll('.color-swatch').forEach(e => e.classList.remove('active'));
        // 检查是否匹配某个预设
        const match = document.querySelector(`.color-swatch[data-color="${accentPicker.value}"]`);
        if (match) match.classList.add('active');
      });
    }

    // 快捷键录制
    const shortcutDisplay = document.getElementById('shortcut-display');
    if (shortcutDisplay) {
      shortcutDisplay.addEventListener('click', () => {
        shortcutDisplay.textContent = '按下快捷键...';
        shortcutDisplay.classList.add('recording');
        recordingShortcut = true;
      });
    }

    document.addEventListener('keydown', (e) => {
      if (!recordingShortcut) return;
      e.preventDefault();
      e.stopPropagation();

      const keys = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Meta');

      // 忽略单独的修饰键
      const modifierOnly = ['Control', 'Alt', 'Shift', 'Meta'];
      if (modifierOnly.includes(e.key)) return;

      keys.push(e.key.toUpperCase());
      currentSettings.shortcut = keys.join('+');
      setShortcutDisplay(currentSettings.shortcut);
      shortcutDisplay.classList.remove('recording');
      recordingShortcut = false;
    });

    // 主题切换实时预览
    document.querySelectorAll('input[name="theme"]').forEach(el => {
      el.addEventListener('change', () => {
        currentSettings.theme = el.value;
        applyThemePreview(el.value);
      });
    });

    // 颜色切换实时预览
    if (accentPicker) {
      accentPicker.addEventListener('input', () => {
        currentSettings.accentColor = accentPicker.value;
        applyColorPreview(accentPicker.value);
      });
    }
  }

  async function saveSettings() {
    // 收集表单数据
    currentSettings.retainDays = parseInt(getRadioValue('retainDays'), 10);
    currentSettings.launchAtStartup = document.getElementById('launchAtStartup').checked;
    currentSettings.theme = getRadioValue('theme');
    currentSettings.accentColor = document.getElementById('accent-picker').value;

    try {
      const result = await API.saveSettings(currentSettings);
      if (result.success) {
        applyTheme(currentSettings.theme);
        applyColor(currentSettings.accentColor);
        showToast('✅ 设置已保存');
      } else {
        showToast('❌ 保存失败');
      }
    } catch (e) {
      showToast('❌ 保存失败');
    }
  }

  function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  }

  // 实时预览
  function applyThemePreview(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.style.setProperty('--bg-window', '#1E1E1E');
      root.style.setProperty('--bg-card', '#2D2D2D');
      root.style.setProperty('--bg-card-hover', '#363636');
      root.style.setProperty('--text-primary', '#E0E0E0');
      root.style.setProperty('--text-secondary', '#999999');
      root.style.setProperty('--divider', '#3A3A3A');
      root.style.setProperty('--search-bg', '#333333');
      root.style.setProperty('--search-focus', '#3A3A3A');
    } else {
      root.style.setProperty('--bg-window', '#F5F5F5');
      root.style.setProperty('--bg-card', '#FFFFFF');
      root.style.setProperty('--bg-card-hover', '#F0F5FF');
      root.style.setProperty('--text-primary', '#1A1A1A');
      root.style.setProperty('--text-secondary', '#888888');
      root.style.setProperty('--divider', '#E8E8E8');
      root.style.setProperty('--search-bg', '#EBEBEB');
      root.style.setProperty('--search-focus', '#FFFFFF');
    }
  }

  function applyTheme(theme) {
    applyThemePreview(theme);
  }

  function applyColorPreview(color) {
    document.documentElement.style.setProperty('--accent', color);
  }

  function applyColor(color) {
    applyColorPreview(color);
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 2000);
  }

  // ---- 启动 ----
  document.addEventListener('DOMContentLoaded', init);
})();
