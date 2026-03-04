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
  Grid,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getStudentProfileByEmail, updateStudentProfileByEmail } from '../../lib/academicDataApi';

const StudentProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    registerNo: '',
    email: user?.email || '',
    mobileNo: '',
    department: '',
  });
  const [originalEmail, setOriginalEmail] = useState(user?.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProfile, setEditProfile] = useState({
    name: '',
    registerNo: '',
    email: '',
    mobileNo: '',
    department: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) return;

      setIsLoading(true);
      setMessage({ type: '', text: '' });

      try {
        const row = await getStudentProfileByEmail(user.email);

        if (!row) {
          setProfile((prev) => ({ ...prev, email: user.email }));
          setOriginalEmail(user.email);
          return;
        }

        setProfile({
          name: row.name || '',
          registerNo: row.registerNo || '',
          email: row.email || user.email,
          mobileNo: row.mobileNo || '',
          department: row.department || '',
        });
        setOriginalEmail(row.email || user.email);
      } catch (error) {
        console.error('Failed to load student profile:', error);
        setMessage({ type: 'error', text: error?.message || 'Failed to load student profile.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user?.email]);

  const initials = useMemo(() => {
    const name = (profile.name || '').trim();
    if (!name) return 'S';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile.name]);

  const handleEditChange = (field) => (event) => {
    setEditProfile((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleOpenEditModal = () => {
    setEditProfile({
      name: profile.name,
      registerNo: profile.registerNo,
      email: profile.email,
      mobileNo: profile.mobileNo,
      department: profile.department,
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    if (isSaving) return;
    setIsEditModalOpen(false);
  };

  const handleSave = async () => {
    setMessage({ type: '', text: '' });

    if (!editProfile.registerNo.trim()) {
      setMessage({ type: 'error', text: 'Register number is required.' });
      return;
    }

    if (!editProfile.email.trim()) {
      setMessage({ type: 'error', text: 'Email is required.' });
      return;
    }

    if (!editProfile.mobileNo.trim()) {
      setMessage({ type: 'error', text: 'Mobile number is required.' });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateStudentProfileByEmail({
        currentEmail: originalEmail,
        registerNo: editProfile.registerNo,
        name: editProfile.name,
        email: editProfile.email,
        mobileNo: editProfile.mobileNo,
        department: editProfile.department,
      });

      setProfile((prev) => ({
        ...prev,
        name: updated.name,
        registerNo: updated.registerNo,
        email: updated.email,
        mobileNo: updated.mobileNo,
        department: updated.department,
      }));
      setOriginalEmail(updated.email);
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Failed to update student profile:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Profile</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>View and update your profile</Typography>
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
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#111827' }}>{profile.name || 'Student'}</Typography>
              <Typography sx={{ color: '#6b7280', mt: 0.5 }}>{profile.registerNo || 'N/A'}</Typography>
              <Chip
                size="small"
                label={profile.department || 'Department'}
                sx={{ mt: 1.5, backgroundColor: '#dbeafe', color: '#1d4ed8' }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title="Student Information"
              action={(
                <IconButton
                  aria-label="Edit profile"
                  onClick={handleOpenEditModal}
                  disabled={isLoading}
                  size="small"
                >
                  <Pencil size={16} />
                </IconButton>
              )}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Register Number</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.registerNo || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Mobile</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.mobileNo || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Email</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.email || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Name</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.name || 'N/A'}</Typography>
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

      <Dialog open={isEditModalOpen} onClose={handleCloseEditModal} fullWidth maxWidth="sm">
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Register Number"
                value={editProfile.registerNo}
                onChange={handleEditChange('registerNo')}
                disabled={isSaving}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Mobile"
                value={editProfile.mobileNo}
                onChange={handleEditChange('mobileNo')}
                disabled={isSaving}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="email"
                label="Email"
                value={editProfile.email}
                onChange={handleEditChange('email')}
                disabled={isSaving}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Name"
                value={editProfile.name}
                onChange={handleEditChange('name')}
                disabled={isSaving}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Department"
                value={editProfile.department}
                onChange={handleEditChange('department')}
                disabled={isSaving}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleCloseEditModal} disabled={isSaving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving}
            sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
          >
            {isSaving ? 'Updating...' : 'Update Profile'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentProfilePage;