import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getFacultyProfileByEmail, updateFacultyDepartmentByEmail } from '../../lib/academicDataApi';

const DEPARTMENT_OPTIONS = ['AG', 'CS', 'IT', 'ME', 'EE'];

const FacultyProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    displayName: '',
    email: user?.email || '',
    department: '',
  });
  const [editDepartment, setEditDepartment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) return;
      setIsLoading(true);
      setMessage({ type: '', text: '' });

      try {
        const row = await getFacultyProfileByEmail(user.email);

        if (!row) {
          setProfile({
            displayName: user?.name || 'Faculty',
            email: user.email,
            department: '',
          });
          setMessage({ type: 'error', text: 'Faculty profile not found.' });
          return;
        }

        setProfile({
          displayName: row.displayName || user?.name || 'Faculty',
          email: row.email || user.email,
          department: row.department || '',
        });
      } catch (error) {
        console.error('Failed to load faculty profile:', error);
        setMessage({ type: 'error', text: error?.message || 'Failed to load faculty profile.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user?.email, user?.name]);

  const initials = useMemo(() => {
    const name = (profile.displayName || '').trim();
    if (!name) return 'F';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile.displayName]);

  const openEdit = () => {
    setEditDepartment(profile.department || '');
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (isSaving) return;
    setIsEditOpen(false);
  };

  const handleSaveDepartment = async () => {
    setMessage({ type: '', text: '' });

    if (!editDepartment) {
      setMessage({ type: 'error', text: 'Please select a department.' });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateFacultyDepartmentByEmail({
        facultyEmail: profile.email,
        department: editDepartment,
      });

      setProfile((prev) => ({ ...prev, department: updated.department }));
      setMessage({ type: 'success', text: 'Department updated successfully.' });
      setIsEditOpen(false);
    } catch (error) {
      console.error('Failed to update faculty department:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to update department.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Faculty Profile</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>View and update your department</Typography>
      </Box>

      {message.text && (
        <Alert severity={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <Avatar sx={{ width: 96, height: 96, bgcolor: '#2563eb', fontSize: '2rem', mb: 2 }}>{initials}</Avatar>
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#111827' }}>{profile.displayName || 'Faculty'}</Typography>
              <Typography sx={{ color: '#6b7280', mt: 0.5 }}>{profile.email || 'N/A'}</Typography>
              <Chip
                size="small"
                label={profile.department || 'Department not set'}
                sx={{ mt: 1.5, backgroundColor: '#dbeafe', color: '#1d4ed8' }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title="Faculty Information"
              action={(
                <IconButton aria-label="Edit department" onClick={openEdit} disabled={isLoading} size="small">
                  <Pencil size={16} />
                </IconButton>
              )}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Name</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.displayName || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Email</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.email || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Department</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.department || 'N/A'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={isEditOpen} onClose={closeEdit} fullWidth maxWidth="xs">
        <DialogTitle>Update Department</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Department</InputLabel>
            <Select
              value={editDepartment}
              label="Department"
              onChange={(event) => setEditDepartment(event.target.value)}
              disabled={isSaving}
            >
              {DEPARTMENT_OPTIONS.map((department) => (
                <MenuItem key={department} value={department}>{department}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeEdit} disabled={isSaving} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveDepartment}
            disabled={isSaving}
            sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
          >
            {isSaving ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FacultyProfilePage;
