import { useContext } from 'react';
import { LanguageContext } from './languageContext';

export function useLang() {
  return useContext(LanguageContext);
}
