import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, CardHeader, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext.js';
import { deleteNotice, getAdminNotices, upsertNotice } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import EmptyState from '../ui/EmptyState.jsx';

const EMPTY_FORM = {
  id: '',
  title: '',
  body: '',
  targetRole: 'all',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  isActive: true,
};

const ManageNoticesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: queryKeys.admin.notices(),
    queryFn: getAdminNotices,
    staleTime: LIVE_STALE_TIME_MS,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => upsertNotice(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.notices() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.common.notices('all', 3) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.common.notices('student', 3) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.common.notices('faculty', 3) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.common.notices('admin', 3) });
      toast.success('Notice saved successfully.');
      setForm(EMPTY_FORM);
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save notice.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.notices() });
      toast.success('Notice deleted.');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete notice.');
    },
  });

  const sortedNotices = useMemo(
    () => (notices || []).slice().sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || ''))),
    [notices]
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEdit = (notice) => {
    setForm({
      id: notice.id,
      title: notice.title,
      body: notice.body || '',
      targetRole: notice.targetRole || 'all',
      startDate: notice.startDate || new Date().toISOString().slice(0, 10),
      endDate: notice.endDate || '',
      isActive: notice.isActive !== false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    saveMutation.mutate({
      ...form,
      actorEmail: user?.email,
    });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: { xs: '1.55rem', md: '1.8rem' }, fontWeight: 700, color: '#111827' }}>Manage Notices</Typography>
          <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Create and publish announcements for roles across the platform.</Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ textTransform: 'none' }}>New Notice</Button>
      </Box>

      <Card>
        <CardHeader title="All Notices" />
        <CardContent>
          {isLoading ? (
            <Typography sx={{ color: '#6b7280' }}>Loading notices...</Typography>
          ) : !sortedNotices.length ? (
            <EmptyState title="No notices found" description="Create your first notice to start publishing announcements." />
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedNotices.map((notice) => (
                    <TableRow key={notice.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{notice.title}</Typography>
                        {notice.body ? <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>{notice.body}</Typography> : null}
                      </TableCell>
                      <TableCell><Chip size="small" label={notice.targetRole} sx={{ textTransform: 'capitalize' }} /></TableCell>
                      <TableCell>{notice.startDate || '-'}</TableCell>
                      <TableCell>{notice.endDate || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={notice.isActive ? 'active' : 'inactive'}
                          sx={{ backgroundColor: notice.isActive ? '#dcfce7' : '#fee2e2', color: notice.isActive ? '#15803d' : '#b91c1c' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="outlined" onClick={() => openEdit(notice)} sx={{ textTransform: 'none' }}>Edit</Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => deleteMutation.mutate(notice.id)}
                            disabled={deleteMutation.isPending}
                            sx={{ textTransform: 'none' }}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? 'Edit Notice' : 'Create Notice'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Body"
              multiline
              minRows={3}
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Target Role</InputLabel>
              <Select
                label="Target Role"
                value={form.targetRole}
                onChange={(event) => setForm((prev) => ({ ...prev, targetRole: event.target.value }))}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="student">Student</MenuItem>
                <MenuItem value="faculty">Faculty</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
              <Typography>Notice active</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saveMutation.isPending} sx={{ textTransform: 'none' }}>
            {saveMutation.isPending ? 'Saving...' : 'Save Notice'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageNoticesPage;
