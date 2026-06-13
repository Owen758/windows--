// 启动脚本 — 绕开 VS Code 终端的 ELECTRON_RUN_AS_NODE 干扰
const { spawn } = require('child_process');
const path = require('path');

const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const args = ['.'];

// 传递 --dev 参数
if (process.argv.includes('--dev')) {
  args.push('--dev');
}

const env = { ...process.env };
// 关键：删除 ELECTRON_RUN_AS_NODE，让 Electron 以完整模式启动
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  windowsHide: false,
  env
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('启动 Electron 失败:', err.message);
  process.exit(1);
});
