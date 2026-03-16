import { createTheme } from '@mui/material/styles';

export const appTheme = (themeMode = 'light') => {
  const isDark = themeMode === 'dark';

  return createTheme({
    palette: {
      mode: themeMode,
      background: {
        default: isDark ? '#0b1220' : '#e9edf5',
        paper: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.72)',
      },
      text: {
        primary: isDark ? '#e2e8f0' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#64748b',
      },
      primary: {
        main: '#2563eb',
      },
    },
    shape: {
      borderRadius: 16,
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: isDark
              ? 'radial-gradient(circle at 10% 10%, rgba(56,189,248,0.12), transparent 30%), radial-gradient(circle at 90% 90%, rgba(99,102,241,0.16), transparent 34%), #0b1220'
              : 'radial-gradient(circle at 10% 10%, rgba(186,230,253,0.28), transparent 30%), radial-gradient(circle at 90% 90%, rgba(221,214,254,0.22), transparent 34%), #e9edf5',
            minHeight: '100vh',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: isDark ? '1px solid rgba(71,85,105,0.45)' : '1px solid rgba(148,163,184,0.20)',
            boxShadow: isDark ? '0 16px 34px rgba(2,6,23,0.45)' : '0 16px 34px rgba(15,23,42,0.10)',
            backdropFilter: 'blur(18px)',
            backgroundColor: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.72)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: isDark ? '1px solid rgba(71,85,105,0.40)' : '1px solid rgba(148,163,184,0.16)',
            backdropFilter: 'blur(16px)',
            backgroundColor: isDark ? 'rgba(15,23,42,0.70)' : 'rgba(255,255,255,0.70)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.66)',
            color: isDark ? '#e2e8f0' : '#111827',
            backdropFilter: 'blur(16px)',
            borderBottom: isDark ? '1px solid rgba(71,85,105,0.5)' : '1px solid rgba(148,163,184,0.24)',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: isDark ? '1px solid rgba(71,85,105,0.45)' : '1px solid rgba(148,163,184,0.22)',
            backgroundColor: isDark ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.62)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            fontWeight: 600,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
          },
        },
      },
    },
  });
};
