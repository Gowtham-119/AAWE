import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { deleteDepartmentCourse, getDepartmentCoursesAdmin, upsertDepartmentCourse } from '../../lib/academicDataApi';

const ManageCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    department: '',
    courseCode: '',
    courseName: '',
  });

  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const rows = await getDepartmentCoursesAdmin();
      setCourses(rows);
    } catch (error) {
      console.error('Failed to load courses:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to load courses.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCourses();
  }, []);

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
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await upsertDepartmentCourse(form);
      setMessage({ type: 'success', text: 'Course saved successfully.' });
      setIsModalOpen(false);
      await loadCourses();
    } catch (error) {
      console.error('Failed to save course:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to save course.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (course) => {
    setIsDeleting(true);
    setMessage({ type: '', text: '' });
    try {
      await deleteDepartmentCourse({ department: course.department, courseCode: course.courseCode });
      setMessage({ type: 'success', text: 'Course deleted successfully.' });
      await loadCourses();
    } catch (error) {
      console.error('Failed to delete course:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to delete course.' });
    } finally {
      setIsDeleting(false);
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
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Manage Courses</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Configure academic courses by department</Typography>
      </Box>

      {message.text && (
        <Alert severity={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
      )}

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
                      <Button size="small" variant="outlined" color="error" onClick={() => handleDelete(course)} disabled={isDeleting} sx={{ textTransform: 'none', borderRadius: 2 }}>Delete</Button>
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
          <Button onClick={handleSave} disabled={isSaving} variant="contained" sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageCoursesPage;
