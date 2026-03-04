import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, FormControl, Grid, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { BookOpen, Clock, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { supabase } from '../../lib/supabaseClient.js';
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

const VENUE_OPTIONS = ['SF', 'ME', 'WW', 'EW', 'LAB'];

export const FacultyDashboard = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [facultyDepartment, setFacultyDepartment] = useState((user?.department || '').trim().toUpperCase());
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState('');
  const [venue, setVenue] = useState('SF');
  const [isLoadingFacultyProfile, setIsLoadingFacultyProfile] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isLoadingAssignedRows, setIsLoadingAssignedRows] = useState(false);
  const [assignedRows, setAssignedRows] = useState([]);
  const [editingCourseCode, setEditingCourseCode] = useState('');
  const [editingVenue, setEditingVenue] = useState('SF');
  const [isSavingVenue, setIsSavingVenue] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const quickStats = [
    { title: 'My Courses', value: String(courses.length || 0), description: `${facultyDepartment || 'N/A'} department`, icon: BookOpen, color: 'bg-blue-500' },
    { title: 'Total Students', value: String(students.length || 0), description: facultyDepartment ? `In ${facultyDepartment} department` : 'Department not set', icon: Users, color: 'bg-green-500' },
    { title: "Today's Classes", value: String(assignedRows.length || 0), description: 'Scheduled', icon: Clock, color: 'bg-purple-500' },
  ];

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  };

  const extractDepartmentCode = (email) => {
    const match = (email || '').trim().toLowerCase().match(/\.([a-z]{2})\d*@/);
    return match?.[1]?.toUpperCase() || 'NA';
  };

  useEffect(() => {
    const loadFacultyProfile = async () => {
      if (!user?.email) return;

      setIsLoadingFacultyProfile(true);

      try {
        const profile = await getFacultyProfileByEmail(user.email);
        const resolvedDepartment = (profile?.department || user?.department || '').trim().toUpperCase();
        setFacultyDepartment(resolvedDepartment);
      } catch (error) {
        console.error('Failed to load faculty profile:', error);
      } finally {
        setIsLoadingFacultyProfile(false);
      }
    };

    loadFacultyProfile();
  }, [user?.email, user?.department]);

  useEffect(() => {
    if (!facultyDepartment) {
      setCourses([]);
      setSelectedCourse('');
      return;
    }

    const loadCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const rows = await getDepartmentCourses(facultyDepartment);
        setCourses(rows);

        if (!rows.length) {
          setSelectedCourse('');
          return;
        }

        setSelectedCourse((previousCourseCode) => {
          if (rows.some((course) => course.code === previousCourseCode)) return previousCourseCode;
          return rows[0].code;
        });
      } catch (error) {
        console.error('Failed to load department courses:', error);
      } finally {
        setIsLoadingCourses(false);
      }
    };

    loadCourses();
  }, [facultyDepartment]);

  useEffect(() => {
    if (!facultyDepartment) {
      setAssignedRows([]);
      return;
    }

    const loadAssignments = async () => {
      setIsLoadingAssignedRows(true);
      try {
        const rows = await getClassAssignmentsByDepartment(facultyDepartment);
        const grouped = new Map();

        rows.forEach((row) => {
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

        setAssignedRows(Array.from(grouped.values()));
      } catch (error) {
        console.error('Failed to load assigned classes:', error);
      } finally {
        setIsLoadingAssignedRows(false);
      }
    };

    loadAssignments();
  }, [facultyDepartment]);

  useEffect(() => {
    if (!facultyDepartment) {
      setDepartmentStaff([]);
      setSelectedStaffEmail('');
      return;
    }

    const loadStaff = async () => {
      setIsLoadingStaff(true);
      try {
        const rows = await getDepartmentStaff(facultyDepartment);
        const limitedRows = rows.slice(0, 5);
        setDepartmentStaff(limitedRows);

        if (!limitedRows.length) {
          setSelectedStaffEmail('');
          return;
        }

        const defaultStaffEmail = limitedRows.find((staff) => staff.email === user?.email)?.email || limitedRows[0].email;
        setSelectedStaffEmail((previousStaffEmail) => {
          if (limitedRows.some((staff) => staff.email === previousStaffEmail)) return previousStaffEmail;
          return defaultStaffEmail;
        });
      } catch (error) {
        console.error('Failed to load department staff:', error);
      } finally {
        setIsLoadingStaff(false);
      }
    };

    loadStaff();
  }, [facultyDepartment, user?.email]);

  useEffect(() => {
    if (!facultyDepartment) {
      setStudents([]);
      return;
    }

    const loadStudents = async () => {
      try {
        const rows = await getStudents();
        const filtered = rows.filter((student) => {
          const emailDepartment = extractDepartmentCode(student.email);
          const profileDepartment = (student.department || '').trim().toUpperCase();
          return emailDepartment === facultyDepartment || profileDepartment === facultyDepartment;
        });
        setStudents(filtered);
      } catch (error) {
        console.error('Failed to load students for class assignment:', error);
      }
    };

    loadStudents();
  }, [facultyDepartment]);

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
          const updatedDepartment = (payload.new?.department || '').trim().toUpperCase();
          if (updatedDepartment) {
            setFacultyDepartment(updatedDepartment);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
    };
  }, [user?.email]);

  useEffect(() => {
    if (!facultyDepartment) return;

    const refreshStaff = async () => {
      const rows = await getDepartmentStaff(facultyDepartment);
      const limitedRows = rows.slice(0, 5);
      setDepartmentStaff(limitedRows);
      setSelectedStaffEmail((previousStaffEmail) => {
        if (limitedRows.some((staff) => staff.email === previousStaffEmail)) return previousStaffEmail;
        return limitedRows[0]?.email || '';
      });
    };

    const refreshCourses = async () => {
      const rows = await getDepartmentCourses(facultyDepartment);
      setCourses(rows);
      setSelectedCourse((previousCourseCode) => {
        if (rows.some((course) => course.code === previousCourseCode)) return previousCourseCode;
        return rows[0]?.code || '';
      });
    };

    const refreshAssignments = async () => {
      const rows = await getClassAssignmentsByDepartment(facultyDepartment);
      const grouped = new Map();

      rows.forEach((row) => {
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

      setAssignedRows(Array.from(grouped.values()));
    };

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
          void refreshStaff();
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
          void refreshCourses();
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
          void refreshAssignments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(staffChannel);
      void supabase.removeChannel(courseChannel);
      void supabase.removeChannel(assignmentChannel);
    };
  }, [facultyDepartment]);

  const selectedCourseDetails = courses.find((course) => course.code === selectedCourse) || courses[0];
  const selectedStaffDetails = departmentStaff.find((staff) => staff.email === selectedStaffEmail) || null;

  const selectedDepartmentCount = useMemo(() => {
    return students.length;
  }, [students]);

  const handleAssignClass = async () => {
    setMessage({ type: '', text: '' });

    if (!facultyDepartment) {
      setMessage({ type: 'error', text: 'Please update your department in Profile first.' });
      return;
    }

    if (!selectedCourseDetails?.code) {
      setMessage({ type: 'error', text: `No courses configured for ${facultyDepartment} department.` });
      return;
    }

    if (!selectedStaffDetails) {
      setMessage({ type: 'error', text: `No active staff configured for ${facultyDepartment} department.` });
      return;
    }

    if (!venue.trim()) {
      setMessage({ type: 'error', text: 'Please enter a venue.' });
      return;
    }

    setIsAssigning(true);

    try {
      const assignedRows = await assignClassToDepartment({
        departmentCode: facultyDepartment,
        selectedCourse: selectedCourseDetails,
        venue,
        staffName: selectedStaffDetails.name,
        staffEmail: selectedStaffDetails.email,
        facultyEmail: user?.email,
      });

      setMessage({
        type: 'success',
        text: `${selectedCourseDetails.code} assigned to ${assignedRows.length} students in ${facultyDepartment} with venue ${venue}.`,
      });
    } catch (error) {
      console.error('Failed to assign class:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to assign class.' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleStartEditVenue = (row) => {
    setEditingCourseCode(row.courseCode);
    setEditingVenue(VENUE_OPTIONS.includes(row.venue) ? row.venue : 'SF');
  };

  const handleUpdateVenue = async () => {
    if (!facultyDepartment || !editingCourseCode) return;

    setIsSavingVenue(true);
    try {
      const updatedRows = await updateClassAssignmentVenueByDepartmentCourse({
        departmentCode: facultyDepartment,
        courseCode: editingCourseCode,
        venue: editingVenue,
      });

      setMessage({
        type: 'success',
        text: `Venue updated to ${editingVenue} for ${editingCourseCode} (${updatedRows.length} students).`,
      });
      setEditingCourseCode('');
    } catch (error) {
      console.error('Failed to update venue:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to update venue.' });
    } finally {
      setIsSavingVenue(false);
    }
  };

  const handleDeleteAssignment = async (courseCode) => {
    if (!facultyDepartment || !courseCode) return;

    setIsDeletingCourse(true);
    try {
      const deletedRows = await deleteClassAssignmentsByDepartmentCourse({
        departmentCode: facultyDepartment,
        courseCode,
      });

      setMessage({
        type: 'success',
        text: `${courseCode} assignments deleted for ${deletedRows.length} students.`,
      });
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      setMessage({ type: 'error', text: error?.message || 'Failed to delete assignment.' });
    } finally {
      setIsDeletingCourse(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Faculty Dashboard</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Manage your courses and student progress</Typography>
      </Box>

      <Grid container spacing={3}>
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Grid key={index} size={{ xs: 12, md: 6, lg: 3 }}>
            <Card sx={glassCardSx}><CardContent sx={{ p: 3 }}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Box><Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>{stat.title}</Typography><Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', mt: 1 }}>{stat.value}</Typography><Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mt: 0.5 }}>{stat.description}</Typography></Box><Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: stat.color === 'bg-blue-500' ? '#3b82f6' : stat.color === 'bg-green-500' ? '#22c55e' : stat.color === 'bg-orange-500' ? '#f97316' : '#a855f7' }}><Icon size={24} color="#fff" /></Box></Box></CardContent></Card>
            </Grid>
          );
        })}
      </Grid>

      <Card sx={glassCardSx}>
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', mb: 0.5 }}>
            Assign Class to Department Students
          </Typography>
          <Typography sx={{ color: '#6b7280', mb: 2.5 }}>
            Assign class, venue, and staff for students in your department.
          </Typography>

          {message.text && (
            <Alert severity={message.type === 'success' ? 'success' : 'error'} sx={{ mb: 2 }}>
              {message.text}
            </Alert>
          )}

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
                  disabled={isAssigning}
                  sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
                >
                  {isAssigning ? 'Assigning...' : 'Assign Class'}
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

              {!isLoadingAssignedRows && assignedRows.map((row) => {
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
                            disabled={isSavingVenue}
                            sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
                          >
                            {isSavingVenue ? 'Saving...' : 'Save'}
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
                            disabled={isDeletingCourse}
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
        </CardContent>
      </Card>
    </Box>
  );
};

export default FacultyDashboard;
