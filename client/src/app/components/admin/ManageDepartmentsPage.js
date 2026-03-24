import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { createDepartment, getDepartmentsAdmin, setDepartmentActiveStatus, updateDepartmentName } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { toast } from 'sonner';

const ManageDepartmentsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [targetDepartment, setTargetDepartment] = useState(null);
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState({ code: '', name: '' });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: queryKeys.admin.departments(),
    queryFn: getDepartmentsAdmin,
    staleTime: LIVE_STALE_TIME_MS,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (mode === 'create') {
        return createDepartment(payload);
      }
      return updateDepartmentName(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.departments() });
      toast.success(mode === 'create' ? 'Department added successfully.' : 'Department name updated successfully.');
      setIsModalOpen(false);
    },
    onError: (error) => {
      console.error('Failed to save department:', error);
      toast.error(error?.message || 'Failed to save department.');
    },
  });

  const updateActiveMutation = useMutation({
    mutationFn: setDepartmentActiveStatus,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.departments() });
      toast.success(`${variables.code} has been ${variables.isActive ? 'reactivated' : 'deactivated'}.`);
      setIsDeactivateDialogOpen(false);
      setTargetDepartment(null);
    },
    onError: (error) => {
      console.error('Failed to update department status:', error);
      toast.error(error?.message || 'Failed to update department status.');
    },
  });

  const handleOpenCreate = () => {
    setMode('create');
    setForm({ code: '', name: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (department) => {
    setMode('edit');
    setForm({ code: department.code, name: department.name });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      code: (form.code || '').trim().toUpperCase(),
      name: (form.name || '').trim(),
    });
  };

  const handleToggleActive = async (department) => {
    if (department.isActive) {
      setTargetDepartment(department);
      setIsDeactivateDialogOpen(true);
      return;
    }

    await updateActiveMutation.mutateAsync({ code: department.code, isActive: true });
  };

  const handleConfirmDeactivate = async () => {
    if (!targetDepartment) return;
    await updateActiveMutation.mutateAsync({ code: targetDepartment.code, isActive: false });
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
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Manage Departments</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Create, update, and control department status</Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleOpenCreate}
          sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}
        >
          Add Department
        </Button>
      </Box>

      <Card sx={glassCardSx}>
        <CardHeader title="Departments" subheader={`${departments.length} departments`} />
        <CardContent>
          {isLoading && <Typography sx={{ color: '#6b7280', mb: 1.5 }}>Loading departments...</Typography>}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Student Count</TableCell>
                <TableCell>Faculty Count</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {departments.map((department) => (
                <TableRow key={department.code}>
                  <TableCell sx={{ fontWeight: 700 }}>{department.code}</TableCell>
                  <TableCell>{department.name}</TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: department.isActive ? '#15803d' : '#b91c1c',
                        backgroundColor: department.isActive ? '#dcfce7' : '#fee2e2',
                        px: 1,
                        py: 0.5,
                        borderRadius: 99,
                        display: 'inline-block',
                      }}
                    >
                      {department.isActive ? 'active' : 'inactive'}
                    </Typography>
                  </TableCell>
                  <TableCell>{department.studentCount}</TableCell>
                  <TableCell>{department.facultyCount}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'inline-flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => handleOpenEdit(department)} sx={{ textTransform: 'none', borderRadius: 2 }}>
                        Edit Name
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color={department.isActive ? 'warning' : 'success'}
                        onClick={() => handleToggleActive(department)}
                        disabled={updateActiveMutation.isPending}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        {department.isActive ? 'Deactivate' : 'Reactivate'}
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
        <DialogTitle>{mode === 'create' ? 'Add Department' : 'Edit Department Name'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.25 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Code"
                value={form.code}
                disabled={mode === 'edit'}
                inputProps={{ maxLength: 4 }}
                helperText="2-4 uppercase letters"
                onChange={(event) => setForm((prev) => ({
                  ...prev,
                  code: event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4),
                }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                label="Full Name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsModalOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDeactivateDialogOpen} onClose={() => setIsDeactivateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Deactivate department?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#374151' }}>
            This will prevent new enrollments in [{targetDepartment?.code || 'dept'}]. Existing data is preserved.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsDeactivateDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleConfirmDeactivate}
            disabled={updateActiveMutation.isPending}
            color="warning"
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {updateActiveMutation.isPending ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageDepartmentsPage;
