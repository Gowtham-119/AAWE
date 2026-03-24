import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Chip, Grid, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext.js';
import { getFacultyTimetableByEmail } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import EmptyState from '../ui/EmptyState.jsx';

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const FacultyTimetablePage = () => {
  const { user } = useAuth();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.faculty.timetable(normalizedEmail),
    queryFn: () => getFacultyTimetableByEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const grouped = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      if (!map.has(entry.dayOfWeek)) map.set(entry.dayOfWeek, []);
      map.get(entry.dayOfWeek).push(entry);
    });
    return DAY_ORDER.filter((day) => map.has(day)).map((day) => ({ day, items: map.get(day) }));
  }, [entries]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.55rem', md: '1.8rem' }, fontWeight: 700, color: '#111827' }}>My Timetable</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Your weekly classes across assigned departments.</Typography>
      </Box>

      {isLoading ? (
        <Typography sx={{ color: '#6b7280' }}>Loading timetable...</Typography>
      ) : !grouped.length ? (
        <Card>
          <CardContent>
            <EmptyState title="No timetable entries" description="No active timetable classes are linked to your account." />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {grouped.map((section) => (
            <Grid key={section.day} size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 1.3 }}>{section.day}</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                    {section.items.map((entry) => (
                      <Box key={entry.id} sx={{ border: '1px solid rgba(148,163,184,0.24)', borderRadius: 2, p: 1.25 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography sx={{ fontWeight: 600 }}>{entry.courseCode} - {entry.courseName}</Typography>
                          <Chip size="small" label={entry.department} />
                        </Box>
                        <Typography sx={{ mt: 0.6, color: '#475569', fontSize: '0.86rem' }}>
                          {entry.startTime} - {entry.endTime} | {entry.venue || 'Venue TBA'}
                        </Typography>
                        <Typography sx={{ mt: 0.4, color: '#64748b', fontSize: '0.8rem' }}>
                          Semester: {entry.semester || 'N/A'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default FacultyTimetablePage;
