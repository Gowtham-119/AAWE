import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import GoogleIcon from '@mui/icons-material/Google';
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext.js';

const LoginPage = () => {
  const { login, loginWithGoogle, maintenanceMode, maintenanceMessage } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [selectedMode, setSelectedMode] = useState('admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  const isAdmin = selectedMode === 'admin';

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      return;
    }

    setLoginError('');
    setIsSubmitting(true);

    try {
      await login(username, password, 'admin');
    } catch (error) {
      setLoginError(error?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isAdmin) return;

    setLoginError('');
    setIsSubmitting(true);

    try {
      await loginWithGoogle('faculty-student');
    } catch (error) {
      setLoginError(error?.message || 'Google sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modes = [
    { value: 'admin', label: 'Admin' },
    { value: 'faculty-student', label: 'Faculty / Student' },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f5f5f7 0%, #e9ecf3 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 },
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          animation: 'fadeInUp 0.3s ease',
          '@keyframes fadeInUp': {
            from: { opacity: 0, transform: 'translateY(16px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        <Card
          sx={{
            width: '100%',
            borderRadius: '24px',
            backdropFilter: 'blur(25px)',
            background: 'rgba(255,255,255,0.75)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
        >
          <CardContent sx={{ p: { xs: 4, md: 5.5 } }}>
            <Stack component="form" onSubmit={handleLogin} spacing={2.2}>
              <Box>
                <Box
                  sx={{
                    mx: 'auto',
                    width: 64,
                    height: 64,
                    borderRadius: '999px',
                    background: 'linear-gradient(145deg, #0a84ff, #007AFF)',
                    boxShadow: '0 16px 36px rgba(0,122,255,0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1.5,
                  }}
                >
                  <GraduationCap size={34} color="#ffffff" />
                </Box>
                <Typography sx={{ fontSize: { xs: '2rem', md: '2.25rem' }, textAlign: 'center', fontWeight: 700, color: '#1d1d1f', lineHeight: 1.1 }}>
                  AAWE
                </Typography>
                <Typography sx={{ textAlign: 'center', color: '#6e6e73', mt: 0.4 }}>
                  Automated Academic Workflow Engine
                </Typography>
                <Typography sx={{ fontSize: '28px', textAlign: 'center', fontWeight: 600, color: '#1d1d1f', lineHeight: 1.2, mt: 2.2 }}>
                  Welcome Back
                </Typography>
                <Typography sx={{ textAlign: 'center', color: '#6e6e73', mt: 0.65 }}>
                  Secure sign in to continue
                </Typography>
              </Box>

              <Box
                sx={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 0.5,
                  p: '4px',
                  borderRadius: '16px',
                  backgroundColor: '#f2f2f7',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    left: selectedMode === 'admin' ? 4 : 'calc(50% + 0px)',
                    width: 'calc(50% - 4px)',
                    height: 'calc(100% - 8px)',
                    borderRadius: '12px',
                    backgroundColor: '#fff',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.10)',
                    transition: 'left 0.25s ease',
                    zIndex: 0,
                  }}
                />

                {modes.map((mode) => {
                  const isActive = selectedMode === mode.value;
                  return (
                    <Button
                      key={mode.value}
                      type="button"
                      onClick={() => {
                        setSelectedMode(mode.value);
                        setLoginError('');
                      }}
                      disableElevation
                      sx={{
                        zIndex: 1,
                        minHeight: 40,
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: isActive ? '#007AFF' : '#6e6e73',
                        backgroundColor: isActive ? '#ffffff' : 'transparent',
                        boxShadow: isActive ? '0 3px 12px rgba(0,0,0,0.10)' : 'none',
                        transition: 'all 0.25s ease',
                        '&:hover': {
                          backgroundColor: isActive ? '#ffffff' : 'rgba(255,255,255,0.65)',
                        },
                      }}
                    >
                      {mode.label}
                    </Button>
                  );
                })}
              </Box>

              {isAdmin && (
                <>
                  <TextField
                    label="Username"
                    id="username"
                    placeholder="Enter admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    fullWidth
                    sx={{
                      transition: 'all 0.3s ease',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '16px',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        transition: 'all 0.3s ease',
                        '& fieldset': { borderColor: 'rgba(0,0,0,0.10)' },
                        '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.16)' },
                        '&.Mui-focused fieldset': { borderColor: '#007AFF', boxShadow: '0 0 0 4px rgba(0,122,255,0.12)' },
                      },
                    }}
                  />

                  <TextField
                    label="Password"
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                    sx={{
                      transition: 'all 0.3s ease',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '16px',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        transition: 'all 0.3s ease',
                        '& fieldset': { borderColor: 'rgba(0,0,0,0.10)' },
                        '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.16)' },
                        '&.Mui-focused fieldset': { borderColor: '#007AFF', boxShadow: '0 0 0 4px rgba(0,122,255,0.12)' },
                      },
                    }}
                  />

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    variant="contained"
                    fullWidth
                    sx={{
                      height: 52,
                      borderRadius: '16px',
                      textTransform: 'none',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #007AFF, #005FCC)',
                      boxShadow: '0 10px 24px rgba(0,122,255,0.32)',
                      transition: 'all 0.3s ease',
                      '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 14px 28px rgba(0,122,255,0.36)' },
                    }}
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                  </Button>
                </>
              )}

              {!isAdmin && (
                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting || maintenanceMode}
                  variant="outlined"
                  fullWidth
                  startIcon={<GoogleIcon />}
                  sx={{
                    height: 52,
                    borderRadius: '16px',
                    textTransform: 'none',
                    fontWeight: 500,
                    color: '#1d1d1f',
                    borderColor: 'rgba(0,0,0,0.12)',
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'rgba(0,0,0,0.2)',
                      backgroundColor: '#ffffff',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  {maintenanceMode ? 'Under Maintenance' : isSubmitting ? 'Opening Google sign-in...' : 'Continue with Google'}
                </Button>
              )}

              {maintenanceMode && (
                <Typography sx={{ fontSize: '0.875rem', color: '#dc2626', textAlign: 'center' }}>
                  {maintenanceMessage || 'System is under maintenance. Please try again later.'}
                </Typography>
              )}

              {!isAdmin && (
                <Typography sx={{ fontSize: '0.75rem', color: '#8e8e93', textAlign: 'center', mt: 0.5 }}>
                  Your role will be automatically mapped based on your registered faculty or student email.
                </Typography>
              )}

              {loginError && (
                <Typography sx={{ fontSize: '0.875rem', color: '#dc2626', textAlign: 'center' }}>
                  {loginError}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default LoginPage;
