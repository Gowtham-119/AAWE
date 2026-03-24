import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Chip, FormControl, Grid, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { BookOpen, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext.js';
import { supabase } from '../../lib/supabaseClient.js';
import { LIVE_STALE_TIME_MS, STATIC_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import {
  assignClassToDepartment,
  deleteClassAssignmentsByDepartmentCourse,
  getClassAssignmentsByDepartment,
  getDepartmentCourses,
  getDepartmentStaff,
  getFacultyProfileByEmail,
  getStudents,
  updateClassAssignmentVenueByDepartmentCourse,
} from '../../lib/academicDataApi';
import NoticesPanel from '../ui/NoticesPanel.jsx';

const VENUE_OPTIONS = ['SF', 'ME', 'WW', 'EW', 'LAB'];

export const FacultyDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();

  const [facultyDepartment, setFacultyDepartment] = useState((user?.department || '').trim().toUpperCase());
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStaffEmail, setSelectedStaffEmail] = useState('');
  const [venue, setVenue] = useState('SF');
  const [assignedRowsPage, setAssignedRowsPage] = useState(0);
  const [assignedRowsPerPage, setAssignedRowsPerPage] = useState(10);
  const [editingCourseCode, setEditingCourseCode] = useState('');
  const [editingVenue, setEditingVenue] = useState('SF');
  const [targetEmailsInput, setTargetEmailsInput] = useState('');

  const { data: facultyProfile, isLoading: isLoadingFacultyProfile, isSuccess: isFacultyProfileLoaded } = useQuery({
    queryKey: queryKeys.faculty.profile(normalizedEmail),
    queryFn: () => getFacultyProfileByEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: STATIC_STALE_TIME_MS,
  });

  const { data: courses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: queryKeys.faculty.courses(facultyDepartment),
    queryFn: () => getDepartmentCourses(facultyDepartment),
    enabled: Boolean(facultyDepartment),
    staleTime: STATIC_STALE_TIME_MS,
  });

  const { data: departmentStaff = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: queryKeys.faculty.staff(facultyDepartment),
    queryFn: async () => {
      const rows = await getDepartmentStaff(facultyDepartment);
      return rows.slice(0, 5);
    },
    enabled: Boolean(facultyDepartment),
    staleTime: STATIC_STALE_TIME_MS,
  });

  const { data: assignmentSourceRows = [], isLoading: isLoadingAssignedRows } = useQuery({
    queryKey: queryKeys.faculty.assignments(facultyDepartment),
    queryFn: () => getClassAssignmentsByDepartment(facultyDepartment),
    enabled: Boolean(facultyDepartment),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const { data: selectedDepartmentCount = 0 } = useQuery({
    queryKey: queryKeys.faculty.students(facultyDepartment, 1, 1),
    queryFn: async () => {
      const result = await getStudents({ page: 1, pageSize: 1, department: facultyDepartment });
      return result.total || 0;
    },
    enabled: Boolean(facultyDepartment),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const assignClassMutation = useMutation({
    mutationFn: assignClassToDepartment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.faculty.assignments(facultyDepartment) });
    },
  });

  const updateVenueMutation = useMutation({
    mutationFn: updateClassAssignmentVenueByDepartmentCourse,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.faculty.assignments(facultyDepartment) });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: deleteClassAssignmentsByDepartmentCourse,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.faculty.assignments(facultyDepartment) });
    },
  });

  const assignedRows = useMemo(() => {
    const grouped = new Map();

    assignmentSourceRows.forEach((row) => {
      const key = `${row.course_code}::${row.staff_email || row.staff_name || ''}`;
      const current = grouped.get(key);

      if (!current) {
        grouped.set(key, {
          courseCode: row.course_code,
          courseName: row.course_name,
          venue: row.venue || '',
          staffName: row.staff_name || 'N/A',
          staffEmail: row.staff_email || '',
          studentCount: 1,
          updatedAt: row.updated_at,
        });
        return;
      }

      grouped.set(key, {
        ...current,
        studentCount: current.studentCount + 1,
        updatedAt: current.updatedAt > row.updated_at ? current.updatedAt : row.updated_at,
      });
    });

    return Array.from(grouped.values());
  }, [assignmentSourceRows]);

  const quickStats = useMemo(() => ([
    {
      title: 'My Courses',
      value: String(courses.length || 0),
      description: `${facultyDepartment || 'N/A'} department`,
      icon: BookOpen,
      iconBg: '#3b82f6',
      cardBg: 'linear-gradient(145deg, #eef6ff 0%, #dbeafe 100%)',
      iconGlow: '0 12px 22px rgba(59,130,246,0.28)',
    },
    {
      title: 'Total Students',
      value: String(selectedDepartmentCount || 0),
      description: facultyDepartment ? `In ${facultyDepartment} department` : 'Department not set',
      icon: Users,
      iconBg: '#22c55e',
      cardBg: 'linear-gradient(145deg, #ecfdf3 0%, #dcfce7 100%)',
      iconGlow: '0 12px 22px rgba(34,197,94,0.28)',
    },
    {
      title: "Today's Classes",
      value: String(assignedRows.length || 0),
      description: 'Scheduled',
      icon: Clock,
      iconBg: '#a855f7',
      cardBg: 'linear-gradient(145deg, #f5edff 0%, #f3e8ff 100%)',
      iconGlow: '0 12px 22px rgba(168,85,247,0.28)',
    },
  ]), [assignedRows.length, courses.length, facultyDepartment, selectedDepartmentCount]);

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(16px)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    boxShadow: '0 14px 28px rgba(15,23,42,0.08)',
    border: '1px solid rgba(148,163,184,0.20)',
  };

  useEffect(() => {
    const resolvedDepartment = (facultyProfile?.department || user?.department || '').trim().toUpperCase();
    setFacultyDepartment(resolvedDepartment);
  }, [facultyProfile?.department, user?.department]);

  useEffect(() => {
    if (!facultyDepartment) {
      setSelectedCourse('');
      return;
    }

    if (!courses.length) {
      setSelectedCourse('');
      return;
    }

    setSelectedCourse((previousCourseCode) => {
      if (courses.some((course) => course.code === previousCourseCode)) return previousCourseCode;
      return courses[0].code;
    });
  }, [facultyDepartment, courses]);

  useEffect(() => {
    if (!facultyDepartment) {
      setSelectedStaffEmail('');
      return;
    }

    if (!departmentStaff.length) {
      setSelectedStaffEmail('');
      return;
    }

    const defaultStaffEmail = departmentStaff.find((staff) => staff.email === normalizedEmail)?.email || departmentStaff[0].email;
    setSelectedStaffEmail((previousStaffEmail) => {
      if (departmentStaff.some((staff) => staff.email === previousStaffEmail)) return previousStaffEmail;
      return defaultStaffEmail;
    });
  }, [facultyDepartment, departmentStaff, normalizedEmail]);

  useEffect(() => {
    if (!user?.email) return;

    const profileChannel = supabase
      .channel(`faculty-profile-${user.email}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `email=eq.${user.email}`,
        },
        (payload) => {
          const nextDepartment = (payload.new?.department || '').trim().toUpperCase();
          if (!nextDepartment) return;
          void queryClient.invalidateQueries({ queryKey: queryKeys.faculty.profile(normalizedEmail) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
    };
  }, [normalizedEmail, user?.email, queryClient]);

  useEffect(() => {
    if (!facultyDepartment) return;

    const staffChannel = supabase
      .channel(`department-staff-${facultyDepartment}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'department_staff',
          filter: `department=eq.${facultyDepartment}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.faculty.staff(facultyDepartment) });
        }
      )
      .subscribe();

    const courseChannel = supabase
      .channel(`department-courses-${facultyDepartment}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'department_courses',
          filter: `department=eq.${facultyDepartment}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.faculty.courses(facultyDepartment) });
        }
      )
      .subscribe();

    const assignmentChannel = supabase
      .channel(`class-assignments-${facultyDepartment}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_assignments',
          filter: `department=eq.${facultyDepartment}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.faculty.assignments(facultyDepartment) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(staffChannel);
      void supabase.removeChannel(courseChannel);
      void supabase.removeChannel(assignmentChannel);
    };
  }, [facultyDepartment, queryClient]);

  const selectedCourseDetails = courses.find((course) => course.code === selectedCourse) || courses[0];
  const selectedStaffDetails = departmentStaff.find((staff) => staff.email === selectedStaffEmail) || null;

  useEffect(() => {
    setAssignedRowsPage(0);
  }, [assignedRows.length, assignedRowsPerPage]);

  const pagedAssignedRows = assignedRows.slice(
    assignedRowsPage * assignedRowsPerPage,
    assignedRowsPage * assignedRowsPerPage + assignedRowsPerPage
  );

  const handleAssignClass = async () => {
    const targetStudentEmails = targetEmailsInput
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!facultyDepartment) {
      toast.error('Please update your department in Profile first.');
      return;
    }

    if (!selectedCourseDetails?.code) {
      toast.error(`No courses configured for ${facultyDepartment} department.`);
      return;
    }

    if (!selectedStaffDetails) {
      toast.error(`No active staff configured for ${facultyDepartment} department.`);
      return;
    }

    if (!venue.trim()) {
      toast.error('Please enter a venue.');
      return;
    }

    try {
      const assignedRows = await assignClassMutation.mutateAsync({
        departmentCode: facultyDepartment,
        selectedCourse: selectedCourseDetails,
        venue,
        staffName: selectedStaffDetails.name,
        staffEmail: selectedStaffDetails.email,
        facultyEmail: user?.email,
        actorEmail: user?.email,
        actorRole: user?.role,
        targetStudentEmails,
      });

      toast.success(`${selectedCourseDetails.code} assigned to ${assignedRows.length} students in ${facultyDepartment}.`);
    } catch (error) {
      console.error('Failed to assign class:', error);
      toast.error(error?.message || 'Failed to assign class.');
    }
  };

  const handleStartEditVenue = (row) => {
    setEditingCourseCode(row.courseCode);
    setEditingVenue(VENUE_OPTIONS.includes(row.venue) ? row.venue : 'SF');
  };

  const handleUpdateVenue = async () => {
    if (!facultyDepartment || !editingCourseCode) return;

    try {
      const updatedRows = await updateVenueMutation.mutateAsync({
        departmentCode: facultyDepartment,
        courseCode: editingCourseCode,
        venue: editingVenue,
        actorEmail: user?.email,
        actorRole: user?.role,
      });

      toast.success(`Venue updated to ${editingVenue} for ${editingCourseCode} (${updatedRows.length} students).`);
      setEditingCourseCode('');
    } catch (error) {
      console.error('Failed to update venue:', error);
      toast.error(error?.message || 'Failed to update venue.');
    }
  };

  const handleDeleteAssignment = async (courseCode) => {
    if (!facultyDepartment || !courseCode) return;

    try {
      const deletedRows = await deleteAssignmentMutation.mutateAsync({
        departmentCode: facultyDepartment,
        courseCode,
        actorEmail: user?.email,
        actorRole: user?.role,
      });

      toast.success(`${courseCode} assignments deleted for ${deletedRows.length} students.`);
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      toast.error(error?.message || 'Failed to delete assignment.');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25, background: 'radial-gradient(circle at 0% 0%, rgba(186,230,253,0.20), transparent 34%), radial-gradient(circle at 100% 100%, rgba(221,214,254,0.20), transparent 34%)' }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' }}>Faculty Dashboard</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Manage your courses and student progress</Typography>
      </Box>

      {isFacultyProfileLoaded && Number(facultyProfile?.completeness || 0) < 80 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Complete your profile to at least 80% to keep your faculty account information up to date.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ ...glassCardSx, background: stat.cardBg }}>
                <CardContent sx={{ p: 2.25 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.88rem', color: '#475569' }}>{stat.title}</Typography>
                      <Typography sx={{ fontSize: '2.05rem', fontWeight: 700, color: '#0f172a', mt: 0.45, lineHeight: 1 }}>{stat.value}</Typography>
                      <Typography sx={{ fontSize: '0.80rem', color: '#64748b', mt: 1 }}>{stat.description}</Typography>
                    </Box>
                    <Box sx={{ width: 56, height: 108, borderRadius: 2.2, backgroundColor: stat.iconBg, display: 'grid', placeItems: 'center', boxShadow: stat.iconGlow }}>
                      <Icon size={24} color="#fff" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <NoticesPanel
        role="faculty"
        title="Faculty Notices"
        sx={glassCardSx}
      />

      <Card sx={glassCardSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', mb: 0.5 }}>
            Assign Class to Department Students
          </Typography>
          <Typography sx={{ color: '#6b7280', mb: 2.5 }}>
            Assign class, venue, and staff for students in your department.
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Department"
                value={facultyDepartment || ''}
                placeholder="Set in Profile"
                InputProps={{ readOnly: true }}
                disabled={isLoadingFacultyProfile}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Class</InputLabel>
                <Select
                  value={selectedCourse}
                  label="Class"
                  onChange={(event) => setSelectedCourse(event.target.value)}
                  disabled={!courses.length || isLoadingCourses}
                >
                  {courses.map((course) => (
                    <MenuItem key={course.code} value={course.code}>
                      {course.code} - {course.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Venue</InputLabel>
                <Select
                  value={venue}
                  label="Venue"
                  onChange={(event) => setVenue(event.target.value)}
                >
                  {VENUE_OPTIONS.map((venueCode) => (
                    <MenuItem key={venueCode} value={venueCode}>{venueCode}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Staff</InputLabel>
                <Select
                  value={selectedStaffEmail}
                  label="Staff"
                  onChange={(event) => setSelectedStaffEmail(event.target.value)}
                  disabled={!departmentStaff.length || isLoadingStaff}
                >
                  {departmentStaff.map((staff) => (
                    <MenuItem key={staff.email} value={staff.email}>
                      {staff.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Target Student Emails (Optional)"
                placeholder="student1@college.edu, student2@college.edu"
                value={targetEmailsInput}
                onChange={(event) => setTargetEmailsInput(event.target.value)}
                helperText="Leave empty to assign to the full department. Provide comma-separated emails to target specific students."
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    size="small"
                    label={facultyDepartment ? `${selectedDepartmentCount} students in ${facultyDepartment}` : 'Department not set'}
                    sx={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                  />
                  {selectedCourseDetails && (
                    <Chip size="small" label={selectedCourseDetails.code} sx={{ backgroundColor: '#ede9fe', color: '#6d28d9' }} />
                  )}
                  {selectedStaffDetails && (
                    <Chip size="small" label={selectedStaffDetails.name} sx={{ backgroundColor: '#dcfce7', color: '#166534' }} />
                  )}
                </Box>

                <Button
                  variant="contained"
                  onClick={handleAssignClass}
                  disabled={assignClassMutation.isPending}
                  sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
                >
                  {assignClassMutation.isPending ? 'Assigning...' : 'Assign Class'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={glassCardSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', mb: 0.5 }}>
            Manage Assigned Venues
          </Typography>
          <Typography sx={{ color: '#6b7280', mb: 2.5 }}>
            Edit or delete assigned venues for your department classes.
          </Typography>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Course</TableCell>
                <TableCell>Staff</TableCell>
                <TableCell>Students</TableCell>
                <TableCell>Venue</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoadingAssignedRows && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: '#6b7280' }}>Loading assigned venues...</TableCell>
                </TableRow>
              )}

              {!isLoadingAssignedRows && !assignedRows.length && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: '#6b7280' }}>No class assignments yet.</TableCell>
                </TableRow>
              )}

              {!isLoadingAssignedRows && pagedAssignedRows.map((row) => {
                const isEditingRow = editingCourseCode === row.courseCode;
                return (
                  <TableRow key={`${row.courseCode}-${row.staffEmail || row.staffName}`}>
                    <TableCell>{row.courseCode} - {row.courseName}</TableCell>
                    <TableCell>{row.staffName}</TableCell>
                    <TableCell>{row.studentCount}</TableCell>
                    <TableCell>
                      {isEditingRow ? (
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                          <Select value={editingVenue} onChange={(event) => setEditingVenue(event.target.value)}>
                            {VENUE_OPTIONS.map((venueCode) => (
                              <MenuItem key={venueCode} value={venueCode}>{venueCode}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        row.venue || 'N/A'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditingRow ? (
                        <Box sx={{ display: 'inline-flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleUpdateVenue}
                            disabled={updateVenueMutation.isPending}
                            sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
                          >
                            {updateVenueMutation.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => setEditingCourseCode('')} sx={{ textTransform: 'none' }}>
                            Cancel
                          </Button>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'inline-flex', gap: 1 }}>
                          <Button size="small" variant="outlined" onClick={() => handleStartEditVenue(row)} sx={{ textTransform: 'none' }}>
                            Edit
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleDeleteAssignment(row.courseCode)}
                            disabled={deleteAssignmentMutation.isPending}
                            sx={{ textTransform: 'none' }}
                          >
                            Delete
                          </Button>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={assignedRows.length}
            page={assignedRowsPage}
            onPageChange={(_event, nextPage) => setAssignedRowsPage(nextPage)}
            rowsPerPage={assignedRowsPerPage}
            onRowsPerPageChange={(event) => {
              setAssignedRowsPerPage(Number(event.target.value));
              setAssignedRowsPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default FacultyDashboard;
