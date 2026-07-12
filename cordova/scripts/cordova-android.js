// 用补齐好的 ANDROID_HOME / JAVA_HOME 环境运行 `cordova <args>`。
// 用法：node scripts/cordova-android.js build android --release
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { androidEnv } = require('./android-env');

let env;
try {
  env = androidEnv();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const bin = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'cordova.cmd' : 'cordova');
const args = process.argv.slice(2);

const res = spawnSync(bin, args, {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32', // Windows 上 .cmd 需要走 shell
});

process.exit(res.status ?? 1);
