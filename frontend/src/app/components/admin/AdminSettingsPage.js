import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, CardHeader, Chip, Divider, FormControlLabel, Grid, Switch, TextField, Typography } from '@mui/material';
import { getSystemSettings, saveSystemSettings } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { STATIC_STALE_TIME_MS } from '../../lib/queryClient';
import { toast } from 'sonner';
import { useThemeMode } from '../../context/ThemeModeContext.js';

const SAVE_DEBOUNCE_MS = 700;

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
};

const AdminSettingsPage = () => {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    maintenance_mode: false,
    current_semester: '2024-ODD',
    allow_student_self_register: true,
    max_attendance_edit_days: 7,
    institution_name: 'AAWE',
    support_email: 'admin@university.edu',
  });
  const [saveStatusByKey, setSaveStatusByKey] = useState({});
  const debounceTimersRef = useRef({});

  const { data: loadedSettings, isLoading } = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: getSystemSettings,
    staleTime: STATIC_STALE_TIME_MS,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: ({ key, value }) => saveSystemSettings({ [key]: value }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings() });
      setSaveStatusByKey((prev) => ({ ...prev, [variables.key]: 'saved' }));
    },
    onError: (error, variables) => {
      console.error('Failed to save system settings:', error);
      setSaveStatusByKey((prev) => ({ ...prev, [variables.key]: 'error' }));
      toast.error(error?.message || `Failed to save ${variables.key}.`);
    },
  });

  useEffect(() => {
    if (!loadedSettings) return;

    setSettings((prev) => ({
      ...prev,
      maintenance_mode: parseBoolean(loadedSettings.maintenance_mode, prev.maintenance_mode),
      current_semester: String(loadedSettings.current_semester || prev.current_semester),
      allow_student_self_register: parseBoolean(loadedSettings.allow_student_self_register, prev.allow_student_self_register),
      max_attendance_edit_days: parseNumber(loadedSettings.max_attendance_edit_days, prev.max_attendance_edit_days),
      institution_name: String(loadedSettings.institution_name || prev.institution_name),
      support_email: String(loadedSettings.support_email || loadedSettings.support_contact || prev.support_email),
    }));
  }, [loadedSettings]);

  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  const debouncedSave = (key, value) => {
    if (debounceTimersRef.current[key]) {
      window.clearTimeout(debounceTimersRef.current[key]);
    }

    setSaveStatusByKey((prev) => ({ ...prev, [key]: 'saving' }));
    debounceTimersRef.current[key] = window.setTimeout(() => {
      void saveSettingsMutation.mutateAsync({ key, value });
    }, SAVE_DEBOUNCE_MS);
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    debouncedSave(key, value);
  };

  const renderStatus = (key) => {
    const status = saveStatusByKey[key] || 'idle';
    if (status === 'saving') {
      return <Chip size="small" label="Saving..." sx={{ ml: 1, height: 22 }} />;
    }
    if (status === 'saved') {
      return <Chip size="small" label="Saved ✓" color="success" sx={{ ml: 1, height: 22 }} />;
    }
    if (status === 'error') {
      return <Chip size="small" label="Save failed" color="error" sx={{ ml: 1, height: 22 }} />;
    }
    return null;
  };

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Settings</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>System configuration and preferences</Typography>
      </Box>

      <Card sx={glassCardSx}>
        <CardHeader title="Authentication Settings" />
        <CardContent>
          <Typography sx={{ color: '#4b5563', fontSize: '0.925rem', mb: 2.5 }}>
            Configure runtime settings. Changes are auto-saved.
          </Typography>

          {isLoading && (
            <Typography sx={{ color: '#6b7280', fontSize: '0.875rem', mb: 2 }}>Loading settings...</Typography>
          )}

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={Boolean(settings.maintenance_mode)} onChange={(_event, checked) => updateSetting('maintenance_mode', checked)} />}
                label={<Box sx={{ display: 'inline-flex', alignItems: 'center' }}>Maintenance mode {renderStatus('maintenance_mode')}</Box>}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={themeMode === 'dark'} onChange={toggleThemeMode} />}
                label="Dark Mode (saved as personal preference)"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 500 }}>Current Semester</Typography>
                {renderStatus('current_semester')}
              </Box>
              <TextField
                fullWidth
                label="Current Semester"
                helperText="Used as active semester filter in queries"
                value={settings.current_semester || ''}
                onChange={(event) => updateSetting('current_semester', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={Boolean(settings.allow_student_self_register)} onChange={(_event, checked) => updateSetting('allow_student_self_register', checked)} />}
                label={<Box sx={{ display: 'inline-flex', alignItems: 'center' }}>Allow Student Self Register (Google) {renderStatus('allow_student_self_register')}</Box>}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 500 }}>Max Attendance Edit Days</Typography>
                {renderStatus('max_attendance_edit_days')}
              </Box>
              <TextField
                fullWidth
                type="number"
                inputProps={{ min: 0, max: 60 }}
                label="Max Attendance Edit Days"
                helperText="Faculty can edit past attendance up to this limit"
                value={settings.max_attendance_edit_days}
                onChange={(event) => updateSetting('max_attendance_edit_days', Math.max(0, Number(event.target.value || 0)))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 500 }}>Institution Name</Typography>
                {renderStatus('institution_name')}
              </Box>
              <TextField
                fullWidth
                label="Institution Name"
                helperText="Shown in Navbar and login header"
                value={settings.institution_name || ''}
                onChange={(event) => updateSetting('institution_name', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 500 }}>Support Email</Typography>
                {renderStatus('support_email')}
              </Box>
              <TextField
                fullWidth
                label="Support Email"
                helperText="Shown on maintenance and error pages"
                value={settings.support_email || ''}
                onChange={(event) => updateSetting('support_email', event.target.value)}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />
          <Typography sx={{ color: '#6b7280', fontSize: '0.82rem' }}>
            Changes are saved automatically after a short pause.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminSettingsPage;
