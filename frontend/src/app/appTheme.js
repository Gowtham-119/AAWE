import { createTheme } from '@mui/material/styles';

export const appTheme = () => {
  return createTheme({
    palette: {
      mode: 'light',
      background: {
        default: '#e9edf5',
        paper: 'rgba(255,255,255,0.72)',
      },
      text: {
        primary: '#0f172a',
        secondary: '#64748b',
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
            background: 'radial-gradient(circle at 10% 10%, rgba(186,230,253,0.28), transparent 30%), radial-gradient(circle at 90% 90%, rgba(221,214,254,0.22), transparent 34%), #e9edf5',
            minHeight: '100vh',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: '1px solid rgba(148,163,184,0.20)',
            boxShadow: '0 16px 34px rgba(15,23,42,0.10)',
            backdropFilter: 'blur(18px)',
            backgroundColor: 'rgba(255,255,255,0.72)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: '1px solid rgba(148,163,184,0.16)',
            backdropFilter: 'blur(16px)',
            backgroundColor: 'rgba(255,255,255,0.70)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255,255,255,0.66)',
            color: '#111827',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(148,163,184,0.24)',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: '1px solid rgba(148,163,184,0.22)',
            backgroundColor: 'rgba(255,255,255,0.62)',
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
