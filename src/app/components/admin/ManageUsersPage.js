import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, CardHeader, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography } from '@mui/material';
import { deleteUserByEmail, getUsersWithProfiles, updateUserAccessByEmail, upsertUserWithProfile } from '../../lib/academicDataApi';
import { useAuth } from '../../context/AuthContext.js';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { toast } from 'sonner';

const ManageUsersPage = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    role: 'student',
    displayName: '',
    department: 'NA',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('displayName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: users = [], isLoading } = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: getUsersWithProfiles,
    staleTime: LIVE_STALE_TIME_MS,
  });

  const saveUserMutation = useMutation({
    mutationFn: upsertUserWithProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      toast.success('User saved successfully.');
      setIsModalOpen(false);
    },
    onError: (error) => {
      console.error('Failed to save user:', error);
      toast.error(error?.message || 'Failed to save user.');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUserByEmail,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      toast.success('User deleted successfully.');
    },
    onError: (error) => {
      console.error('Failed to delete user:', error);
      toast.error(error?.message || 'Failed to delete user.');
    },
  });

  const toggleAccessMutation = useMutation({
    mutationFn: ({ email, isActive }) => updateUserAccessByEmail({
      email,
      isActive,
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
    }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      toast.success(`${variables.email} has been ${variables.isActive ? 'enabled' : 'disabled'}.`);
    },
    onError: (error) => {
      console.error('Failed to update access:', error);
      toast.error(error?.message || 'Failed to update access.');
    },
  });

  const bulkAccessMutation = useMutation({
    mutationFn: async ({ emails, isActive }) => {
      await Promise.all(
        emails.map((email) => updateUserAccessByEmail({
          email,
          isActive,
          actorEmail: currentUser?.email,
          actorRole: currentUser?.role,
        }))
      );
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      const count = variables?.emails?.length || 0;
      setSelectedEmails([]);
      toast.success(`${count} user${count === 1 ? '' : 's'} ${variables.isActive ? 'enabled' : 'disabled'} successfully.`);
    },
    onError: (error) => {
      console.error('Failed to update selected users:', error);
      toast.error(error?.message || 'Failed to update selected users.');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (emails) => {
      await Promise.all(emails.map((email) => deleteUserByEmail(email)));
    },
    onSuccess: async (_data, emails) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
      const count = emails?.length || 0;
      setSelectedEmails([]);
      toast.success(`${count} user${count === 1 ? '' : 's'} deleted successfully.`);
    },
    onError: (error) => {
      console.error('Failed to delete selected users:', error);
      toast.error(error?.message || 'Failed to delete selected users.');
    },
  });

  const departmentOptions = useMemo(() => {
    return [...new Set(users.map((user) => user.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch = !normalizedSearch
        || user.displayName.toLowerCase().includes(normalizedSearch)
        || user.email.toLowerCase().includes(normalizedSearch)
        || user.department.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
      const matchesActive = activeFilter === 'all'
        || (activeFilter === 'active' && user.isActive)
        || (activeFilter === 'disabled' && !user.isActive);

      return matchesSearch && matchesRole && matchesDepartment && matchesActive;
    });
  }, [activeFilter, departmentFilter, roleFilter, searchTerm, users]);

  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];
    sorted.sort((left, right) => {
      const normalizeValue = (user) => {
        switch (sortBy) {
          case 'displayName':
            return user.displayName || '';
          case 'email':
            return user.email || '';
          case 'role':
            return user.role || '';
          case 'department':
            return user.department || '';
          case 'lastLoginAt':
            return user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
          case 'loginCount':
            return Number(user.loginCount || 0);
          case 'isActive':
            return user.isActive ? 1 : 0;
          default:
            return '';
        }
      };

      const leftValue = normalizeValue(left);
      const rightValue = normalizeValue(right);

      let comparison = 0;
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        comparison = leftValue - rightValue;
      } else {
        comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredUsers, sortBy, sortDirection]);

  const selectedEmailSet = useMemo(() => new Set(selectedEmails), [selectedEmails]);

  const allFilteredSelected = filteredUsers.length > 0
    && filteredUsers.every((user) => selectedEmailSet.has(user.email));

  const someFilteredSelected = filteredUsers.some((user) => selectedEmailSet.has(user.email));

  const pagedUsers = sortedUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const hasPendingBulkAction = bulkAccessMutation.isPending || bulkDeleteMutation.isPending;

  useEffect(() => {
    setPage(0);
  }, [rowsPerPage, searchTerm, roleFilter, departmentFilter, activeFilter]);

  useEffect(() => {
    setSelectedEmails((prev) => prev.filter((email) => users.some((user) => user.email === email)));
  }, [users]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(column);
    setSortDirection('asc');
  };

  const handleToggleSelectUser = (email) => {
    setSelectedEmails((prev) => (
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]
    ));
  };

  const handleToggleSelectAllFiltered = (checked) => {
    if (checked) {
      setSelectedEmails((prev) => [...new Set([...prev, ...filteredUsers.map((user) => user.email)])]);
      return;
    }

    const filteredEmailSet = new Set(filteredUsers.map((user) => user.email));
    setSelectedEmails((prev) => prev.filter((email) => !filteredEmailSet.has(email)));
  };

  const handleBulkAccess = async (isActive) => {
    if (!selectedEmails.length) return;
    await bulkAccessMutation.mutateAsync({ emails: selectedEmails, isActive });
  };

  const handleBulkDelete = async () => {
    if (!selectedEmails.length) return;
    await bulkDeleteMutation.mutateAsync(selectedEmails);
    setIsBulkDeleteDialogOpen(false);
  };

  const handleExportCsv = () => {
    const headers = ['Name', 'Email', 'Role', 'Department', 'Last Login', 'Login Count', 'Status'];
    const escapeCsv = (value) => {
      const stringValue = String(value ?? '');
      if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = sortedUsers.map((user) => [
      user.displayName,
      user.email,
      user.role,
      user.department,
      (user.lastLoginAt || '').replace('T', ' ').slice(0, 16) || 'Never',
      user.loginCount,
      user.isActive ? 'active' : 'disabled',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'users_filtered_view.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

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
    await saveUserMutation.mutateAsync({
      email: form.email,
      role: form.role,
      displayName: form.displayName,
      department: form.department,
    });
  };

  const handleDelete = async (email) => {
    await deleteUserMutation.mutateAsync(email);
  };

  const handleToggleAccess = async (user) => {
    await toggleAccessMutation.mutateAsync({ email: user.email, isActive: !user.isActive });
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

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={handleExportCsv}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Export CSV
          </Button>
          <Button
            variant="contained"
            onClick={handleOpenCreate}
            sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}
          >
            Add User
          </Button>
        </Box>
      </Box>

      <Card sx={glassCardSx}>
        <CardHeader title="User Directory" subheader={`${filteredUsers.length} filtered of ${users.length} users`} />
        <CardContent>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                size="small"
                label="Search name, email, department"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select value={roleFilter} label="Role" onChange={(event) => setRoleFilter(event.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="faculty">Faculty</MenuItem>
                  <MenuItem value="student">Student</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={departmentFilter} label="Department" onChange={(event) => setDepartmentFilter(event.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  {departmentOptions.map((department) => (
                    <MenuItem key={department} value={department}>{department}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={activeFilter} label="Status" onChange={(event) => setActiveFilter(event.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="disabled">Disabled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {selectedEmails.length > 0 && (
            <Box
              sx={{
                mb: 2,
                px: 2,
                py: 1.25,
                borderRadius: 2,
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ color: '#1e3a8a', fontWeight: 600, fontSize: '0.875rem' }}>
                {selectedEmails.length} selected
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => handleBulkAccess(true)} disabled={hasPendingBulkAction} sx={{ textTransform: 'none' }}>
                  Enable Selected
                </Button>
                <Button size="small" variant="outlined" color="warning" onClick={() => handleBulkAccess(false)} disabled={hasPendingBulkAction} sx={{ textTransform: 'none' }}>
                  Disable Selected
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => setIsBulkDeleteDialogOpen(true)} disabled={hasPendingBulkAction} sx={{ textTransform: 'none' }}>
                  Delete Selected
                </Button>
              </Box>
            </Box>
          )}

          {isLoading && (
            <Typography sx={{ color: '#6b7280', mb: 1.5 }}>Loading users...</Typography>
          )}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allFilteredSelected}
                    indeterminate={!allFilteredSelected && someFilteredSelected}
                    onChange={(event) => handleToggleSelectAllFiltered(event.target.checked)}
                    inputProps={{ 'aria-label': 'select all users' }}
                  />
                </TableCell>
                <TableCell sortDirection={sortBy === 'displayName' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortBy === 'displayName'}
                    direction={sortBy === 'displayName' ? sortDirection : 'asc'}
                    onClick={() => handleSort('displayName')}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'email' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortBy === 'email'}
                    direction={sortBy === 'email' ? sortDirection : 'asc'}
                    onClick={() => handleSort('email')}
                  >
                    Email
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'role' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortBy === 'role'}
                    direction={sortBy === 'role' ? sortDirection : 'asc'}
                    onClick={() => handleSort('role')}
                  >
                    Role
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'department' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortBy === 'department'}
                    direction={sortBy === 'department' ? sortDirection : 'asc'}
                    onClick={() => handleSort('department')}
                  >
                    Department
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'lastLoginAt' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortBy === 'lastLoginAt'}
                    direction={sortBy === 'lastLoginAt' ? sortDirection : 'asc'}
                    onClick={() => handleSort('lastLoginAt')}
                  >
                    Last Login
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'loginCount' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortBy === 'loginCount'}
                    direction={sortBy === 'loginCount' ? sortDirection : 'asc'}
                    onClick={() => handleSort('loginCount')}
                  >
                    Count
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'isActive' ? sortDirection : false}>
                  <TableSortLabel
                    active={sortBy === 'isActive'}
                    direction={sortBy === 'isActive' ? sortDirection : 'asc'}
                    onClick={() => handleSort('isActive')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedUsers.map((user) => (
                <TableRow key={user.email}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedEmailSet.has(user.email)}
                      onChange={() => handleToggleSelectUser(user.email)}
                      inputProps={{ 'aria-label': `select ${user.email}` }}
                    />
                  </TableCell>
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
                        disabled={toggleAccessMutation.isPending}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        {user.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => handleDelete(user.email)} disabled={deleteUserMutation.isPending} sx={{ textTransform: 'none', borderRadius: 2 }}>
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sortedUsers.length}
            page={page}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </CardContent>
      </Card>

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected users?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedEmails.length} selected user{selectedEmails.length === 1 ? '' : 's'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <Button onClick={handleSave} disabled={saveUserMutation.isPending} variant="contained" sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}>
            {saveUserMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageUsersPage;
