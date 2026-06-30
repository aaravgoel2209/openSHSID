const AVATAR_COLORS = ['blue','green','red','purple','orange','indigo','emerald','sky','rose'];

export function getAvatarColor(username) {
  const hash = Math.abs((username || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getAvatarUrl(username) {
  return `/images/${getAvatarColor(username)}.jpg`;
}
