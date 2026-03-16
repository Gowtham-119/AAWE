import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, CardHeader, Chip, Grid, LinearProgress, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext.js';
import { getAttendanceByStudentEmail, getClassAssignmentsByStudentEmail, getMarksByStudentEmail } from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

const StudentCoursesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();
  const [selectedCourseCode, setSelectedCourseCode] = useState('');

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  const { data: studentCourseData = { courses: [], attendanceRows: [], marksRows: [] }, isLoading } = useQuery({
    queryKey: queryKeys.student.coursesSnapshot(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
    queryFn: async () => {
      const [attendanceRows, marksRows, assignmentRows] = await Promise.all([
        getAttendanceByStudentEmail(normalizedEmail),
        getMarksByStudentEmail(normalizedEmail),
        getClassAssignmentsByStudentEmail(normalizedEmail, user?.department || ''),
      ]);

      const byCode = new Map();
      assignmentRows.forEach((row) => {
        const code = (row.course_code || '').trim().toUpperCase();
        if (!code) return;

        const existing = byCode.get(code);
        if (!existing || new Date(row.updated_at || 0).getTime() > new Date(existing.updatedAt || 0).getTime()) {
          byCode.set(code, {
            code,
            name: row.course_name || code,
            facultyName: row.staff_name || row.faculty_email || row.staff_email || 'Faculty',
            facultyEmail: row.faculty_email || row.staff_email || 'N/A',
            venue: row.venue || 'N/A',
            department: row.department || user?.department || 'N/A',
            updatedAt: row.updated_at || null,
            status: 'Assigned',
          });
        }
      });

      return {
        courses: Array.from(byCode.values()),
        attendanceRows,
        marksRows,
      };
    },
  });

  useEffect(() => {
    if (!normalizedEmail) return undefined;

    const attendanceChannel = supabase
      .channel(`student-courses-attendance-${normalizedEmail}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.student.coursesSnapshot(normalizedEmail) });
      })
      .subscribe();

    const marksChannel = supabase
      .channel(`student-courses-marks-${normalizedEmail}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marks_records' }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.student.coursesSnapshot(normalizedEmail) });
      })
      .subscribe();

    const assignmentsChannel = supabase
      .channel(`student-courses-assignments-${normalizedEmail}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_assignments' }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.student.coursesSnapshot(normalizedEmail) });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(marksChannel);
      void supabase.removeChannel(assignmentsChannel);
    };
  }, [normalizedEmail, queryClient]);

  const courses = useMemo(() => studentCourseData.courses || [], [studentCourseData.courses]);
  const attendanceRows = studentCourseData.attendanceRows || [];
  const marksRows = studentCourseData.marksRows || [];

  const attendanceSummaryByCourse = useMemo(() => {
    const map = new Map();

    attendanceRows.forEach((row) => {
      const code = (row.course_code || '').trim().toUpperCase();
      if (!code) return;

      if (!map.has(code)) {
        map.set(code, { totalClassesHeld: 0, presentCount: 0, percentagePresent: 0 });
      }

      const current = map.get(code);
      current.totalClassesHeld += 1;
      if (row.is_present) current.presentCount += 1;
    });

    map.forEach((value) => {
      value.percentagePresent = value.totalClassesHeld
        ? Number(((value.presentCount / value.totalClassesHeld) * 100).toFixed(1))
        : 0;
    });

    return map;
  }, [attendanceRows]);

  const marksByCourse = useMemo(() => {
    const map = new Map();
    marksRows.forEach((row) => {
      const code = (row.course_code || '').trim().toUpperCase();
      if (!code || map.has(code)) return;
      map.set(code, {
        midTerm: Number(row.mid_term ?? 0),
        assignment: Number(row.assignment ?? 0),
        quiz: Number(row.quiz ?? 0),
        endTerm: Number(row.end_term ?? 0),
        total: Number(row.total ?? 0),
        grade: row.grade || 'N/A',
      });
    });
    return map;
  }, [marksRows]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.code === selectedCourseCode) || null,
    [courses, selectedCourseCode]
  );
  const selectedAttendanceSummary = selectedCourse
    ? attendanceSummaryByCourse.get(selectedCourse.code) || { percentagePresent: 0, totalClassesHeld: 0 }
    : { percentagePresent: 0, totalClassesHeld: 0 };
  const selectedMarksSummary = selectedCourse
    ? marksByCourse.get(selectedCourse.code) || null
    : null;

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' }}>My Courses</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>View assigned classes and course details</Typography>
      </Box>

      <Card sx={glassCardSx}>
        <CardHeader title="Assigned Courses" subheader={`${courses.length} courses assigned`} />
        <CardContent>
          {isLoading && (
            <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 2 }}>
              Loading courses...
            </Typography>
          )}
          {!isLoading && courses.length === 0 && (
            <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 2 }}>
              No class assignments found for {user?.email}.
            </Typography>
          )}
          <Grid container spacing={1.5}>
            {courses.map((course) => (
              <Grid key={course.code} size={{ xs: 12, md: 6, lg: 4 }}>
                <Box
                  onClick={() => setSelectedCourseCode(course.code)}
                  sx={{
                    border: '1px solid rgba(148,163,184,0.24)',
                    borderRadius: 2.25,
                    p: 1.75,
                    height: '100%',
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.88), rgba(241,245,249,0.75))',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 10px 24px rgba(15,23,42,0.1)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Typography sx={{ fontWeight: 600, color: '#111827' }}>{course.name}</Typography>
                    <Chip size="small" label={course.status} sx={{ backgroundColor: '#dcfce7', color: '#15803d' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>{course.code}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#4b5563', mt: 1 }}>Faculty: {course.facultyName}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mt: 0.6 }}>Venue: {course.venue}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mt: 0.6 }}>Department: {course.department}</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 1.25 }}>
                    Click to view course details
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedCourse)} onOpenChange={(open) => { if (!open) setSelectedCourseCode(''); }}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedCourse?.code || 'Course Details'}</SheetTitle>
            <SheetDescription>{selectedCourse?.name || 'Detailed course summary'}</SheetDescription>
          </SheetHeader>

          <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Card variant="outlined" sx={{ borderColor: 'rgba(59,130,246,0.3)' }}>
              <CardHeader title="Attendance Summary" sx={{ pb: 0 }} />
              <CardContent sx={{ pt: 1.2 }}>
                <Typography sx={{ color: '#475569', fontSize: '0.82rem' }}>% Present</Typography>
                <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.55rem' }}>
                  {selectedAttendanceSummary.percentagePresent.toFixed(1)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={selectedAttendanceSummary.percentagePresent}
                  sx={{ mt: 1, height: 8, borderRadius: 999 }}
                />
                <Typography sx={{ color: '#64748b', fontSize: '0.82rem', mt: 1 }}>
                  Total classes held: {selectedAttendanceSummary.totalClassesHeld}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderColor: 'rgba(16,185,129,0.3)' }}>
              <CardHeader title="Marks Summary" sx={{ pb: 0 }} />
              <CardContent sx={{ pt: 1.2 }}>
                {!selectedMarksSummary && (
                  <Typography sx={{ color: '#6b7280' }}>No marks available for this course yet.</Typography>
                )}
                {selectedMarksSummary && (
                  <Grid container spacing={1.2}>
                    <Grid size={{ xs: 6 }}><Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>Mid-Term</Typography><Typography sx={{ fontWeight: 600 }}>{selectedMarksSummary.midTerm}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>Assignment</Typography><Typography sx={{ fontWeight: 600 }}>{selectedMarksSummary.assignment}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>Quiz</Typography><Typography sx={{ fontWeight: 600 }}>{selectedMarksSummary.quiz}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>End-Term</Typography><Typography sx={{ fontWeight: 600 }}>{selectedMarksSummary.endTerm}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>Total</Typography><Typography sx={{ fontWeight: 700 }}>{selectedMarksSummary.total}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>Grade</Typography><Typography sx={{ fontWeight: 700 }}>{selectedMarksSummary.grade}</Typography></Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderColor: 'rgba(148,163,184,0.35)' }}>
              <CardHeader title="Faculty Contact" sx={{ pb: 0 }} />
              <CardContent sx={{ pt: 1.2 }}>
                <Typography sx={{ color: '#64748b', fontSize: '0.82rem' }}>Faculty Email</Typography>
                <Typography sx={{ color: '#0f172a', fontWeight: 600 }}>
                  {selectedCourse?.facultyEmail || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </SheetContent>
      </Sheet>
    </Box>
  );
};

export default StudentCoursesPage;