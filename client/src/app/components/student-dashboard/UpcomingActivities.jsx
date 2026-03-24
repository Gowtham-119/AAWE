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
import { BellRing, BookOpen, ClipboardList } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const MotionBox = motion(Box);

const typeConfig = {
  class: {
    label: 'Class',
    icon: BookOpen,
    chipBg: '#e0f2fe',
    chipColor: '#075985',
  },
  assignment: {
    label: 'Assignment',
    icon: ClipboardList,
    chipBg: '#ede9fe',
    chipColor: '#5b21b6',
  },
  notice: {
    label: 'Notice',
    icon: BellRing,
    chipBg: '#fff7ed',
    chipColor: '#9a3412',
  },
};

const getStatusSx = (status) => {
  if (status === 'Live') {
    return { backgroundColor: '#dcfce7', color: '#166534' };
  }

  if (status === 'Completed') {
    return { backgroundColor: '#e2e8f0', color: '#334155' };
  }

  return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
};

const UpcomingActivities = ({ activities, isLoading }) => {
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
        title="Upcoming Activities"
        subheader="Classes, assignments and notices in one timeline"
        sx={{
          '& .MuiCardHeader-title': { fontWeight: 700, fontSize: '1rem', color: '#0f172a' },
          '& .MuiCardHeader-subheader': { color: '#64748b', fontSize: '0.83rem' },
        }}
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.35 }}>
            {[0, 1, 2, 3].map((slot) => (
              <Skeleton key={`activity-skeleton-${slot}`} className="h-20 w-full" />
            ))}
          </Box>
        ) : !activities.length ? (
          <Box
            sx={{
              borderRadius: 3,
              border: '1px dashed rgba(148,163,184,0.35)',
              py: 5,
              px: 2,
              textAlign: 'center',
              backgroundColor: 'rgba(248,250,252,0.85)',
            }}
          >
            <Typography sx={{ color: '#334155', fontWeight: 700 }}>Nothing upcoming</Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.85rem', mt: 0.4 }}>
              New classes, assignments and notices will show up here automatically.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            {activities.map((activity, index) => {
              const type = typeConfig[activity.type] || typeConfig.notice;
              const TypeIcon = type.icon;

              return (
                <MotionBox
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.25 }}
                  whileHover={{ y: -2 }}
                  sx={{
                    borderRadius: 2.5,
                    border: '1px solid rgba(148,163,184,0.24)',
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(241,245,249,0.78))',
                    px: 1.4,
                    py: 1.25,
                    boxShadow: '0 10px 20px rgba(15,23,42,0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                        <TypeIcon size={14} color={type.chipColor} />
                        <Typography sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }} noWrap>
                          {activity.title}
                        </Typography>
                      </Box>
                      <Typography sx={{ color: '#64748b', fontSize: '0.78rem', mt: 0.45 }}>
                        {activity.subtitle}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={activity.status}
                      sx={{ ...getStatusSx(activity.status), fontWeight: 700, flexShrink: 0 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.9, gap: 1 }}>
                    <Chip
                      size="small"
                      label={type.label}
                      sx={{ backgroundColor: type.chipBg, color: type.chipColor, fontWeight: 700, height: 22 }}
                    />
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {activity.timeLabel}
                    </Typography>
                  </Box>
                </MotionBox>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(UpcomingActivities);
