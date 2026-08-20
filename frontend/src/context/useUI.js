import { useContext } from 'react';
import { UIContext } from './uiContext';

export const useUI = () => useContext(UIContext);
