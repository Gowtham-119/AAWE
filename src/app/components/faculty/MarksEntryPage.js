import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Copy, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import {
  deleteMarksForCourse,
  getDepartmentCourses,
  getMarksForCourse,
  getMarksForCourseInSemester,
  getStudents,
  getSystemSettings,
  saveMarksForCourse,
} from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { toast } from 'sonner';

const SAVE_DEBOUNCE_MS = 1000;

const clampNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
};

const calculateTotal = (student) => {
  const total = clampNumber(student.midTerm) + clampNumber(student.assignment) + clampNumber(student.quiz) + clampNumber(student.endTerm);
  return Number(total.toFixed(1));
};

const parseGradeBoundaries = (rawBoundaries) => {
  const defaultBoundaries = [
    { grade: 'A+', min: 90 },
    { grade: 'A', min: 80 },
    { grade: 'B', min: 70 },
    { grade: 'C', min: 60 },
    { grade: 'D', min: 50 },
    { grade: 'F', min: 0 },
  ];

  if (!rawBoundaries) return defaultBoundaries;

  try {
    const parsed = typeof rawBoundaries === 'string' ? JSON.parse(rawBoundaries) : rawBoundaries;
    if (!parsed || typeof parsed !== 'object') return defaultBoundaries;

    const normalized = Object.entries(parsed)
      .map(([grade, min]) => ({ grade: String(grade).toUpperCase(), min: Number(min) }))
      .filter((entry) => entry.grade && Number.isFinite(entry.min))
      .sort((left, right) => right.min - left.min);

    return normalized.length ? normalized : defaultBoundaries;
  } catch {
    return defaultBoundaries;
  }
};

const gradeForTotal = (total, boundaries) => {
  const found = boundaries.find((boundary) => total >= boundary.min);
  return found?.grade || 'F';
};

const getPreviousSemester = (currentSemester) => {
  const normalized = String(currentSemester || '').trim().toUpperCase();
  const match = normalized.match(/^(\d{4})-(ODD|EVEN)$/);
  if (!match) return '';

  const year = Number(match[1]);
  const term = match[2];
  if (term === 'EVEN') return `${year}-ODD`;
  return `${year - 1}-EVEN`;
};

export const MarksEntryPage = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowStatusById, setRowStatusById] = useState({});
  const [invalidCells, setInvalidCells] = useState({});

  const saveTimersRef = useRef({});

  const facultyDepartment = (user?.department || '').trim().toUpperCase();

  // Fetch system settings for score limits and grade boundaries
  const { data: systemSettings = {} } = useQuery({
    queryKey: ['system-settings'],
    queryFn: getSystemSettings,
    staleTime: LIVE_STALE_TIME_MS,
  });

  // Fetch courses for the faculty's department dynamically
  const { data: departmentCourses = [] } = useQuery({
    queryKey: ['faculty-department-courses', facultyDepartment],
    queryFn: () => getDepartmentCourses(facultyDepartment),
    enabled: Boolean(facultyDepartment),
    staleTime: LIVE_STALE_TIME_MS,
  });

  // Convert system settings score limits to an object
  const SCORE_LIMITS = useMemo(() => {
    if (!systemSettings.score_limits) {
      return { midTerm: 25, assignment: 10, quiz: 10, endTerm: 50 };
    }
    try {
      const parsed = typeof systemSettings.score_limits === 'string'
        ? JSON.parse(systemSettings.score_limits)
        : systemSettings.score_limits;
      return {
        midTerm: parsed.midTerm || 25,
        assignment: parsed.assignment || 10,
        quiz: parsed.quiz || 10,
        endTerm: parsed.endTerm || 50,
      };
    } catch {
      return { midTerm: 25, assignment: 10, quiz: 10, endTerm: 50 };
    }
  }, [systemSettings.score_limits]);

  // Auto-select first course when courses are fetched
  const [selectedCourse, setSelectedCourse] = useState('');
  const [students, setStudents] = useState([]);

  useEffect(() => {
    if (departmentCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(departmentCourses[0].code);
    }
  }, [departmentCourses, selectedCourse]);

  const belongsToFacultyDepartment = (student) => {
    if (!facultyDepartment) return true;
    const profileDepartment = (student.department || '').trim().toUpperCase();
    const emailDepartment = ((student.email || '').match(/\.([a-z]{2})\d*@/i) || [])[1]?.toUpperCase() || '';
    return profileDepartment === facultyDepartment || emailDepartment === facultyDepartment;
  };

  const { data: scopedStudents = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['faculty-marks-students', user?.role || '', facultyDepartment],
    staleTime: LIVE_STALE_TIME_MS,
    queryFn: async () => {
      const studentRows = [];
      let nextPage = 1;
      const pageSize = 500;
      let total = 0;

      do {
        const result = await getStudents({ page: nextPage, pageSize });
        total = result.total || 0;
        studentRows.push(...(result.data || []));
        nextPage += 1;
      } while (studentRows.length < total);

      return user?.role === 'faculty'
        ? studentRows.filter((student) => belongsToFacultyDepartment(student))
        : studentRows;
    },
  });

  const { data: existingRows = [], isLoading: isLoadingExisting } = useQuery({
    queryKey: queryKeys.faculty.marksByCourse(selectedCourse),
    queryFn: () => getMarksForCourse(selectedCourse),
    enabled: Boolean(selectedCourse),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const gradeBoundaries = useMemo(() => parseGradeBoundaries(systemSettings.grade_boundaries), [systemSettings.grade_boundaries]);

  const selectedCourseDetails = useMemo(
    () => departmentCourses.find((course) => course.code === selectedCourse) || null,
    [departmentCourses, selectedCourse]
  );

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(18px)',
    backgroundColor: 'rgba(255,255,255,0.74)',
    boxShadow: '0 14px 30px rgba(15,23,42,0.10)',
    border: '1px solid rgba(148,163,184,0.20)',
  };

  const currentSemester = String(systemSettings.current_semester || '').trim().toUpperCase();
  const previousSemester = getPreviousSemester(currentSemester);

  const clearSaveTimer = (studentId) => {
    const timerId = saveTimersRef.current[studentId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete saveTimersRef.current[studentId];
    }
  };

  const hasInvalidRow = (studentId) => {
    return Object.keys(SCORE_LIMITS).some((field) => Boolean(invalidCells[`${studentId}:${field}`]));
  };

  const saveStudentRow = async (studentId) => {
    const student = students.find((row) => row.id === studentId);
    if (!student || !selectedCourseDetails) return;
    if (hasInvalidRow(studentId)) {
      setRowStatusById((prev) => ({ ...prev, [studentId]: 'error' }));
      return;
    }

    const total = calculateTotal(student);
    const grade = gradeForTotal(total, gradeBoundaries);
    setRowStatusById((prev) => ({ ...prev, [studentId]: 'saving' }));

    try {
      await saveMarksForCourse({
        students: [{ ...student, total, grade }],
        selectedCourse: selectedCourseDetails,
        facultyEmail: user?.email,
        actorEmail: user?.email,
        actorRole: user?.role,
      });

      setStudents((prev) => prev.map((row) => (
        row.id === studentId ? { ...row, total, grade } : row
      )));
      setRowStatusById((prev) => ({ ...prev, [studentId]: 'saved' }));
    } catch (error) {
      console.error('Failed to auto-save marks row:', error);
      setRowStatusById((prev) => ({ ...prev, [studentId]: 'error' }));
    }
  };

  const scheduleStudentSave = (studentId) => {
    clearSaveTimer(studentId);
    setRowStatusById((prev) => ({ ...prev, [studentId]: 'saving' }));
    saveTimersRef.current[studentId] = window.setTimeout(() => {
      void saveStudentRow(studentId);
    }, SAVE_DEBOUNCE_MS);
  };

  const updateMark = (id, field, rawValue) => {
    const maxScore = SCORE_LIMITS[field];
    const normalizedValue = rawValue === '' ? '' : Number(rawValue);
    const isInvalid = rawValue === '' || Number.isNaN(normalizedValue) || normalizedValue < 0 || normalizedValue > maxScore;

    setInvalidCells((prev) => ({ ...prev, [`${id}:${field}`]: isInvalid }));

    setStudents((prevStudents) => prevStudents.map((student) => {
      if (student.id !== id) return student;
      const updated = { ...student, [field]: normalizedValue };
      const total = calculateTotal(updated);
      return { ...updated, total };
    }));

    if (isInvalid) {
      clearSaveTimer(id);
      setRowStatusById((prev) => ({ ...prev, [id]: 'error' }));
      return;
    }

    scheduleStudentSave(id);
  };

  useEffect(() => {
    const marksByEmail = new Map(existingRows.map((row) => [row.student_email, row]));

    const merged = scopedStudents.map((student) => {
      const row = marksByEmail.get(student.email);
      const updated = {
        ...student,
        midTerm: Number(row?.mid_term ?? 0),
        assignment: Number(row?.assignment ?? 0),
        quiz: Number(row?.quiz ?? 0),
        endTerm: Number(row?.end_term ?? 0),
      };
      const total = calculateTotal(updated);
      return {
        ...updated,
        total,
        grade: String(row?.grade || gradeForTotal(total, gradeBoundaries)).toUpperCase(),
      };
    });

    setStudents(merged);
    setInvalidCells({});
    setRowStatusById({});
  }, [existingRows, scopedStudents, gradeBoundaries]);

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [selectedCourse, rowsPerPage, students.length, currentSemester]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMarksForCourse(selectedCourse);
      toast.success('Marks records deleted successfully.');
    } catch (error) {
      console.error('Failed to delete marks:', error);
      toast.error('Failed to delete marks.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyFromLastSemester = async () => {
    if (!selectedCourse || !previousSemester) {
      toast.error('Previous semester is unavailable for copy.');
      return;
    }

    try {
      const previousRows = await getMarksForCourseInSemester({
        courseCode: selectedCourse,
        semester: previousSemester,
      });
      const marksByEmail = new Map(previousRows.map((row) => [row.student_email, row]));

      setStudents((prev) => prev.map((student) => {
        const row = marksByEmail.get(student.email);
        if (!row) return student;

        const updated = {
          ...student,
          midTerm: Number(row.mid_term ?? 0),
          assignment: Number(row.assignment ?? 0),
          quiz: Number(row.quiz ?? 0),
          endTerm: Number(row.end_term ?? 0),
        };

        const total = calculateTotal(updated);
        return {
          ...updated,
          total,
          grade: String(row.grade || gradeForTotal(total, gradeBoundaries)).toUpperCase(),
        };
      }));

      setInvalidCells({});
      setRowStatusById({});
      toast.success(`Marks copied from ${previousSemester}. Review and modify before autosave.`);
    } catch (error) {
      console.error('Failed to copy marks from last semester:', error);
      toast.error(error?.message || 'Failed to copy marks from last semester.');
    }
  };

  const handleExport = () => toast.info('Exporting marks to CSV...');

  const totals = students.map((student) => calculateTotal(student));
  const classAverage = totals.length ? (totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(1) : '0.0';
  const highest = totals.length ? Math.max(...totals).toFixed(1) : '0.0';
  const lowest = totals.length ? Math.min(...totals).toFixed(1) : '0.0';
  const passRate = totals.length ? ((totals.filter((value) => value >= 50).length / totals.length) * 100).toFixed(1) : '0.0';

  const paginatedStudents = useMemo(() => {
    const start = page * rowsPerPage;
    return students.slice(start, start + rowsPerPage);
  }, [students, page, rowsPerPage]);

  const gradeChip = (grade) => ({
    backgroundColor: grade.startsWith('A') ? '#dcfce7' : grade.startsWith('B') ? '#dbeafe' : grade.startsWith('C') ? '#fef3c7' : '#fee2e2',
    color: grade.startsWith('A') ? '#15803d' : grade.startsWith('B') ? '#1d4ed8' : grade.startsWith('C') ? '#a16207' : '#b91c1c',
  });

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25, background: 'radial-gradient(circle at 0% 0%, rgba(186,230,253,0.20), transparent 34%), radial-gradient(circle at 100% 100%, rgba(221,214,254,0.18), transparent 36%)' }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' }}>Marks Entry</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>
          Enter and manage student marks{facultyDepartment ? ` for ${facultyDepartment}` : ''}
        </Typography>
      </Box>

      <Alert severity="info">
        Class Average: {classAverage} | Highest: {highest} | Lowest: {lowest} | Pass Rate: {passRate}%
      </Alert>

      <Card sx={glassCardSx}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Select Course</InputLabel>
                <Select value={selectedCourse} label="Select Course" onChange={(e) => setSelectedCourse(e.target.value)}>
                  {departmentCourses.map(course => <MenuItem key={course.code} value={course.code}>{course.code} - {course.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Active Semester"
                value={currentSemester || 'N/A'}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', mb: 1 }}>Actions</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={handleExport} variant="outlined" fullWidth size="small" sx={{ textTransform: 'none' }} startIcon={<Download size={14} />}>Export</Button>
                <Button
                  onClick={handleCopyFromLastSemester}
                  variant="outlined"
                  fullWidth
                  size="small"
                  sx={{ textTransform: 'none' }}
                  startIcon={<Copy size={14} />}
                  disabled={!previousSemester}
                >
                  Copy from Last Semester
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={glassCardSx}>
        <CardHeader
          title="Student Marks"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                variant="outlined"
                color="error"
                sx={{ textTransform: 'none' }}
                startIcon={<Trash2 size={16} />}
              >
                {isDeleting ? 'Deleting...' : 'Delete Marks'}
              </Button>
            </Box>
          }
        />
        <CardContent>
          {isLoadingExisting && (
            <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
              Loading existing marks...
            </Typography>
          )}
          {isLoadingStudents && (
            <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
              Loading students...
            </Typography>
          )}
          <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(148,163,184,0.22)', backgroundColor: 'rgba(255,255,255,0.62)', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Roll No.</TableCell>
                  <TableCell>Student Name</TableCell>
                  <TableCell align="center">Mid-Term (Max 25)</TableCell>
                  <TableCell align="center">Assignment (Max 10)</TableCell>
                  <TableCell align="center">Quiz (Max 10)</TableCell>
                  <TableCell align="center">End-Term (Max 50)</TableCell>
                  <TableCell align="center">Total</TableCell>
                  <TableCell align="center">Grade</TableCell>
                  <TableCell align="center">Row Save</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell sx={{ fontWeight: 500 }}>{student.rollNo}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, max: 25 }}
                        value={student.midTerm}
                        error={Boolean(invalidCells[`${student.id}:midTerm`])}
                        onChange={(e) => updateMark(student.id, 'midTerm', e.target.value)}
                        sx={{ width: 96 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, max: 10 }}
                        value={student.assignment}
                        error={Boolean(invalidCells[`${student.id}:assignment`])}
                        onChange={(e) => updateMark(student.id, 'assignment', e.target.value)}
                        sx={{ width: 96 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, max: 10 }}
                        value={student.quiz}
                        error={Boolean(invalidCells[`${student.id}:quiz`])}
                        onChange={(e) => updateMark(student.id, 'quiz', e.target.value)}
                        sx={{ width: 96 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, max: 50 }}
                        value={student.endTerm}
                        error={Boolean(invalidCells[`${student.id}:endTerm`])}
                        onChange={(e) => updateMark(student.id, 'endTerm', e.target.value)}
                        sx={{ width: 96 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{calculateTotal(student).toFixed(1)}</TableCell>
                    <TableCell align="center"><Chip size="small" label={student.grade} sx={gradeChip(student.grade)} /></TableCell>
                    <TableCell align="center">
                      {rowStatusById[student.id] === 'saving' && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Saving...</Typography>
                      )}
                      {rowStatusById[student.id] === 'saved' && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#15803d' }}>Saved</Typography>
                      )}
                      {rowStatusById[student.id] === 'error' && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#b91c1c' }}>Fix invalid values</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={students.length}
            page={page}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sx={{ mt: 1 }}
          />
        </CardContent>
      </Card>

    </Box>
  );
};

export default MarksEntryPage;
