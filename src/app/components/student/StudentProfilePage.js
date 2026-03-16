import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
import { STATIC_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';
import { toast } from 'sonner';

const StudentProfilePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();
  const [profile, setProfile] = useState({
    name: '',
    registerNo: '',
    email: user?.email || '',
    mobileNo: '',
    department: '',
  });
  const [originalEmail, setOriginalEmail] = useState(user?.email || '');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProfile, setEditProfile] = useState({
    name: '',
    registerNo: '',
    email: '',
    mobileNo: '',
    department: '',
  });

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  const inferDepartmentFromEmail = (email) => {
    const match = (email || '').trim().toLowerCase().match(/\.([a-z]{2})\d*@/);
    return match?.[1]?.toUpperCase() || '';
  };

  const { data: profileData, isLoading } = useQuery({
    queryKey: queryKeys.student.profile(normalizedEmail),
    queryFn: () => getStudentProfileByEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: STATIC_STALE_TIME_MS,
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateStudentProfileByEmail,
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.student.profile(normalizedEmail) });
      setProfile((prev) => ({
        ...prev,
        name: updated.name,
        registerNo: updated.registerNo,
        email: updated.email,
        mobileNo: updated.mobileNo,
        department: updated.department,
      }));
      setOriginalEmail(updated.email);
      toast.success('Profile updated successfully.');
      setIsEditModalOpen(false);
    },
    onError: (error) => {
      console.error('Failed to update student profile:', error);
      toast.error(error?.message || 'Failed to update profile.');
    },
  });

  useEffect(() => {
    if (!normalizedEmail) return;

    if (!profileData) {
      setProfile((prev) => ({
        ...prev,
        email: normalizedEmail,
        department: inferDepartmentFromEmail(normalizedEmail),
      }));
      setOriginalEmail(normalizedEmail);
      return;
    }

    setProfile({
      name: profileData.name || '',
      registerNo: profileData.registerNo || '',
      email: profileData.email || normalizedEmail,
      mobileNo: profileData.mobileNo || '',
      department: profileData.department || '',
    });
    setOriginalEmail(profileData.email || normalizedEmail);
  }, [normalizedEmail, profileData]);

  useEffect(() => {
    if (!normalizedEmail) return undefined;

    const channel = supabase
      .channel(`student-profile-live-${normalizedEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.profile(normalizedEmail) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [normalizedEmail, queryClient]);

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
    if (updateProfileMutation.isPending) return;
    setIsEditModalOpen(false);
  };

  const handleSave = async () => {
    if (!editProfile.registerNo.trim()) {
      toast.error('Register number is required.');
      return;
    }

    if (!editProfile.email.trim()) {
      toast.error('Email is required.');
      return;
    }

    if (!editProfile.mobileNo.trim()) {
      toast.error('Mobile number is required.');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        currentEmail: originalEmail,
        registerNo: editProfile.registerNo,
        name: editProfile.name,
        email: editProfile.email,
        mobileNo: editProfile.mobileNo,
        department: editProfile.department,
      });
    } catch {}
  };

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' }}>Profile</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>View and update your profile</Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={glassCardSx}>
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
          <Card sx={glassCardSx}>
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
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Mobile"
                value={editProfile.mobileNo}
                onChange={handleEditChange('mobileNo')}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="email"
                label="Email"
                value={editProfile.email}
                onChange={handleEditChange('email')}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Name"
                value={editProfile.name}
                onChange={handleEditChange('name')}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Department"
                value={editProfile.department}
                onChange={handleEditChange('department')}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleCloseEditModal} disabled={updateProfileMutation.isPending} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={updateProfileMutation.isPending}
            sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
          >
            {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentProfilePage;