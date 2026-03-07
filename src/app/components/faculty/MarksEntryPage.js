import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { Save, Download, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { deleteMarksForCourse, getMarksForCourse, getStudents, saveMarksForCourse } from '../../lib/academicDataApi';

const calculateGrade = (total) => {
  if (total >= 90) return 'A+';
  if (total >= 85) return 'A';
  if (total >= 80) return 'A-';
  if (total >= 75) return 'B+';
  if (total >= 70) return 'B';
  if (total >= 65) return 'B-';
  if (total >= 60) return 'C+';
  if (total >= 55) return 'C';
  if (total >= 50) return 'D';
  return 'F';
};

const calculateTotal = (student) => (student.midTerm * 0.3) + (student.assignment * 0.2) + (student.quiz * 0.1) + (student.endTerm * 0.4);

export const MarksEntryPage = () => {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState('CS301');
  const [selectedExam, setSelectedExam] = useState('midterm');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const courses = [
    { code: 'CS301', name: 'Data Structures & Algorithms' },
    { code: 'CS402', name: 'Database Management Systems' },
    { code: 'CS303', name: 'Operating Systems' },
    { code: 'CS501', name: 'Software Engineering' },
  ];

  const examTypes = [
    { value: 'midterm', label: 'Mid-term Exam' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'quiz', label: 'Quizzes' },
    { value: 'endterm', label: 'End-term Exam' },
  ];

  const [students, setStudents] = useState([]);

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(18px)',
    backgroundColor: 'rgba(255,255,255,0.74)',
    boxShadow: '0 14px 30px rgba(15,23,42,0.10)',
    border: '1px solid rgba(148,163,184,0.20)',
  };

  const facultyDepartment = (user?.department || '').trim().toUpperCase();

  const belongsToFacultyDepartment = (student) => {
    if (!facultyDepartment) return true;
    const profileDepartment = (student.department || '').trim().toUpperCase();
    const emailDepartment = ((student.email || '').match(/\.([a-z]{2})\d*@/i) || [])[1]?.toUpperCase() || '';
    return profileDepartment === facultyDepartment || emailDepartment === facultyDepartment;
  };

  useEffect(() => {
    const loadStudents = async () => {
      setIsLoadingStudents(true);
      try {
        const studentRows = await getStudents();
        const scopedStudents = user?.role === 'faculty'
          ? studentRows.filter((student) => belongsToFacultyDepartment(student))
          : studentRows;

        const initial = scopedStudents.map((student) => {
          const mapped = {
            ...student,
            midTerm: 0,
            assignment: 0,
            quiz: 0,
            endTerm: 0,
          };
          const total = calculateTotal(mapped);
          return {
            ...mapped,
            total,
            grade: calculateGrade(total),
          };
        });

        setStudents(initial);
      } catch (error) {
        console.error('Failed to load students:', error);
        alert(`Failed to load students: ${error?.message || 'Check students table setup in Supabase.'}`);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    loadStudents();
  }, [user?.role, user?.department]);

  const updateMark = (id, field, value) => {
    setStudents((prevStudents) => prevStudents.map((student) => {
      if (student.id !== id) return student;
      const updated = { ...student, [field]: value };
      const total = calculateTotal(updated);
      return { ...updated, total, grade: calculateGrade(total) };
    }));
  };

  useEffect(() => {
    const loadExistingMarks = async () => {
      if (!students.length) return;

      setIsLoadingExisting(true);
      try {
        const existingRows = await getMarksForCourse(selectedCourse);

        if (!existingRows.length) return;

        const marksByEmail = new Map(
          existingRows.map((row) => [row.student_email, row])
        );

        setStudents((prev) =>
          prev.map((student) => {
            const row = marksByEmail.get(student.email);
            if (!row) return student;

            const updated = {
              ...student,
              midTerm: Number(row.mid_term ?? student.midTerm),
              assignment: Number(row.assignment ?? student.assignment),
              quiz: Number(row.quiz ?? student.quiz),
              endTerm: Number(row.end_term ?? student.endTerm),
            };

            const total = calculateTotal(updated);
            return {
              ...updated,
              total,
              grade: calculateGrade(total),
            };
          })
        );
      } catch (error) {
        console.error('Failed to load existing marks:', error);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    loadExistingMarks();
  }, [selectedCourse, students.length]);

  useEffect(() => {
    setPage(0);
  }, [selectedCourse, rowsPerPage, students.length]);

  const handleSave = async () => {
    const selectedCourseDetails = courses.find((course) => course.code === selectedCourse) || courses[0];

    setIsSaving(true);
    try {
      await saveMarksForCourse({
        students,
        selectedCourse: selectedCourseDetails,
        facultyEmail: user?.email,
      });
      alert('Marks saved to database successfully.');
    } catch (error) {
      console.error('Failed to save marks:', error);
      alert('Failed to save marks. Check table setup and RLS policy in Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMarksForCourse(selectedCourse);
      alert('Marks records deleted from database successfully.');
    } catch (error) {
      console.error('Failed to delete marks:', error);
      alert('Failed to delete marks. Check table setup and RLS policy in Supabase.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => alert('Exporting marks to CSV...');

  const avgMidTerm = students.length ? (students.reduce((acc, s) => acc + s.midTerm, 0) / students.length).toFixed(1) : '0.0';
  const avgAssignment = students.length ? (students.reduce((acc, s) => acc + s.assignment, 0) / students.length).toFixed(1) : '0.0';
  const avgQuiz = students.length ? (students.reduce((acc, s) => acc + s.quiz, 0) / students.length).toFixed(1) : '0.0';
  const avgEndTerm = students.length ? (students.reduce((acc, s) => acc + s.endTerm, 0) / students.length).toFixed(1) : '0.0';
  const avgTotal = students.length ? (students.reduce((acc, s) => acc + s.total, 0) / students.length).toFixed(1) : '0.0';

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

      <Card sx={glassCardSx}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Select Course</InputLabel>
                <Select value={selectedCourse} label="Select Course" onChange={(e) => setSelectedCourse(e.target.value)}>
                  {courses.map(course => <MenuItem key={course.code} value={course.code}>{course.code} - {course.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Exam Type</InputLabel>
                <Select value={selectedExam} label="Exam Type" onChange={(e) => setSelectedExam(e.target.value)}>
                  {examTypes.map(exam => <MenuItem key={exam.value} value={exam.value}>{exam.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', mb: 1 }}>Actions</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={handleExport} variant="outlined" fullWidth size="small" sx={{ textTransform: 'none' }} startIcon={<Download size={14} />}>Export</Button>
                <Button variant="outlined" fullWidth size="small" sx={{ textTransform: 'none' }} startIcon={<Upload size={14} />}>Import</Button>
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
              <Button onClick={handleSave} disabled={isSaving} variant="contained" sx={{ textTransform: 'none', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' } }} startIcon={<Save size={16} />}>{isSaving ? 'Saving...' : 'Save Marks'}</Button>
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
          <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(148,163,184,0.22)', backgroundColor: 'rgba(255,255,255,0.62)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Roll No.</TableCell>
                  <TableCell>Student Name</TableCell>
                  <TableCell align="center">Mid-Term (30%)</TableCell>
                  <TableCell align="center">Assignment (20%)</TableCell>
                  <TableCell align="center">Quiz (10%)</TableCell>
                  <TableCell align="center">End-Term (40%)</TableCell>
                  <TableCell align="center">Total</TableCell>
                  <TableCell align="center">Grade</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell sx={{ fontWeight: 500 }}>{student.rollNo}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell align="center"><TextField type="number" size="small" inputProps={{ min: 0, max: 100 }} value={student.midTerm} onChange={(e) => updateMark(student.id, 'midTerm', Number(e.target.value))} sx={{ width: 80 }} /></TableCell>
                    <TableCell align="center"><TextField type="number" size="small" inputProps={{ min: 0, max: 100 }} value={student.assignment} onChange={(e) => updateMark(student.id, 'assignment', Number(e.target.value))} sx={{ width: 80 }} /></TableCell>
                    <TableCell align="center"><TextField type="number" size="small" inputProps={{ min: 0, max: 100 }} value={student.quiz} onChange={(e) => updateMark(student.id, 'quiz', Number(e.target.value))} sx={{ width: 80 }} /></TableCell>
                    <TableCell align="center"><TextField type="number" size="small" inputProps={{ min: 0, max: 100 }} value={student.endTerm} onChange={(e) => updateMark(student.id, 'endTerm', Number(e.target.value))} sx={{ width: 80 }} /></TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{student.total.toFixed(1)}</TableCell>
                    <TableCell align="center"><Chip size="small" label={student.grade} sx={gradeChip(student.grade)} /></TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 600 }}>Class Average</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{avgMidTerm}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{avgAssignment}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{avgQuiz}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{avgEndTerm}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{avgTotal}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>-</TableCell>
                </TableRow>
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
