import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, CardHeader, Chip,
  Grid, LinearProgress, Table, TableBody,
  TableCell, TableHead, TableRow,
  TableContainer, Typography
} from '@mui/material';
import { TrendingUp, Award, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getMarksByStudentEmail } from '../../lib/academicDataApi';
import { supabase } from '../../lib/supabaseClient.js';

const StudentMarksPage = () => {
  const { user } = useAuth();
  const [marksRows, setMarksRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  const loadMarks = useCallback(async () => {
    const normalizedEmail = (user?.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setMarksRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const rows = await getMarksByStudentEmail(normalizedEmail);
      setMarksRows(rows);
    } catch (error) {
      console.error('Failed to fetch marks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    void loadMarks();
  }, [loadMarks]);

  useEffect(() => {
    if (!user?.email) return undefined;

    const channel = supabase
      .channel(`student-marks-live-${user.email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marks_records' },
        () => {
          void loadMarks();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.email, loadMarks]);

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

  const statCards = [
    {
      title: 'Overall Percentage',
      value: `${overallPercentage}%`,
      progress: Number(overallPercentage),
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 55%, #d1fae5 100%)',
      iconBg: '#0ea5e9',
      progressColor: '#0ea5e9',
    },
    {
      title: 'CGPA',
      value: actualGPA,
      progress: Number((Number(actualGPA) / 4) * 100),
      icon: Award,
      gradient: 'linear-gradient(135deg, #ede9fe 0%, #f5d0fe 100%)',
      iconBg: '#8b5cf6',
      progressColor: '#8b5cf6',
    },
    {
      title: 'Total Credits',
      value: String(totalCredits),
      progress: Math.min(100, totalCredits * 8),
      icon: FileText,
      gradient: 'linear-gradient(135deg, #ffedd5 0%, #fde68a 100%)',
      iconBg: '#f97316',
      progressColor: '#f97316',
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, background: 'radial-gradient(circle at top right, rgba(125,211,252,0.12), transparent 38%), radial-gradient(circle at bottom left, rgba(216,180,254,0.12), transparent 45%)' }}>
      <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em' }}>My Marks</Typography>

      <Grid container spacing={2} mt={0.5}>
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.title} size={{ xs: 12, md: 4 }}>
              <Card sx={{ ...glassCardSx, background: item.gradient }}>
                <CardContent sx={{ p: 2.25 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.2 }}>
                    <Box>
                      <Typography sx={{ color: '#334155', fontSize: '0.86rem' }}>{item.title}</Typography>
                      <Typography sx={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.1, color: '#0f172a', mt: 0.35 }}>{item.value}</Typography>
                    </Box>
                    <Box sx={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: item.iconBg, display: 'grid', placeItems: 'center', boxShadow: '0 10px 18px rgba(15,23,42,0.16)' }}>
                      <Icon size={19} color="#fff" />
                    </Box>
                  </Box>
                  <LinearProgress value={item.progress} variant="determinate" sx={{ height: 7, borderRadius: 99, '& .MuiLinearProgress-bar': { backgroundColor: item.progressColor } }} />
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card sx={{ ...glassCardSx, mt: 2.25, borderColor: 'rgba(99,102,241,0.18)' }}>
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
            <Table size="small" sx={{ '& .MuiTableCell-head': { color: '#475569', fontWeight: 700, backgroundColor: 'rgba(241,245,249,0.6)' } }}>
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