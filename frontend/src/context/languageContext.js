import { createContext } from 'react';

export const LanguageContext = createContext({ lang: 'zh', setLang: () => {}, t: (k) => k });
