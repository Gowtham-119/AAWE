import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, CardHeader, Chip, Grid, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext.js';
import { getAttendanceByStudentEmail, getMarksByStudentEmail } from '../../lib/academicDataApi';
import { supabase } from '../../lib/supabaseClient.js';

const COURSE_CATALOG = [
  { code: 'CS301', name: 'Data Structures & Algorithms', instructor: 'Dr. Vasudaven', credits: 4, semester: 'Spring 2026' },
  { code: 'CS402', name: 'Database Management Systems', instructor: 'Dr. Chelladurai', credits: 4, semester: 'Spring 2026' },
  { code: 'CS303', name: 'Operating Systems', instructor: 'Dr. Praveen Kumar', credits: 3, semester: 'Spring 2026' },
  { code: 'CS404', name: 'Computer Networks', instructor: 'Dr. Uvaraja', credits: 3, semester: 'Spring 2026' },
  { code: 'CS305', name: 'Web Development', instructor: 'Dr. Rahul', credits: 3, semester: 'Spring 2026' },
  { code: 'CS501', name: 'Machine Learning', instructor: 'Dr. Muthu', credits: 4, semester: 'Spring 2026' },
];

const StudentCoursesPage = () => {
  const { user } = useAuth();
  const [courseRows, setCourseRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  const loadCourses = useCallback(async () => {
      const normalizedEmail = (user?.email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        setCourseRows([]);
        return;
      }

      setIsLoading(true);
      try {
        const [attendanceRows, marksRows] = await Promise.all([
          getAttendanceByStudentEmail(normalizedEmail),
          getMarksByStudentEmail(normalizedEmail),
        ]);

        const catalogByCode = new Map(COURSE_CATALOG.map((course) => [course.code, course]));
        const mergedByCode = new Map();

        attendanceRows.forEach((row) => {
          const code = row.course_code;
          if (!code || mergedByCode.has(code)) return;
          const catalog = catalogByCode.get(code);
          mergedByCode.set(code, {
            code,
            name: row.course_name || catalog?.name || code,
            instructor: catalog?.instructor || 'Faculty',
            credits: catalog?.credits || 3,
            semester: catalog?.semester || 'Spring 2026',
            status: 'Active',
          });
        });

        marksRows.forEach((row) => {
          const code = row.course_code;
          if (!code || mergedByCode.has(code)) return;
          const catalog = catalogByCode.get(code);
          mergedByCode.set(code, {
            code,
            name: row.course_name || catalog?.name || code,
            instructor: catalog?.instructor || 'Faculty',
            credits: catalog?.credits || 3,
            semester: catalog?.semester || 'Spring 2026',
            status: 'Active',
          });
        });

        const enrolled = [...mergedByCode.values()];
        const remaining = COURSE_CATALOG
          .filter((course) => !mergedByCode.has(course.code))
          .map((course) => ({ ...course, status: 'Active' }));

        const sixCourses = [...enrolled, ...remaining].slice(0, 6).map((course, index) => ({
          id: index + 1,
          ...course,
        }));

        setCourseRows(sixCourses);
      } catch (error) {
        console.error('Failed to load student courses:', error);
      } finally {
        setIsLoading(false);
      }
    }, [user?.email]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!user?.email) return undefined;

    const attendanceChannel = supabase
      .channel(`student-courses-attendance-${user.email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        void loadCourses();
      })
      .subscribe();

    const marksChannel = supabase
      .channel(`student-courses-marks-${user.email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marks_records' }, () => {
        void loadCourses();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(marksChannel);
    };
  }, [user?.email, loadCourses]);

  const courses = useMemo(() => courseRows, [courseRows]);

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' }}>My Courses</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>View enrolled courses</Typography>
      </Box>

      <Card sx={glassCardSx}>
        <CardHeader title="Enrolled Courses" subheader={`${courses.length} active courses`} />
        <CardContent>
          {isLoading && (
            <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 2 }}>
              Loading courses...
            </Typography>
          )}
          <Grid container spacing={1.5}>
            {courses.map((course) => (
              <Grid key={course.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Box sx={{ border: '1px solid rgba(148,163,184,0.24)', borderRadius: 2.25, p: 1.75, height: '100%', background: 'linear-gradient(145deg, rgba(255,255,255,0.88), rgba(241,245,249,0.75))' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Typography sx={{ fontWeight: 600, color: '#111827' }}>{course.name}</Typography>
                    <Chip size="small" label={course.status} sx={{ backgroundColor: '#dcfce7', color: '#15803d' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>{course.code}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#4b5563', mt: 1 }}>{course.instructor}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mt: 1.5 }}>
                    {course.credits} credits • {course.semester}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StudentCoursesPage;