import React from 'react';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { supabase } from '../lib/supabaseClient.js';

const logErrorToSupabase = async ({ scope, error, errorInfo }) => {
  const shouldLog = String(process.env.REACT_APP_ENABLE_ERROR_LOGGING || '').toLowerCase() === 'true';
  if (!shouldLog) return;

  try {
    await supabase.from('error_logs').insert([
      {
        scope: scope || 'global',
        message: error?.message || 'Unknown render error',
        stack: error?.stack || null,
        component_stack: errorInfo?.componentStack || null,
        pathname: typeof window !== 'undefined' ? window.location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (loggingError) {
    console.error('[ErrorBoundary] Failed to write to error_logs table:', loggingError);
  }
};

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      supportEmail: 'admin@university.edu',
    };
  }

  componentDidMount() {
    void (async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['support_email', 'support_contact']);

        const settingsMap = new Map((data || []).map((row) => [row.setting_key, row.setting_value]));
        const supportEmail = settingsMap.get('support_email') || settingsMap.get('support_contact');
        if (supportEmail) {
          this.setState({ supportEmail: String(supportEmail) });
        }
      } catch {
        // Keep default fallback email when settings cannot be loaded.
      }
    })();
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    console.error('[ErrorBoundary] Unhandled render error:', error, errorInfo);
    void logErrorToSupabase({ scope: this.props.scope, error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });

    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          background: 'linear-gradient(180deg, #f5f5f7 0%, #e9ecf3 100%)',
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 520, borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
            <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 700, color: '#1d1d1f' }}>
              Something went wrong
            </Typography>
            <Typography sx={{ mt: 1, color: '#6e6e73' }}>
              An unexpected error occurred while rendering this page.
            </Typography>
            <Typography sx={{ mt: 0.8, color: '#6e6e73', fontSize: '0.875rem' }}>
              Support: {this.state.supportEmail}
            </Typography>
            <Button
              type="button"
              variant="contained"
              onClick={this.handleRetry}
              sx={{ mt: 3, px: 3, borderRadius: 2, textTransform: 'none' }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }
}

export const RouteErrorBoundary = ({ scope, children }) => (
  <GlobalErrorBoundary scope={scope}>{children}</GlobalErrorBoundary>
);

export default GlobalErrorBoundary;
