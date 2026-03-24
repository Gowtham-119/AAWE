import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { deleteDepartmentCourse, getDepartmentCoursesAdmin, upsertDepartmentCourse } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { STATIC_STALE_TIME_MS } from '../../lib/queryClient';
import { toast } from 'sonner';

const ManageCoursesPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    department: '',
    courseCode: '',
    courseName: '',
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: queryKeys.admin.courses(),
    queryFn: getDepartmentCoursesAdmin,
    staleTime: STATIC_STALE_TIME_MS,
  });

  const saveCourseMutation = useMutation({
    mutationFn: upsertDepartmentCourse,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses() });
      toast.success('Course saved successfully.');
      setIsModalOpen(false);
    },
    onError: (error) => {
      console.error('Failed to save course:', error);
      toast.error(error?.message || 'Failed to save course.');
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (course) => deleteDepartmentCourse({ department: course.department, courseCode: course.courseCode }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses() });
      toast.success('Course deleted successfully.');
    },
    onError: (error) => {
      console.error('Failed to delete course:', error);
      toast.error(error?.message || 'Failed to delete course.');
    },
  });

  const handleOpenCreate = () => {
    setForm({ department: '', courseCode: '', courseName: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (course) => {
    setForm({
      department: course.department,
      courseCode: course.courseCode,
      courseName: course.courseName,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    await saveCourseMutation.mutateAsync(form);
  };

  const handleDelete = async (course) => {
    await deleteCourseMutation.mutateAsync(course);
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
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Manage Courses</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Configure academic courses by department</Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={handleOpenCreate} sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}>
          Add Course
        </Button>
      </Box>

      <Card sx={glassCardSx}>
        <CardHeader title="Course Catalog" subheader={`${courses.length} courses`} />
        <CardContent>
          {isLoading && <Typography sx={{ color: '#6b7280', mb: 1.5 }}>Loading courses...</Typography>}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Department</TableCell>
                <TableCell>Course Code</TableCell>
                <TableCell>Course Name</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={`${course.department}-${course.courseCode}`}>
                  <TableCell>{course.department}</TableCell>
                  <TableCell>{course.courseCode}</TableCell>
                  <TableCell>{course.courseName}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'inline-flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => handleOpenEdit(course)} sx={{ textTransform: 'none', borderRadius: 2 }}>Edit</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => handleDelete(course)} disabled={deleteCourseMutation.isPending} sx={{ textTransform: 'none', borderRadius: 2 }}>Delete</Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.courseCode ? 'Edit Course' : 'Add Course'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.25 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Department" value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value.toUpperCase() }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Course Code" value={form.courseCode} onChange={(event) => setForm((prev) => ({ ...prev, courseCode: event.target.value.toUpperCase() }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 12 }}>
              <TextField fullWidth label="Course Name" value={form.courseName} onChange={(event) => setForm((prev) => ({ ...prev, courseName: event.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsModalOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveCourseMutation.isPending} variant="contained" sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}>
            {saveCourseMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageCoursesPage;
