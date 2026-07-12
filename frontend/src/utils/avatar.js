import { DJANGO_ORIGIN } from '../config';

const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];

// 后端把头像序列化成 request.build_absolute_uri(...)，在 443 反代后面 Django 会把
// 它看到的 Host（localhost / 内网名）写进 URL。网页/Electron 同源无所谓，但 Cordova
// 原生壳跑在 https://localhost，<img src="https://localhost/media/..."> 会打到壳自身
// 而不是服务器。这里在 Cordova 构建（DJANGO_ORIGIN 非空）时把后端头像的 host 重挂到
// 已部署域名；网页/Electron（DJANGO_ORIGIN 为空）保持原样。
export function resolveAvatar(url) {
  if (!url || !DJANGO_ORIGIN) return url || null;
  try {
    const u = new URL(url, DJANGO_ORIGIN);
    return DJANGO_ORIGIN + u.pathname + u.search;
  } catch {
    return url;
  }
}

export function getAvatarColor(username) {
  const hash = Math.abs((username || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getAvatarUrl(username) {
  return `/images/${getAvatarColor(username)}.jpg`;
}
