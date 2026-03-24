import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  LinearProgress,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Skeleton } from '../ui/skeleton';

const MotionBox = motion(Box);

const CourseProgress = ({ courses, isLoading }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        borderRadius: 4,
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(16px)',
        boxShadow: '0 16px 36px rgba(15,23,42,0.09)',
        border: `1px solid ${alpha(theme.palette.common.white, 0.5)}`,
      }}
    >
      <CardHeader
        title="Enrolled Courses"
        subheader="Attendance and marks progress by subject"
        sx={{
          '& .MuiCardHeader-title': { fontWeight: 700, fontSize: '1rem', color: '#0f172a' },
          '& .MuiCardHeader-subheader': { color: '#64748b', fontSize: '0.83rem' },
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </Box>
        ) : !courses.length ? (
          <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>No course data available yet.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.3 }}>
            {courses.map((course, index) => (
              <MotionBox
                key={course.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.25 }}
                whileHover={{ y: -2 }}
                sx={{
                  borderRadius: 2.5,
                  border: '1px solid rgba(148,163,184,0.22)',
                  px: 1.55,
                  py: 1.35,
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(241,245,249,0.78))',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.1, gap: 1 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Typography sx={{ fontWeight: 700, color: '#0f172a' }} noWrap>{course.name}</Typography>
                      <Chip size="small" label={course.code} sx={{ backgroundColor: '#dbeafe', color: '#1e3a8a', fontWeight: 700 }} />
                    </Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.78rem', mt: 0.45 }}>
                      Grade snapshot: {course.grade}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: '#2563eb', fontSize: '1.2rem', fontWeight: 700 }}>{course.grade}</Typography>
                    <Typography sx={{ color: '#64748b', fontSize: '0.72rem' }}>Current Grade</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.45 }}>
                      <Typography sx={{ color: '#64748b', fontSize: '0.74rem' }}>Attendance</Typography>
                      <Typography sx={{ color: '#334155', fontSize: '0.74rem', fontWeight: 700 }}>{course.attendance}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Number(course.attendance || 0)}
                      sx={{
                        height: 8,
                        borderRadius: 99,
                        backgroundColor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 99,
                          background: 'linear-gradient(90deg, #0ea5e9, #0284c7)',
                          transition: 'transform 700ms ease',
                        },
                      }}
                    />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.45 }}>
                      <Typography sx={{ color: '#64748b', fontSize: '0.74rem' }}>Marks</Typography>
                      <Typography sx={{ color: '#334155', fontSize: '0.74rem', fontWeight: 700 }}>{course.marks}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Number(course.marks || 0)}
                      sx={{
                        height: 8,
                        borderRadius: 99,
                        backgroundColor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 99,
                          background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                          transition: 'transform 700ms ease',
                        },
                      }}
                    />
                  </Box>
                </Box>
              </MotionBox>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(CourseProgress);
