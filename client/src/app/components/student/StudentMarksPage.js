import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Card, CardContent, CardHeader, Chip,
  Grid, LinearProgress, Table, TableBody,
  TableCell, TableHead, TableRow,
  TableContainer, Typography
} from '@mui/material';
import { TrendingUp, Award, FileText, BookOpen } from 'lucide-react';
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../../context/AuthContext.js';
import { getMarksByStudentEmail } from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';
import EmptyState from '../ui/EmptyState.jsx';

const COMPONENT_MAX = {
  midTerm: 25,
  assignment: 15,
  quiz: 10,
  endTerm: 50,
};

const PASS_GRADE_SET = new Set(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D']);

const StudentMarksPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();

  const { data: marksRows = [], isLoading } = useQuery({
    queryKey: queryKeys.student.marks(normalizedEmail),
    queryFn: () => getMarksByStudentEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  useEffect(() => {
    if (!normalizedEmail) return undefined;

    const channel = supabase
      .channel(`student-marks-live-${normalizedEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marks_records' },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.marks(normalizedEmail) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [normalizedEmail, queryClient]);

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

  const totalCourses = courses.length;
  const passedCourses = courses.filter((course) => PASS_GRADE_SET.has(String(course.grade || '').toUpperCase())).length;
  const failedCourses = totalCourses - passedCourses;

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

  const semesterSummary = {
    gpaEquivalent: actualGPA,
    totalCourses,
    passedCourses,
    failedCourses,
  };

  const gradeChip = (grade) => {
    const normalized = String(grade || '').toUpperCase();

    if (normalized.startsWith('A')) {
      return { backgroundColor: '#dcfce7', color: '#15803d' };
    }

    if (normalized.startsWith('B')) {
      return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
    }

    if (normalized.startsWith('C')) {
      return { backgroundColor: '#fef3c7', color: '#a16207' };
    }

    return { backgroundColor: '#fee2e2', color: '#b91c1c' };
  };

  const radarData = useMemo(() => {
    if (!courses.length) {
      return [
        { component: 'Mid-Term', score: 0, max: 100 },
        { component: 'Assignment', score: 0, max: 100 },
        { component: 'Quiz', score: 0, max: 100 },
        { component: 'End-Term', score: 0, max: 100 },
      ];
    }

    const midTermPct = courses.reduce((acc, course) => acc + ((course.midTerm / COMPONENT_MAX.midTerm) * 100), 0) / courses.length;
    const assignmentPct = courses.reduce((acc, course) => acc + ((course.assignment / COMPONENT_MAX.assignment) * 100), 0) / courses.length;
    const quizPct = courses.reduce((acc, course) => acc + ((course.quiz / COMPONENT_MAX.quiz) * 100), 0) / courses.length;
    const endTermPct = courses.reduce((acc, course) => acc + ((course.endTerm / COMPONENT_MAX.endTerm) * 100), 0) / courses.length;

    return [
      { component: 'Mid-Term', score: Number(midTermPct.toFixed(1)), max: 100 },
      { component: 'Assignment', score: Number(assignmentPct.toFixed(1)), max: 100 },
      { component: 'Quiz', score: Number(quizPct.toFixed(1)), max: 100 },
      { component: 'End-Term', score: Number(endTermPct.toFixed(1)), max: 100 },
    ];
  }, [courses]);

  const componentBreakdownChartData = useMemo(
    () =>
      courses.map((course) => ({
        course: course.code,
        midTerm: Number(course.midTerm || 0),
        assignment: Number(course.assignment || 0),
        quiz: Number(course.quiz || 0),
        endTerm: Number(course.endTerm || 0),
      })),
    [courses]
  );

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

      <Card sx={{ ...glassCardSx, mt: 1.5, background: 'linear-gradient(135deg, #e0f2fe 0%, #ecfeff 52%, #e0e7ff 100%)', borderColor: 'rgba(14,165,233,0.2)' }}>
        <CardHeader title="Semester Summary" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>GPA Equivalent</Typography>
              <Typography sx={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a' }}>{semesterSummary.gpaEquivalent}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>Total Courses</Typography>
              <Typography sx={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a' }}>{semesterSummary.totalCourses}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>Subjects Passed</Typography>
              <Typography sx={{ fontSize: '1.65rem', fontWeight: 700, color: '#15803d' }}>{semesterSummary.passedCourses}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>Subjects Failed</Typography>
              <Typography sx={{ fontSize: '1.65rem', fontWeight: 700, color: '#b91c1c' }}>{semesterSummary.failedCourses}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} mt={0.5}>
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <Grid key={item.title} size={{ xs: 12, sm: 6, md: 4 }}>
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

      <Grid container spacing={2} mt={0.5}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ ...glassCardSx, borderColor: 'rgba(37,99,235,0.18)' }}>
            <CardHeader title="Performance Radar" subheader="Average score by component (%)" />
            <CardContent>
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#cbd5e1" />
                    <PolarAngleAxis dataKey="component" tick={{ fill: '#334155', fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Radar dataKey="score" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.45} />
                  </RadarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ ...glassCardSx, borderColor: 'rgba(16,185,129,0.2)' }}>
            <CardHeader title="Component Breakdown by Course" subheader="Horizontal bars with component max values" />
            <CardContent>
              <Box sx={{ width: '100%', height: Math.max(280, componentBreakdownChartData.length * 62) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={componentBreakdownChartData} layout="vertical" margin={{ top: 8, right: 18, left: 6, bottom: 8 }} barCategoryGap={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 50]} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis type="category" dataKey="course" tick={{ fill: '#334155', fontSize: 12 }} width={70} />
                    <Tooltip
                      formatter={(value, name) => {
                        const labelMap = {
                          midTerm: `Mid-Term (${COMPONENT_MAX.midTerm})`,
                          assignment: `Assignment (${COMPONENT_MAX.assignment})`,
                          quiz: `Quiz (${COMPONENT_MAX.quiz})`,
                          endTerm: `End-Term (${COMPONENT_MAX.endTerm})`,
                        };
                        return [value, labelMap[name] || name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="midTerm" name={`Mid-Term (${COMPONENT_MAX.midTerm})`} fill="#2563eb" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="assignment" name={`Assignment (${COMPONENT_MAX.assignment})`} fill="#16a34a" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="quiz" name={`Quiz (${COMPONENT_MAX.quiz})`} fill="#ca8a04" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="endTerm" name={`End-Term (${COMPONENT_MAX.endTerm})`} fill="#9333ea" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ ...glassCardSx, mt: 2.25, borderColor: 'rgba(99,102,241,0.18)' }}>
        <CardHeader title="Course-wise Performance" />
        <CardContent>
          {isLoading && (
            <Typography sx={{ mb: 2, color: '#6b7280' }}>Loading marks...</Typography>
          )}
          {!isLoading && courses.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title="Marks not published yet"
              description="Your faculty hasn't entered marks for this semester."
            />
          )}
          <TableContainer sx={{ overflowX: 'auto' }}>
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