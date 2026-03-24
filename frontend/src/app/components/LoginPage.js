import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import GoogleIcon from '@mui/icons-material/Google';
import { Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { getRoleDefaultPath } from '../lib/routing.js';
import { supabase } from '../lib/supabaseClient.js';

const FAILED_ATTEMPTS_STORAGE_KEY = 'aawe.auth.failedAttempts';
const MAX_FAILED_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 30;

const readFailedAttemptsState = () => {
  try {
    const raw = window.localStorage.getItem(FAILED_ATTEMPTS_STORAGE_KEY);
    if (!raw) return { count: 0, cooldownUntil: 0 };

    const parsed = JSON.parse(raw);
    const count = Number(parsed?.count || 0);
    const cooldownUntil = Number(parsed?.cooldownUntil || 0);

    if (!Number.isFinite(count) || !Number.isFinite(cooldownUntil)) {
      return { count: 0, cooldownUntil: 0 };
    }

    return { count: Math.max(0, count), cooldownUntil: Math.max(0, cooldownUntil) };
  } catch {
    return { count: 0, cooldownUntil: 0 };
  }
};

const persistFailedAttemptsState = (state) => {
  window.localStorage.setItem(FAILED_ATTEMPTS_STORAGE_KEY, JSON.stringify(state));
};

const isStrongAdminPassword = (value) => {
  const password = String(value || '');
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial;
};

const LoginPage = () => {
  const { login, loginWithGoogle, maintenanceMode, maintenanceMessage, institutionName, supportEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedMode, setSelectedMode] = useState('admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const isAdmin = selectedMode === 'admin';
  const cooldownRemainingSeconds = useMemo(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));
  }, [cooldownUntil, nowTick]);
  const isCooldownActive = isAdmin && cooldownRemainingSeconds > 0;

  useEffect(() => {
    const { count, cooldownUntil: restoredCooldownUntil } = readFailedAttemptsState();
    setFailedAttempts(count);
    setCooldownUntil(restoredCooldownUntil);
    setNowTick(Date.now());
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return undefined;

    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil && Date.now() >= cooldownUntil) {
      setCooldownUntil(0);
      persistFailedAttemptsState({ count: failedAttempts, cooldownUntil: 0 });
    }
  }, [cooldownUntil, failedAttempts]);

  const getPostLoginTarget = (role) => {
    const from = location.state?.from;

    if (from?.pathname && from.pathname !== '/login') {
      const search = from.search || '';
      const hash = from.hash || '';
      return `${from.pathname}${search}${hash}`;
    }

    return getRoleDefaultPath(role);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      return;
    }

    if (isCooldownActive) {
      setLoginError(`Too many failed attempts. Try again in ${cooldownRemainingSeconds}s.`);
      return;
    }

    if (!isStrongAdminPassword(password)) {
      setLoginError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }

    setLoginError('');
    setIsSubmitting(true);

    try {
      const resolvedUser = await login(username, password, 'admin');
      setFailedAttempts(0);
      setCooldownUntil(0);
      persistFailedAttemptsState({ count: 0, cooldownUntil: 0 });
      navigate(getPostLoginTarget(resolvedUser?.role), { replace: true });
    } catch (error) {
      const nextFailedAttempts = failedAttempts + 1;
      const nextCooldownUntil = nextFailedAttempts >= MAX_FAILED_ATTEMPTS
        ? Date.now() + (COOLDOWN_SECONDS * 1000)
        : 0;

      setFailedAttempts(nextFailedAttempts);
      setCooldownUntil(nextCooldownUntil);
      persistFailedAttemptsState({ count: nextFailedAttempts, cooldownUntil: nextCooldownUntil });

      if (nextCooldownUntil > 0) {
        setLoginError(`Too many failed attempts. Try again in ${COOLDOWN_SECONDS}s.`);
      } else {
        const rawError = String(error?.message || '').toLowerCase();
        if (rawError.includes('access disabled') || rawError.includes('disabled')) {
          setLoginError('Account disabled - contact admin');
        } else if (rawError.includes('invalid admin username') || rawError.includes('no role found')) {
          setLoginError('No account found');
        } else if (rawError.includes('invalid login credentials') || rawError.includes('invalid_credentials')) {
          setLoginError('Incorrect password');
        } else {
          setLoginError(error?.message || 'Login failed. Please check your credentials.');
        }
      }
      return;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = (username || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setLoginError('Enter your admin email to reset password.');
      return;
    }

    setIsResettingPassword(true);
    setLoginError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setLoginError('Password reset link sent. Check your email inbox.');
    } catch (error) {
      setLoginError(error?.message || 'Unable to send reset password email.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isAdmin) return;

    setLoginError('');
    setIsSubmitting(true);

    try {
      const resolvedUser = await loginWithGoogle('faculty-student');
      navigate(getPostLoginTarget(resolvedUser?.role), { replace: true });
    } catch (error) {
      setLoginError(error?.message || 'Google sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modes = [
    { value: 'admin', label: 'Admin Login' },
    { value: 'faculty-student', label: 'Faculty / Student Login' },
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
                <Typography sx={{ textAlign: 'center', color: '#6e6e73', mb: 1.1, fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.02em' }}>
                  {institutionName || 'AAWE'}
                </Typography>
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

              <Box
                key={selectedMode}
                sx={{
                  animation: 'modeFadeSlide 0.24s ease',
                  '@keyframes modeFadeSlide': {
                    from: { opacity: 0, transform: 'translateY(8px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
              {isAdmin && (
                <Stack spacing={2.2}>
                  <TextField
                    label="Username"
                    id="username"
                    placeholder="Enter admin email"
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
                    disabled={isSubmitting || isCooldownActive}
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
                    {isSubmitting ? 'Signing in...' : isCooldownActive ? `Try again in ${cooldownRemainingSeconds}s` : 'Sign In'}
                  </Button>

                  {isCooldownActive && (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#b45309', textAlign: 'center' }}>
                      Too many failed attempts. Please wait {cooldownRemainingSeconds}s before retrying.
                    </Typography>
                  )}

                  <Box sx={{ textAlign: 'right', mt: -0.75 }}>
                    <Link
                      component="button"
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isResettingPassword}
                      underline="hover"
                      sx={{ fontSize: '0.82rem' }}
                    >
                      {isResettingPassword ? 'Sending reset link...' : 'Forgot Password?'}
                    </Link>
                  </Box>
                </Stack>
              )}

              {!isAdmin && (
                <Stack spacing={1.25}>
                  <Typography sx={{ fontSize: '0.85rem', color: '#475569', textAlign: 'center' }}>
                    Sign in with your registered faculty or student Google account.
                  </Typography>
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
                </Stack>
              )}
              </Box>

              {maintenanceMode && (
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#dc2626', textAlign: 'center' }}>
                    {maintenanceMessage || 'System is under maintenance. Please try again later.'}
                  </Typography>
                  {!!supportEmail && (
                    <Typography sx={{ fontSize: '0.8rem', color: '#b91c1c', textAlign: 'center', mt: 0.25 }}>
                      Support: {supportEmail}
                    </Typography>
                  )}
                </Box>
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
