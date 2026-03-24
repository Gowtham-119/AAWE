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
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getFacultyProfileByEmail, updateFacultyProfileByEmail } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { STATIC_STALE_TIME_MS } from '../../lib/queryClient';
import { toast } from 'sonner';

const DEPARTMENT_OPTIONS = ['AG', 'CS', 'IT', 'ME', 'EE'];

const FacultyProfilePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({
    displayName: '',
    email: user?.email || '',
    department: '',
    phone: '',
    designation: '',
    joinedDate: '',
    completeness: 0,
  });
  const [editForm, setEditForm] = useState({
    displayName: '',
    department: '',
    phone: '',
    designation: '',
    joinedDate: '',
  });
  const [isEditOpen, setIsEditOpen] = useState(false);

  const normalizedEmail = (user?.email || '').trim().toLowerCase();

  const { data: profileData, isLoading } = useQuery({
    queryKey: queryKeys.faculty.profile(normalizedEmail),
    queryFn: () => getFacultyProfileByEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: STATIC_STALE_TIME_MS,
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateFacultyProfileByEmail,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.faculty.profile(normalizedEmail) });
      toast.success('Profile updated successfully.');
      setIsEditOpen(false);
    },
    onError: (error) => {
      console.error('Failed to update faculty profile:', error);
      toast.error(error?.message || 'Failed to update profile.');
    },
  });

  useEffect(() => {
    if (!normalizedEmail) return;

    if (!profileData) {
      setProfile({
        displayName: user?.name || 'Faculty',
        email: normalizedEmail,
        department: '',
        phone: '',
        designation: '',
        joinedDate: '',
        completeness: 20,
      });
      return;
    }

    setProfile({
      displayName: profileData.displayName || user?.name || 'Faculty',
      email: profileData.email || normalizedEmail,
      department: profileData.department || '',
      phone: profileData.phone || '',
      designation: profileData.designation || '',
      joinedDate: profileData.joinedDate || '',
      completeness: Number(profileData.completeness || 0),
    });
  }, [normalizedEmail, profileData, user?.name]);

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
    setEditForm({
      displayName: profile.displayName || '',
      department: profile.department || '',
      phone: profile.phone || '',
      designation: profile.designation || '',
      joinedDate: profile.joinedDate || '',
    });
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (updateProfileMutation.isPending) return;
    setIsEditOpen(false);
  };

  const handleSaveProfile = async () => {
    if (!editForm.department) {
      toast.error('Please select a department.');
      return;
    }

    try {
      const updated = await updateProfileMutation.mutateAsync({
        facultyEmail: profile.email,
        displayName: editForm.displayName,
        department: editForm.department,
        phone: editForm.phone,
        designation: editForm.designation,
        joinedDate: editForm.joinedDate,
      });

      setProfile((prev) => ({
        ...prev,
        displayName: updated.displayName,
        department: updated.department,
        phone: updated.phone,
        designation: updated.designation,
        joinedDate: updated.joinedDate,
        completeness: Number(updated.completeness || prev.completeness),
      }));
    } catch {}
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Faculty Profile</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>View and complete your profile information</Typography>
      </Box>

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

              <Box sx={{ mt: 2.5, width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>Profile Completeness</Typography>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827' }}>{profile.completeness}% complete</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={profile.completeness}
                  sx={{ height: 8, borderRadius: 999, backgroundColor: '#e5e7eb', '& .MuiLinearProgress-bar': { backgroundColor: profile.completeness >= 80 ? '#16a34a' : '#2563eb' } }}
                />
              </Box>
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
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Phone</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.phone || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Designation</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.designation || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Joining Date</Typography>
                  <Typography sx={{ color: '#111827', fontWeight: 500 }}>{profile.joinedDate || 'N/A'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={isEditOpen} onClose={closeEdit} fullWidth maxWidth="xs">
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0.2 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Name"
                value={editForm.displayName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, displayName: event.target.value }))}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={editForm.department}
                  label="Department"
                  onChange={(event) => setEditForm((prev) => ({ ...prev, department: event.target.value }))}
                  disabled={updateProfileMutation.isPending}
                >
                  {DEPARTMENT_OPTIONS.map((department) => (
                    <MenuItem key={department} value={department}>{department}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Phone"
                value={editForm.phone}
                onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Designation"
                value={editForm.designation}
                onChange={(event) => setEditForm((prev) => ({ ...prev, designation: event.target.value }))}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="date"
                label="Joining Date"
                value={editForm.joinedDate}
                InputLabelProps={{ shrink: true }}
                onChange={(event) => setEditForm((prev) => ({ ...prev, joinedDate: event.target.value }))}
                disabled={updateProfileMutation.isPending}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeEdit} disabled={updateProfileMutation.isPending} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
          >
            {updateProfileMutation.isPending ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FacultyProfilePage;
