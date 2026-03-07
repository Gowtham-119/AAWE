import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  TablePagination,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowUpDown, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import {
  getStudents,
  getAttendanceForCourseDate,
  saveAttendanceForCourseDate,
} from '../../lib/academicDataApi';
import { supabase } from '../../lib/supabaseClient.js';

export const AttendancePage = () => {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState('CS301');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState({});
  const [page, setPage] = useState(0);

  const courses = [
    { code: 'CS301', name: 'Data Structures & Algorithms' },
    { code: 'CS402', name: 'Database Management Systems' },
    { code: 'CS303', name: 'Operating Systems' },
    { code: 'CS501', name: 'Software Engineering' },
  ];

  const [students, setStudents] = useState([]);

  const rowsPerPage = 150;

  const extractDepartmentCode = (email) => {
    const match = (email || '').trim().toLowerCase().match(/\.([a-z]{2})\d*@/);
    return match?.[1]?.toUpperCase() || 'NA';
  };

  const getStudentDepartmentCode = (student) => {
    const derived = extractDepartmentCode(student.email);
    if (derived !== 'NA') return derived;
    return student.departmentCode || 'NA';
  };

  useEffect(() => {
    const loadStudents = async () => {
      setIsLoadingStudents(true);
      try {
        const studentRows = await getStudents();
        setStudents(studentRows);
      } catch (error) {
        console.error('Failed to load students:', error);
        alert(`Failed to load students: ${error?.message || 'Check students table setup in Supabase.'}`);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    loadStudents();
  }, []);

  const selectedCourseDetails = courses.find((course) => course.code === selectedCourse) || courses[0];

  const departmentOptions = useMemo(() => {
    const dynamicCodes = new Set(
      students
        .map((student) => getStudentDepartmentCode(student))
        .filter((code) => code && code !== 'NA')
    );
    return ['ALL', ...Array.from(dynamicCodes).sort((a, b) => a.localeCompare(b))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return students
      .filter((student) => {
        const departmentCode = getStudentDepartmentCode(student);
        if (selectedDepartment !== 'ALL' && departmentCode !== selectedDepartment) return false;

        if (!normalizedSearch) return true;

        const rollNo = (student.rollNo || '').toLowerCase();
        const name = (student.name || '').toLowerCase();
        return rollNo.includes(normalizedSearch) || name.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const deptSort = getStudentDepartmentCode(a).localeCompare(getStudentDepartmentCode(b));
        if (deptSort !== 0) return deptSort;
        return (a.rollNo || '').localeCompare(b.rollNo || '');
      });
  }, [students, selectedDepartment, searchTerm]);

  const pagedStudents = filteredStudents.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  useEffect(() => {
    setPage(0);
  }, [selectedDepartment, searchTerm]);

  useEffect(() => {
    const loadExistingAttendance = async () => {
      if (!students.length) return;

      setIsLoadingExisting(true);

      try {
        const existingRows = await getAttendanceForCourseDate({
          courseCode: selectedCourse,
          selectedDate,
        });

        if (!existingRows.length) return;

        const attendanceByEmail = new Map(
          existingRows.map((row) => [row.student_email, row.is_present])
        );

        setStudents((prev) =>
          prev.map((student) => {
            if (!attendanceByEmail.has(student.email)) return student;
            return {
              ...student,
              attendance: Boolean(attendanceByEmail.get(student.email)),
            };
          })
        );
      } catch (error) {
        console.error('Failed to load existing attendance:', error);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    loadExistingAttendance();
  }, [selectedCourse, selectedDate, students.length]);

  useEffect(() => {
    if (!selectedCourse || !selectedDate) return undefined;

    const channel = supabase
      .channel(`faculty-attendance-live-${selectedCourse}-${selectedDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `course_code=eq.${selectedCourse}`,
        },
        async () => {
          try {
            const existingRows = await getAttendanceForCourseDate({ courseCode: selectedCourse, selectedDate });
            const attendanceByEmail = new Map(existingRows.map((row) => [row.student_email, row.is_present]));
            setStudents((prev) =>
              prev.map((student) => {
                if (!attendanceByEmail.has(student.email)) return student;
                return {
                  ...student,
                  attendance: Boolean(attendanceByEmail.get(student.email)),
                };
              })
            );
          } catch (error) {
            console.error('Realtime attendance sync failed:', error);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedCourse, selectedDate]);

  const updateStudentAttendance = async (student, isPresent) => {
    if (!student || pendingUpdates[student.id] || student.attendance === isPresent) return;

    const previousValue = Boolean(student.attendance);

    setPendingUpdates((prev) => ({ ...prev, [student.id]: true }));
    setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, attendance: isPresent } : s)));

    try {
      await saveAttendanceForCourseDate({
        students: [{ ...student, attendance: isPresent }],
        selectedCourse: selectedCourseDetails,
        selectedDate,
        facultyEmail: user?.email,
      });
    } catch (error) {
      console.error('Failed to update attendance instantly:', error);
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, attendance: previousValue } : s)));
      alert(`Failed to update attendance: ${error?.message || 'Please try again.'}`);
    } finally {
      setPendingUpdates((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });
    }
  };

  const presentCount = filteredStudents.filter((s) => s.attendance).length;
  const absentCount = filteredStudents.length - presentCount;
  const attendancePercentage = filteredStudents.length
    ? ((presentCount / filteredStudents.length) * 100).toFixed(1)
    : '0.0';

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Attendance Management</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Mark and manage student attendance</Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Select Course</InputLabel>
                <Select value={selectedCourse} label="Select Course" onChange={(e) => setSelectedCourse(e.target.value)}>
                  {courses.map((course) => (
                    <MenuItem key={course.code} value={course.code}>
                      {course.code} - {course.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="date"
                label="Select Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  px: 2,
                  py: 1.5,
                }}
              >
                <Typography sx={{ color: '#1d4ed8', fontWeight: 600, textAlign: 'center' }}>
                  Attendance updates are saved instantly.
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} />
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>Total Students</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{filteredStudents.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>Present</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>{presentCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>Absent</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>{absentCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>Attendance Rate</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>{attendancePercentage}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 2,
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(17, 24, 39, 0.06)',
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  fullWidth
                  placeholder="Search by Roll Number or Student Name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ display: 'inline-flex', color: '#6b7280', mr: 1 }}>
                        <Search size={16} />
                      </Box>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 999,
                      backgroundColor: '#fff',
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ArrowUpDown size={16} color="#6b7280" />
                  <FormControl fullWidth>
                    <InputLabel>Department</InputLabel>
                    <Select
                      value={selectedDepartment}
                      label="Department"
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      sx={{ borderRadius: 999, backgroundColor: '#fff' }}
                    >
                      {departmentOptions.map((departmentCode) => (
                        <MenuItem key={departmentCode} value={departmentCode}>
                          {departmentCode === 'ALL' ? 'All Departments' : departmentCode}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Grid>
            </Grid>
          </Box>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Roll No.</TableCell>
                <TableCell>Student Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Dept</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoadingExisting && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ color: '#6b7280' }}>
                    Loading existing attendance...
                  </TableCell>
                </TableRow>
              )}
              {isLoadingStudents && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ color: '#6b7280' }}>
                    Loading students...
                  </TableCell>
                </TableRow>
              )}
              {!isLoadingExisting && !isLoadingStudents && !pagedStudents.length && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ color: '#6b7280' }}>
                    No students match the current search/filter.
                  </TableCell>
                </TableRow>
              )}
              {pagedStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell sx={{ fontWeight: 500 }}>{student.rollNo}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  <TableCell sx={{ color: '#6b7280' }}>{student.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={getStudentDepartmentCode(student)}
                      sx={{ backgroundColor: '#e5e7eb', color: '#374151' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={student.attendance ? 'Present' : 'Absent'}
                      sx={{
                        backgroundColor: student.attendance ? '#dcfce7' : '#fee2e2',
                        color: student.attendance ? '#15803d' : '#b91c1c',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 999, p: 0.5, gap: 0.5 }}>
                      <Button
                        onClick={() => updateStudentAttendance(student, true)}
                        variant={student.attendance ? 'contained' : 'text'}
                        disabled={Boolean(pendingUpdates[student.id])}
                        size="small"
                        sx={{
                          minWidth: 88,
                          textTransform: 'none',
                          borderRadius: 999,
                          backgroundColor: student.attendance ? '#16a34a' : 'transparent',
                          color: student.attendance ? '#fff' : '#166534',
                          '&:hover': {
                            backgroundColor: student.attendance ? '#15803d' : '#dcfce7',
                          },
                        }}
                      >
                        Present
                      </Button>
                      <Button
                        onClick={() => updateStudentAttendance(student, false)}
                        variant={!student.attendance ? 'contained' : 'text'}
                        disabled={Boolean(pendingUpdates[student.id])}
                        size="small"
                        sx={{
                          minWidth: 88,
                          textTransform: 'none',
                          borderRadius: 999,
                          backgroundColor: !student.attendance ? '#dc2626' : 'transparent',
                          color: !student.attendance ? '#fff' : '#991b1b',
                          '&:hover': {
                            backgroundColor: !student.attendance ? '#b91c1c' : '#fee2e2',
                          },
                        }}
                      >
                        Absent
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filteredStudents.length}
            page={page}
            onPageChange={(_event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[150]}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0}
              sx={{ textTransform: 'none' }}
            >
              Previous
            </Button>
            <Button
              variant="contained"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={(page + 1) * rowsPerPage >= filteredStudents.length}
              sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }}
            >
              Next
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AttendancePage;
