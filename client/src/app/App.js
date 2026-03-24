import React, { useEffect, useMemo, useState } from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { appTheme } from './appTheme.js';
import { appRouter } from './routes/AppRouter.jsx';
import { queryClient } from './lib/queryClient.js';
import { ThemeModeProvider } from './context/ThemeModeContext.js';
import { Toaster } from './components/ui/sonner.js';

const THEME_STORAGE_KEY = 'aawe.theme';

const getInitialThemeMode = () => {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const App = () => {
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onWindowError = (event) => {
      console.error('[RuntimeError] Uncaught error:', event.error || event.message || event);
    };

    const onUnhandledRejection = (event) => {
      console.error('[RuntimeError] Unhandled promise rejection:', event.reason || event);
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const toggleThemeMode = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      return next;
    });
  };

  const theme = useMemo(() => appTheme(themeMode), [themeMode]);
  const themeModeContextValue = useMemo(
    () => ({ themeMode, toggleThemeMode }),
    [themeMode]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider value={themeModeContextValue}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <RouterProvider router={appRouter} />
            <Toaster position="bottom-right" richColors />
          </AuthProvider>
        </ThemeProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
};

export default App;