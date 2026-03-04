import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const GOOGLE_POPUP_SUCCESS = 'google-oauth-success';
const GOOGLE_POPUP_ERROR = 'google-oauth-error';

const ROLE_DISPLAY_NAMES = {
  admin: 'Admin User',
  faculty: 'Dr. Sarah Johnson',
  student: 'Alex Thompson',
};

const EMAIL_ROLE_OVERRIDES = {
  'gowtham25m@gmail.com': 'faculty',
};

const resolveProfile = async (authUser) => {
  if (!authUser?.email) {
    return { role: null, name: null, department: null };
  }

  const normalizedEmail = authUser.email.toLowerCase();
  const forcedRole = EMAIL_ROLE_OVERRIDES[normalizedEmail] || null;

  const metadataRole = authUser.user_metadata?.role || authUser.app_metadata?.role || null;
  const metadataName = authUser.user_metadata?.name || authUser.user_metadata?.full_name || null;

  let profileRole = null;
  let profileName = null;
  let profileDepartment = null;
  let usersTableRole = null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role, display_name, department')
    .eq('email', authUser.email)
    .maybeSingle();

  if (!error && data) {
    profileRole = data.role || null;
    profileName = data.display_name || null;
    profileDepartment = data.department || null;
  }

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('role')
    .eq('email', authUser.email)
    .maybeSingle();

  if (!usersError && usersData) {
    usersTableRole = usersData.role || null;
  }

  return {
    role: forcedRole || usersTableRole || profileRole || metadataRole,
    name: profileName || metadataName,
    department: profileDepartment,
  };
};

const resolveAdminIdentifierToEmail = async (identifier) => {
  const normalized = (identifier || '').trim();
  if (!normalized) return '';

  if (normalized.toLowerCase() === 'admin') {
    return 'admin@university.edu';
  }

  if (normalized.includes('@')) {
    return normalized.toLowerCase();
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('role', 'admin')
    .ilike('display_name', normalized)
    .maybeSingle();

  if (!error && data?.email) {
    return (data.email || '').trim().toLowerCase();
  }

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'admin')
    .ilike('email', `${normalized}%`)
    .limit(1)
    .maybeSingle();

  if (usersError) {
    return '';
  }

  return (usersData?.email || '').trim().toLowerCase();
};

const inferRoleFromEmail = (email) => {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized.includes('faculty') ||
    normalized.includes('staff') ||
    normalized.startsWith('dr.') ||
    normalized.startsWith('dr')
  ) {
    return 'faculty';
  }

  return 'student';
};

const buildUser = async (authUser, fallbackRole = null) => {
  if (!authUser) return null;

  const { role, name, department } = await resolveProfile(authUser);
  const normalizedRole = role || fallbackRole || 'student';

  const { data: usersRow } = await supabase
    .from('users')
    .select('is_active, login_count, last_login_at')
    .eq('email', authUser.email)
    .maybeSingle();

  return {
    id: authUser.id,
    email: authUser.email,
    role: normalizedRole,
    name: name || ROLE_DISPLAY_NAMES[normalizedRole] || 'User',
    department: (department || '').trim().toUpperCase() || null,
    isActive: usersRow?.is_active !== false,
    loginCount: Number(usersRow?.login_count || 0),
    lastLoginAt: usersRow?.last_login_at || null,
  };
};

const recordLoginSuccess = async ({ email, role }) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return;

  const nowIso = new Date().toISOString();

  const { data: existingRow } = await supabase
    .from('users')
    .select('email, login_count, is_active')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!existingRow) {
    await supabase.from('users').upsert(
      [{
        email: normalizedEmail,
        role: (role || 'student').toLowerCase(),
        is_active: true,
        login_count: 1,
        last_login_at: nowIso,
      }],
      { onConflict: 'email' }
    );
    return;
  }

  if (existingRow.is_active === false) {
    throw new Error('Access disabled. Please contact administrator.');
  }

  await supabase
    .from('users')
    .update({
      role: (role || 'student').toLowerCase(),
      login_count: Number(existingRow.login_count || 0) + 1,
      last_login_at: nowIso,
      updated_at: nowIso,
    })
    .eq('email', normalizedEmail);
};

const parseAuthErrorFromUrl = () => {
  if (typeof window === 'undefined') return null;

  const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search || '');

  return (
    hashParams.get('error_description') ||
    hashParams.get('error') ||
    searchParams.get('error_description') ||
    searchParams.get('error') ||
    null
  );
};

const openCenteredPopup = (url) => {
  const width = 500;
  const height = 680;
  const left = Math.max(0, Math.floor(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.floor(window.screenY + (window.outerHeight - height) / 2));

  return window.open(
    url,
    'google-sign-in',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('System is under maintenance. Please try again later.');

  const fetchMaintenanceStatus = async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['maintenance_mode', 'maintenance_message', 'support_contact']);

    if (error) {
      return {
        enabled: false,
        message: 'System is under maintenance. Please try again later.',
      };
    }

    const settingsMap = new Map((data || []).map((row) => [row.setting_key, row.setting_value]));
    const enabled = Boolean(settingsMap.get('maintenance_mode'));
    const configuredMessage = settingsMap.get('maintenance_message');
    const supportContact = settingsMap.get('support_contact');

    const message = configuredMessage
      ? String(configuredMessage)
      : supportContact
        ? `System is under maintenance. Please contact ${supportContact}.`
        : 'System is under maintenance. Please try again later.';

    return { enabled, message };
  };

  const enforceMaintenanceGate = async (expectedRole) => {
    const status = await fetchMaintenanceStatus();
    setMaintenanceMode(status.enabled);
    setMaintenanceMessage(status.message);

    const normalizedRole = (expectedRole || '').trim().toLowerCase();
    if (status.enabled && normalizedRole !== 'admin') {
      throw new Error(status.message || 'System is under maintenance.');
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const maintenance = await fetchMaintenanceStatus();
      if (isMounted) {
        setMaintenanceMode(maintenance.enabled);
        setMaintenanceMessage(maintenance.message);
      }

      const authError = parseAuthErrorFromUrl();
      const isPopup = typeof window !== 'undefined' && window.opener && window.opener !== window;

      if (isPopup && authError) {
        window.opener.postMessage({ type: GOOGLE_POPUP_ERROR, message: authError }, window.location.origin);
        window.close();
        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionUser = await buildUser(data.session?.user || null);

      if (isPopup && sessionUser) {
        window.opener.postMessage({ type: GOOGLE_POPUP_SUCCESS }, window.location.origin);
        window.close();
        return;
      }

      if (isMounted) {
        setUser(sessionUser);
        setAuthLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        const sessionUser = await buildUser(session?.user || null);
        if (isMounted) {
          setUser(sessionUser);
        }
      })();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password, expectedRole) => {
    await enforceMaintenanceGate(expectedRole);

    const normalizedRole = (expectedRole || '').trim().toLowerCase();

    const credentialEmail = normalizedRole === 'admin'
      ? await resolveAdminIdentifierToEmail(email)
      : (email || '').trim().toLowerCase();

    if (!credentialEmail) {
      throw new Error('Invalid admin username.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: credentialEmail, password });

    if (error) {
      throw new Error(error.message);
    }

    const resolvedUser = await buildUser(data.user || null, expectedRole || null);

    if (resolvedUser?.isActive === false) {
      await supabase.auth.signOut();
      throw new Error('Access disabled. Please contact administrator.');
    }

    if (normalizedRole && resolvedUser?.role !== normalizedRole) {
      await supabase.auth.signOut();
      throw new Error('Role mismatch. Please use the correct login method.');
    }

    await recordLoginSuccess({ email: resolvedUser?.email, role: resolvedUser?.role });

    setUser(resolvedUser);
    return resolvedUser;
  };

  const loginWithGoogle = async (expectedRole) => {
    await enforceMaintenanceGate(expectedRole);

    const normalizedRole = (expectedRole || '').trim().toLowerCase();
    const isCombinedFacultyStudentMode = normalizedRole === 'faculty-student';

    if (!isCombinedFacultyStudentMode && !['student', 'faculty'].includes(normalizedRole)) {
      throw new Error('Google login is only available for faculty/student.');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.url) {
      throw new Error('Unable to start Google sign-in.');
    }

    const popup = openCenteredPopup(data.url);
    if (!popup) {
      throw new Error('Popup was blocked. Please allow popups and try again.');
    }

    const resolveGoogleSessionUser = async (sessionUser) => {
      if (!sessionUser) {
        return { ok: false };
      }

      let resolvedUser = await buildUser(sessionUser || null);

      if (isCombinedFacultyStudentMode && (!resolvedUser?.role || resolvedUser.role === 'admin')) {
        const inferredRole = inferRoleFromEmail(resolvedUser?.email || sessionUser?.email || '');
        resolvedUser = {
          ...resolvedUser,
          role: inferredRole || resolvedUser?.role || 'student',
        };
      }

      if (!resolvedUser?.role) {
        await supabase.auth.signOut();
        return { ok: false, error: 'No role found for this email in users table.' };
      }

      if (resolvedUser?.isActive === false) {
        await supabase.auth.signOut();
        return { ok: false, error: 'Access disabled. Please contact administrator.' };
      }

      if (isCombinedFacultyStudentMode && !['faculty', 'student'].includes(resolvedUser.role)) {
        await supabase.auth.signOut();
        return { ok: false, error: 'This account is not mapped as faculty/student.' };
      }

      if (!isCombinedFacultyStudentMode && resolvedUser.role !== normalizedRole) {
        await supabase.auth.signOut();
        return { ok: false, error: `This account is mapped as ${resolvedUser.role}. Select the correct role to continue.` };
      }

      try {
        await recordLoginSuccess({ email: resolvedUser?.email, role: resolvedUser?.role });
        setUser(resolvedUser);
        return { ok: true };
      } catch (recordError) {
        await supabase.auth.signOut();
        return { ok: false, error: recordError?.message || 'Failed to update login activity.' };
      }
    };

    await new Promise((resolve, reject) => {
      let finished = false;
      let popupClosedAt = null;

      const {
        data: { subscription: oauthSubscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        void (async () => {
          if (!session?.user) return;
          const resolution = await resolveGoogleSessionUser(session.user);
          if (!resolution.ok) {
            settle(() => reject(new Error(resolution.error || 'Google sign-in failed.')));
            return;
          }
          settle(resolve);
        })();
      });

      const cleanup = () => {
        window.removeEventListener('message', handleMessage);
        window.clearInterval(closedWatcher);
        window.clearTimeout(timeout);
        oauthSubscription.unsubscribe();
      };

      const settle = (cb) => {
        if (finished) return;
        finished = true;
        cleanup();
        cb();
      };

      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === GOOGLE_POPUP_ERROR) {
          settle(() => reject(new Error(event.data?.message || 'Google sign-in failed.')));
          return;
        }

        if (event.data?.type === GOOGLE_POPUP_SUCCESS) {
          const { data: sessionData } = await supabase.auth.getSession();
          const resolution = await resolveGoogleSessionUser(sessionData.session?.user || null);
          if (!resolution.ok) {
            settle(() => reject(new Error(resolution.error || 'Google sign-in failed.')));
            return;
          }
          settle(resolve);
        }
      };

      const closedWatcher = window.setInterval(async () => {
        if (!popup || popup.closed) {
          if (!popupClosedAt) {
            popupClosedAt = Date.now();
          }

          const { data: sessionData } = await supabase.auth.getSession();
          const resolution = await resolveGoogleSessionUser(sessionData.session?.user || null);
          if (resolution.ok) {
            settle(resolve);
            return;
          }

          if (Date.now() - popupClosedAt < 8000) {
            return;
          }

          settle(() => reject(new Error('Google sign-in was cancelled or redirect URL is not configured.')));
        }
      }, 400);

      const timeout = window.setTimeout(() => {
        try {
          popup.close();
        } catch {
          // noop
        }
        settle(() => reject(new Error('Google sign-in timed out. Please try again.')));
      }, 180000);

      window.addEventListener('message', handleMessage);
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, authLoading, login, loginWithGoogle, logout, maintenanceMode, maintenanceMessage }),
    [user, authLoading, maintenanceMode, maintenanceMessage]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
