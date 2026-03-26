import React, { useEffect, useMemo } from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { appTheme } from './appTheme.js';
import { appRouter } from './routes/AppRouter.jsx';
import { queryClient } from './lib/queryClient.js';
import { Toaster } from './components/ui/sonner.js';

const App = () => {
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

  const theme = useMemo(() => appTheme(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <RouterProvider router={appRouter} />
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;