import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Accordion, AccordionDetails, AccordionSummary, Box, Card, CardContent, Chip, Grid, Typography, useMediaQuery } from '@mui/material';
import { Clock3, MapPin } from 'lucide-react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../context/AuthContext.js';
import { getStudentTimetableByEmail } from '../../lib/academicDataApi';
import { queryKeys } from '../../lib/queryKeys';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import EmptyState from '../ui/EmptyState.jsx';

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const StudentTimetablePage = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const normalizedEmail = (user?.email || '').trim().toLowerCase();
  const department = (user?.department || '').trim().toUpperCase();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.student.timetable(normalizedEmail, department),
    queryFn: () => getStudentTimetableByEmail(normalizedEmail, department),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const entriesByDay = useMemo(() => {
    const grouped = new Map();
    entries.forEach((entry) => {
      const day = entry.dayOfWeek || 'UNSCHEDULED';
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(entry);
    });

    return DAY_ORDER
      .filter((day) => grouped.has(day))
      .map((day) => ({ day, items: grouped.get(day) }));
  }, [entries]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.55rem', md: '1.8rem' }, fontWeight: 700, color: '#111827' }}>My Timetable</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Weekly class schedule for your active semester.</Typography>
      </Box>

      {isLoading ? (
        <Typography sx={{ color: '#6b7280' }}>Loading timetable...</Typography>
      ) : !entriesByDay.length ? (
        <Card>
          <CardContent>
            <EmptyState title="No timetable entries" description="Your class schedule has not been published yet." />
          </CardContent>
        </Card>
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {entriesByDay.map((section) => (
            <Accordion key={section.day}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600 }}>{section.day}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                  {section.items.map((entry) => (
                    <Box key={entry.id} sx={{ border: '1px solid rgba(148,163,184,0.24)', borderRadius: 2, p: 1.25 }}>
                      <Typography sx={{ fontWeight: 600 }}>{entry.courseCode} - {entry.courseName}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.8, alignItems: 'center' }}>
                        <Clock3 size={15} />
                        <Typography sx={{ fontSize: '0.86rem' }}>{entry.startTime} - {entry.endTime}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.4, alignItems: 'center' }}>
                        <MapPin size={15} />
                        <Typography sx={{ fontSize: '0.86rem' }}>{entry.venue || 'Venue TBA'}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {entriesByDay.map((section) => (
            <Grid key={section.day} size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 1.3 }}>{section.day}</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                    {section.items.map((entry) => (
                      <Box key={entry.id} sx={{ border: '1px solid rgba(148,163,184,0.24)', borderRadius: 2, p: 1.25 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography sx={{ fontWeight: 600 }}>{entry.courseCode} - {entry.courseName}</Typography>
                          <Chip size="small" label={entry.venue || 'TBA'} />
                        </Box>
                        <Typography sx={{ mt: 0.6, color: '#475569', fontSize: '0.86rem' }}>
                          {entry.startTime} - {entry.endTime}
                        </Typography>
                        <Typography sx={{ mt: 0.4, color: '#64748b', fontSize: '0.8rem' }}>
                          Faculty: {entry.facultyName || entry.facultyEmail || 'Not assigned'}
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

export default StudentTimetablePage;
