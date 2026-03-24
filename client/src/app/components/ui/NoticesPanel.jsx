import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Box, Card, CardContent, CardHeader, Chip, Typography } from '@mui/material';
import { getNotices } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import EmptyState from './EmptyState.jsx';

const NoticesPanel = ({ role = 'student', title = 'Notices', limit = 3, sx = {} }) => {
  const { data: notices = [], isLoading } = useQuery({
    queryKey: queryKeys.common.notices(role, limit),
    queryFn: () => getNotices({ role, limit }),
    staleTime: LIVE_STALE_TIME_MS,
  });

  return (
    <Card sx={sx}>
      <CardHeader title={title} subheader="Latest institution announcements" />
      <CardContent>
        {isLoading ? (
          <Typography sx={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading notices...</Typography>
        ) : notices.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {notices.map((notice) => (
              <Box
                key={notice.id}
                sx={{
                  border: '1px solid rgba(148,163,184,0.26)',
                  borderRadius: 2,
                  p: 1.4,
                  backgroundColor: 'rgba(248,250,252,0.8)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>{notice.title}</Typography>
                  <Chip size="small" label={notice.targetRole} sx={{ textTransform: 'capitalize' }} />
                </Box>
                {notice.body ? (
                  <Typography sx={{ mt: 0.8, color: '#475569', fontSize: '0.88rem' }}>{notice.body}</Typography>
                ) : null}
                <Typography sx={{ mt: 0.8, color: '#94a3b8', fontSize: '0.76rem' }}>
                  Active from {notice.startDate || '-'} {notice.endDate ? `to ${notice.endDate}` : ''}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <EmptyState
            icon={Bell}
            title="No active notices"
            description="Announcements from admin will appear here when published."
          />
        )}
      </CardContent>
    </Card>
  );
};

export default NoticesPanel;
