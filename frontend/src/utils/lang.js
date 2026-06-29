// 根据所选语言返回内容的 title/content。
// 数据库缓存了「原文 + 另一种语言译文」：source_lang 是原文语言，
// title_translated/content_translated 是另一种语言的缓存译文。
// 选中语言 == 原文语言 → 用原文；否则用译文（缺失则回退原文）。

export function localize(item, lang) {
  if (!item) return { title: '', content: '', translated: false };
  const wantTranslation = item.source_lang && lang && lang !== item.source_lang;
  if (wantTranslation && (item.title_translated || item.content_translated)) {
    return {
      title: item.title_translated || item.title,
      content: item.content_translated || item.content,
      translated: true,
    };
  }
  return { title: item.title, content: item.content, translated: false };
}

// 仅取标题（列表页用），逻辑同上。
export function localizeTitle(item, lang) {
  if (!item) return '';
  if (item.source_lang && lang && lang !== item.source_lang && item.title_translated) {
    return item.title_translated;
  }
  return item.title;
}
