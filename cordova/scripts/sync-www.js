// 构建 frontend（cordova 专用模式：绝对后端地址 + 相对资源路径）并把产物同步到 cordova/www/。
// www/ 是纯生成目录（见 .gitignore），每次都整个重建，不做增量。
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BUILD_OUT = path.join(FRONTEND, 'dist-cordova');
const WWW = path.join(__dirname, '..', 'www');

console.log('[sync-www] building frontend (mode=cordova)...');
execSync('npm run build:cordova', { cwd: FRONTEND, stdio: 'inherit' });

console.log('[sync-www] clearing www/...');
fs.rmSync(WWW, { recursive: true, force: true });

console.log('[sync-www] copying dist-cordova/ -> www/...');
fs.cpSync(BUILD_OUT, WWW, { recursive: true });

console.log('[sync-www] done.');
