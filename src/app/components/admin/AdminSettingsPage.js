import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CardHeader, Divider, FormControlLabel, Grid, Switch, TextField, Typography } from '@mui/material';
import { getSystemSettings, saveSystemSettings } from '../../lib/academicDataApi';

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState({
    allow_google_student: true,
    allow_google_faculty: true,
    allow_password_admin: true,
    enforce_active_user_access: true,
    maintenance_mode: false,
    support_contact: 'admin@university.edu',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const rows = await getSystemSettings();
        setSettings((prev) => ({ ...prev, ...rows }));
      } catch (error) {
        console.error('Failed to load system settings:', error);
        setMessage({ type: 'error', text: error?.message || 'Failed to load settings.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleToggle = (key) => (_event, checked) => {
    setSettings((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await saveSystemSettings(settings);
      setMessage({ type: 'success', text: 'Settings updated successfully.' });
    } catch (error) {
      console.error('Failed to save system settings:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
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

      {message.text && (
        <Alert severity={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
      )}

      <Card sx={glassCardSx}>
        <CardHeader title="Authentication Settings" />
        <CardContent>
          <Typography sx={{ color: '#4b5563', fontSize: '0.925rem', mb: 2.5 }}>
            Configure access rules, security policies, and integrations.
          </Typography>

          {isLoading && (
            <Typography sx={{ color: '#6b7280', fontSize: '0.875rem', mb: 2 }}>Loading settings...</Typography>
          )}

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={Boolean(settings.allow_google_student)} onChange={handleToggle('allow_google_student')} />}
                label="Allow Google login for Students"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={Boolean(settings.allow_google_faculty)} onChange={handleToggle('allow_google_faculty')} />}
                label="Allow Google login for Faculty"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={Boolean(settings.allow_password_admin)} onChange={handleToggle('allow_password_admin')} />}
                label="Allow password login for Admin"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={Boolean(settings.enforce_active_user_access)} onChange={handleToggle('enforce_active_user_access')} />}
                label="Enforce active-user access control"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={Boolean(settings.maintenance_mode)} onChange={handleToggle('maintenance_mode')} />}
                label="Maintenance mode"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <TextField
                fullWidth
                label="Support Contact"
                value={settings.support_contact || ''}
                onChange={(event) => setSettings((prev) => ({ ...prev, support_contact: event.target.value }))}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isSaving}
              sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminSettingsPage;
