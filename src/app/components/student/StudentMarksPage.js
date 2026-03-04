import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, CardHeader, Chip,
  Grid, LinearProgress, Table, TableBody,
  TableCell, TableHead, TableRow,
  TableContainer, Typography
} from '@mui/material';
import { TrendingUp, Award, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getMarksByStudentEmail } from '../../lib/academicDataApi';

const StudentMarksPage = () => {
  const { user } = useAuth();
  const [marksRows, setMarksRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMarks = async () => {
      setIsLoading(true);
      try {
        const rows = await getMarksByStudentEmail(user?.email || '');
        setMarksRows(rows);
      } catch (error) {
        console.error('Failed to fetch marks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.email) {
      loadMarks();
    } else {
      setMarksRows([]);
      setIsLoading(false);
    }
  }, [user?.email]);

  const courses = useMemo(
    () =>
      marksRows.map((row, index) => ({
        id: `${row.course_code}-${index}`,
        name: row.course_name || row.course_code,
        code: row.course_code,
        credits: 4,
        midTerm: Number(row.mid_term ?? 0),
        assignment: Number(row.assignment ?? 0),
        quiz: Number(row.quiz ?? 0),
        endTerm: Number(row.end_term ?? 0),
        total: Number(row.total ?? 0),
        grade: row.grade || 'F',
      })),
    [marksRows]
  );

  const totalCredits = courses.reduce((a, c) => a + c.credits, 0);
  const weightedTotal = courses.reduce((a, c) => a + c.total * c.credits, 0);
  const overallPercentage = totalCredits ? (weightedTotal / totalCredits).toFixed(1) : '0.0';

  const gradePoints = {
    'A+': 4.0, A: 4.0, 'A-': 3.7,
    'B+': 3.3, B: 3.0, 'B-': 2.7,
    C: 2.0, D: 1.0, F: 0.0
  };

  const actualGPA = (
    totalCredits
      ? courses.reduce((a, c) => a + (gradePoints[c.grade] ?? 0) * c.credits, 0) / totalCredits
      : 0
  ).toFixed(2);

  const gradeChip = (grade) => ({
    backgroundColor: grade.startsWith('A') ? '#dcfce7' :
                     grade.startsWith('B') ? '#dbeafe' : '#fef3c7',
    color: grade.startsWith('A') ? '#15803d' :
           grade.startsWith('B') ? '#1d4ed8' : '#a16207',
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700}>My Marks</Typography>

      <Grid container spacing={3} mt={1}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography>Overall Percentage</Typography>
              <Typography variant="h5">{overallPercentage}%</Typography>
              <LinearProgress value={overallPercentage} variant="determinate" />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography>CGPA</Typography>
              <Typography variant="h5">{actualGPA}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography>Total Credits</Typography>
              <Typography variant="h5">{totalCredits}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 4 }}>
        <CardHeader title="Course-wise Performance" />
        <CardContent>
          {isLoading && (
            <Typography sx={{ mb: 2, color: '#6b7280' }}>Loading marks...</Typography>
          )}
          {!isLoading && courses.length === 0 && (
            <Typography sx={{ mb: 2, color: '#6b7280' }}>
              No marks records found in database for {user?.email}.
            </Typography>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell align="center">Credits</TableCell>
                  <TableCell align="center">Mid</TableCell>
                  <TableCell align="center">Assignment</TableCell>
                  <TableCell align="center">Quiz</TableCell>
                  <TableCell align="center">End</TableCell>
                  <TableCell align="center">Total</TableCell>
                  <TableCell align="center">Grade</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {courses.map(course => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <Typography fontWeight={500}>{course.name}</Typography>
                      <Typography variant="caption">{course.code}</Typography>
                    </TableCell>
                    <TableCell align="center">{course.credits}</TableCell>
                    <TableCell align="center">{course.midTerm}</TableCell>
                    <TableCell align="center">{course.assignment}</TableCell>
                    <TableCell align="center">{course.quiz}</TableCell>
                    <TableCell align="center">{course.endTerm}</TableCell>
                    <TableCell align="center">{course.total.toFixed(1)}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={course.grade} sx={gradeChip(course.grade)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StudentMarksPage;