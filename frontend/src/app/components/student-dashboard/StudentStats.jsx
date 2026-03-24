import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Award, BookOpen, ClipboardCheck, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '../ui/skeleton';

const statConfig = [
  {
    key: 'attendanceRate',
    title: 'Overall Attendance',
    icon: ClipboardCheck,
    gradient: 'linear-gradient(145deg, #0ea5a5, #14b8a6)',
    format: (value) => `${value}%`,
  },
  {
    key: 'averageMarks',
    title: 'Average Marks',
    icon: TrendingUp,
    gradient: 'linear-gradient(145deg, #2563eb, #60a5fa)',
    format: (value) => `${value}`,
  },
  {
    key: 'enrolledCoursesCount',
    title: 'Enrolled Courses',
    icon: BookOpen,
    gradient: 'linear-gradient(145deg, #7c3aed, #a78bfa)',
    format: (value) => `${value}`,
  },
  {
    key: 'assignmentsCount',
    title: 'Assigned Classes',
    icon: Award,
    gradient: 'linear-gradient(145deg, #ea580c, #fb923c)',
    format: (value) => `${value}`,
  },
];

const MotionCard = motion(Card);

const StudentStats = ({ loading, summary, trendData }) => {
  const theme = useTheme();

  const stats = useMemo(
    () =>
      statConfig.map((item) => {
        const value = Number(summary?.[item.key] || 0);
        const progress = item.key === 'attendanceRate' || item.key === 'averageMarks'
          ? Math.min(100, Math.max(0, value))
          : Math.min(100, value * 20);

        return {
          ...item,
          value,
          progress,
        };
      }),
    [summary]
  );

  return (
    <>
      {loading ? [0, 1, 2, 3].map((slot) => (
        <Grid key={`stat-skeleton-${slot}`} size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              borderRadius: 4,
              backgroundColor: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(14px)',
              boxShadow: '0 16px 40px rgba(15,23,42,0.08)',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20 mt-3" />
              <Skeleton className="h-2 w-full mt-4" />
            </CardContent>
          </Card>
        </Grid>
      )) : stats.map((stat, index) => {
        const Icon = stat.icon;

        return (
          <Grid key={stat.key} size={{ xs: 12, sm: 6, md: 3 }}>
            <MotionCard
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.36 }}
              whileHover={{ y: -4 }}
              sx={{
                borderRadius: 4,
                backgroundColor: alpha(theme.palette.background.paper, 0.78),
                backdropFilter: 'blur(14px)',
                boxShadow: '0 16px 40px rgba(15,23,42,0.08)',
                border: `1px solid ${alpha(theme.palette.common.white, 0.45)}`,
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
                      {stat.title}
                    </Typography>
                    <Typography sx={{ mt: 0.7, fontSize: '1.55rem', fontWeight: 700, color: '#0f172a' }}>
                      {stat.format(stat.value)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      background: stat.gradient,
                      boxShadow: '0 12px 24px rgba(15,23,42,0.16)',
                    }}
                  >
                    <Icon size={20} color="#ffffff" />
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stat.progress}
                  sx={{
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 99,
                      transition: 'transform 800ms ease',
                    },
                  }}
                />
              </CardContent>
            </MotionCard>
          </Grid>
        );
      })}

      <Grid size={{ xs: 12 }}>
        <Card
          sx={{
            borderRadius: 4,
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(14px)',
            boxShadow: '0 14px 36px rgba(15,23,42,0.08)',
            border: `1px solid ${alpha(theme.palette.common.white, 0.5)}`,
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569', mb: 1.25 }}>
              Attendance Trend
            </Typography>
            <Box sx={{ width: '100%', height: 170 }}>
              <ResponsiveContainer>
                <AreaChart data={trendData} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendanceArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5a5" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0ea5a5" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} width={30} />
                  <RechartsTooltip formatter={(value) => [`${value}%`, 'Attendance']} />
                  <Area type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2.5} fill="url(#attendanceArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </>
  );
};

export default memo(StudentStats);
