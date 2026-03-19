import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Skeleton } from '../ui/skeleton';

const MotionBox = motion(Box);

const RecentActivity = ({ activities, isLoading }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        borderRadius: 4,
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(16px)',
        boxShadow: '0 16px 36px rgba(15,23,42,0.09)',
        border: `1px solid ${alpha(theme.palette.common.white, 0.5)}`,
        height: '100%',
      }}
    >
      <CardHeader
        title="Recent Activity"
        subheader="Latest attendance updates"
        sx={{
          '& .MuiCardHeader-title': { fontWeight: 700, fontSize: '1rem', color: '#0f172a' },
          '& .MuiCardHeader-subheader': { color: '#64748b', fontSize: '0.83rem' },
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </Box>
        ) : !activities.length ? (
          <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>No activity updates yet.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1 }}>
            {activities.map((activity, index) => (
              <MotionBox
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.26 }}
                whileHover={{ y: -2 }}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  backgroundColor: '#f8fafc',
                  border: '1px solid rgba(148,163,184,0.2)',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.86rem', color: '#0f172a', flex: 1 }}>
                    {activity.title}
                  </Typography>
                  <Chip
                    size="small"
                    label={activity.priority}
                    sx={{
                      height: 20,
                      backgroundColor: activity.priority === 'high' ? '#fee2e2' : '#dcfce7',
                      color: activity.priority === 'high' ? '#b91c1c' : '#15803d',
                      fontWeight: 700,
                    }}
                  />
                </Box>
                <Typography sx={{ color: '#475569', fontSize: '0.76rem' }}>{activity.description}</Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.74rem', mt: 0.35 }}>{activity.facultyEmail}</Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.35 }}>{activity.date}</Typography>
              </MotionBox>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(RecentActivity);
