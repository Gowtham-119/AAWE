import React, { createContext, useContext } from 'react';

const ThemeModeContext = createContext({
  themeMode: 'light',
  toggleThemeMode: () => {},
});

export const ThemeModeProvider = ThemeModeContext.Provider;

export const useThemeMode = () => {
  return useContext(ThemeModeContext);
};
