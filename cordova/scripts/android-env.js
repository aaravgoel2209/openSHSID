// 解析 Android 构建所需的 ANDROID_HOME / JAVA_HOME，并把它们注入到进程环境。
//
// 背景：platforms/ 全部由 `cordova platform add` 生成、不进版本库（见 .gitignore），
// 所以无法把 local.properties 之类的机器相关配置提交上去。Gradle 找不到 SDK/JDK 时
// 构建就会失败。这里在跑 cordova 之前统一把环境补齐：
//   1. 优先用调用方已经设置好的环境变量（CI / 其他机器可覆盖）；
//   2. 否则回退到本机的常见安装位置自动探测。
const fs = require('node:fs');
const path = require('node:path');

// 返回第一个真实存在的路径，找不到返回 null
function firstExisting(candidates) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function resolveAndroidHome() {
  const env = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (env && fs.existsSync(env)) return env;
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return firstExisting([
    env, // 即使不存在也先列出来，方便报错信息
    path.join(localAppData, 'Android', 'Sdk'),
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'), // macOS/Linux 兜底
  ]);
}

// 在 C:\Program Files\Java 下挑一个 JDK（优先 jdk-21，其次任意 jdk-*）
function scanJavaDir(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  let names;
  try { names = fs.readdirSync(dir); } catch { return null; }
  const jdks = names.filter((n) => /jdk/i.test(n));
  const prefer21 = jdks.find((n) => /jdk-?21/i.test(n));
  const pick = prefer21 || jdks.sort().reverse()[0];
  if (!pick) return null;
  const full = path.join(dir, pick);
  return fs.existsSync(path.join(full, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac')) ? full : null;
}

function resolveJavaHome() {
  const env = process.env.JAVA_HOME;
  if (env && fs.existsSync(path.join(env, 'bin'))) return env;
  const pf = process.env.ProgramFiles || 'C:/Program Files';
  return firstExisting([
    env,
    path.join(pf, 'Java', 'jdk-21'),
    path.join(pf, 'Eclipse Adoptium', 'jdk-21'),
  ]) || scanJavaDir(path.join(pf, 'Java')) || scanJavaDir(path.join(pf, 'Eclipse Adoptium'));
}

// 返回补齐好的 env 对象；缺关键项时抛出可读错误
function androidEnv() {
  const androidHome = resolveAndroidHome();
  const javaHome = resolveJavaHome();

  const missing = [];
  if (!androidHome || !fs.existsSync(androidHome)) missing.push('Android SDK (设置 ANDROID_HOME)');
  if (!javaHome || !fs.existsSync(javaHome)) missing.push('JDK (设置 JAVA_HOME)');
  if (missing.length) {
    throw new Error(
      `[android-env] 找不到：${missing.join('、')}。\n` +
      `请设置对应环境变量，或安装到默认位置：\n` +
      `  Android SDK: %LOCALAPPDATA%\\Android\\Sdk\n` +
      `  JDK:         C:\\Program Files\\Java\\jdk-21`
    );
  }

  const env = { ...process.env };
  env.ANDROID_HOME = androidHome;
  env.ANDROID_SDK_ROOT = androidHome;
  env.JAVA_HOME = javaHome;
  // 把 JDK 的 bin 放到 PATH 最前，避免撞上系统里其它版本的 java
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`;
  return env;
}

module.exports = { androidEnv, resolveAndroidHome, resolveJavaHome };

// 直接 `node scripts/android-env.js` 时打印解析结果，方便排查
if (require.main === module) {
  try {
    const env = androidEnv();
    console.log('ANDROID_HOME =', env.ANDROID_HOME);
    console.log('JAVA_HOME    =', env.JAVA_HOME);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
