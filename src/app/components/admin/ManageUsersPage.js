import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { deleteUserByEmail, getUsersWithProfiles, updateUserAccessByEmail, upsertUserWithProfile } from '../../lib/academicDataApi';

const ManageUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingAccess, setIsTogglingAccess] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    email: '',
    role: 'student',
    displayName: '',
    department: 'NA',
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const rows = await getUsersWithProfiles();
      setUsers(rows);
    } catch (error) {
      console.error('Failed to load users:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to load users.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleOpenCreate = () => {
    setForm({ email: '', role: 'student', displayName: '', department: 'NA' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setForm({
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      department: user.department,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await upsertUserWithProfile({
        email: form.email,
        role: form.role,
        displayName: form.displayName,
        department: form.department,
      });
      setMessage({ type: 'success', text: 'User saved successfully.' });
      setIsModalOpen(false);
      await loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to save user.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (email) => {
    setIsDeleting(true);
    setMessage({ type: '', text: '' });
    try {
      await deleteUserByEmail(email);
      setMessage({ type: 'success', text: 'User deleted successfully.' });
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to delete user.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAccess = async (user) => {
    setIsTogglingAccess(true);
    setMessage({ type: '', text: '' });
    try {
      await updateUserAccessByEmail({
        email: user.email,
        isActive: !user.isActive,
      });
      setMessage({
        type: 'success',
        text: `${user.email} has been ${user.isActive ? 'disabled' : 'enabled'}.`,
      });
      await loadUsers();
    } catch (error) {
      console.error('Failed to update access:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to update access.' });
    } finally {
      setIsTogglingAccess(false);
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
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Manage Users</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Create and manage user access</Typography>
      </Box>

      {message.text && (
        <Alert severity={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleOpenCreate}
          sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}
        >
          Add User
        </Button>
      </Box>

      <Card sx={glassCardSx}>
        <CardHeader title="User Directory" subheader={`${users.length} users`} />
        <CardContent>
          {isLoading && (
            <Typography sx={{ color: '#6b7280', mb: 1.5 }}>Loading users...</Typography>
          )}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Count</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.email}>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell sx={{ color: '#6b7280' }}>{(user.lastLoginAt || '').replace('T', ' ').slice(0, 16) || 'Never'}</TableCell>
                  <TableCell>{user.loginCount}</TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: user.isActive ? '#15803d' : '#b91c1c',
                        backgroundColor: user.isActive ? '#dcfce7' : '#fee2e2',
                        px: 1,
                        py: 0.5,
                        borderRadius: 99,
                        display: 'inline-block',
                      }}
                    >
                      {user.isActive ? 'active' : 'disabled'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'inline-flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => handleOpenEdit(user)} sx={{ textTransform: 'none', borderRadius: 2 }}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color={user.isActive ? 'warning' : 'success'}
                        onClick={() => handleToggleAccess(user)}
                        disabled={isTogglingAccess}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        {user.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => handleDelete(user.email)} disabled={isDeleting} sx={{ textTransform: 'none', borderRadius: 2 }}>
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.email ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.25 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Display Name" value={form.displayName} onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select value={form.role} label="Role" onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
                  <MenuItem value="admin">admin</MenuItem>
                  <MenuItem value="faculty">faculty</MenuItem>
                  <MenuItem value="student">student</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Department" value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value.toUpperCase() }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsModalOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} variant="contained" sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageUsersPage;
