import React, { memo, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { CalendarClock } from 'lucide-react';

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  return new Date(`${dateString}T00:00:00`);
};

const AttendanceCalendar = ({
  attendanceRows,
  isLoading,
  selectedCourse,
  onCourseChange,
  courseOptions,
}) => {
  const theme = useTheme();
  const [selectedEvent, setSelectedEvent] = useState(null);

  const attendanceEvents = useMemo(() => {
    const filteredRows = selectedCourse
      ? attendanceRows.filter((row) => row.course_code === selectedCourse)
      : attendanceRows;

    return filteredRows
      .map((row, index) => {
        const start = parseLocalDate(row.attendance_date);
        if (!start || Number.isNaN(start.getTime())) return null;

        const status = row.is_present ? 'Present' : 'Absent';
        const bgColor = row.is_present ? '#dcfce7' : '#fee2e2';
        const textColor = row.is_present ? '#166534' : '#991b1b';

        return {
          id: `${row.course_code || 'course'}-${row.attendance_date || index}-${status}`,
          title: `${row.course_code || 'Course'} - ${status}`,
          start,
          end: start,
          allDay: true,
          backgroundColor: bgColor,
          borderColor: bgColor,
          textColor,
          resource: row,
          extendedProps: {
            status,
            courseName: row.course_name || row.course_code || 'Course',
            courseCode: row.course_code || 'N/A',
            facultyEmail: row.faculty_email || 'Faculty not set',
          },
        };
      })
      .filter(Boolean);
  }, [attendanceRows, selectedCourse]);

  const calendarLegend = [
    { label: 'Present', bg: '#dcfce7', color: '#166534' },
    { label: 'Absent', bg: '#fee2e2', color: '#991b1b' },
  ];

  return (
    <Card
      sx={{
        borderRadius: 4,
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(16px)',
        boxShadow: '0 18px 40px rgba(15,23,42,0.09)',
        border: `1px solid ${alpha(theme.palette.common.white, 0.5)}`,
      }}
    >
      <CardHeader
        avatar={<CalendarClock size={18} color="#0f766e" />}
        title="Attendance Calendar"
        subheader="Month, week and day views with status mapping"
        sx={{
          pb: 1,
          '& .MuiCardHeader-title': { fontWeight: 700, fontSize: '1rem', color: '#0f172a' },
          '& .MuiCardHeader-subheader': { color: '#64748b', fontSize: '0.83rem' },
        }}
        action={
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="course-filter-label">Course Filter</InputLabel>
            <Select
              labelId="course-filter-label"
              value={selectedCourse}
              label="Course Filter"
              onChange={(event) => onCourseChange(event.target.value)}
            >
              <MenuItem value="">All Courses</MenuItem>
              {courseOptions.map((courseCode) => (
                <MenuItem key={courseCode} value={courseCode}>{courseCode}</MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />
      <CardContent sx={{ pt: 0.5 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Skeleton variant="rounded" height={54} />
            <Skeleton variant="rounded" height={390} />
          </Box>
        ) : attendanceEvents.length === 0 ? (
          <Box
            sx={{
              minHeight: 220,
              borderRadius: 3,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              background: 'linear-gradient(145deg, rgba(248,250,252,0.92), rgba(241,245,249,0.78))',
              border: '1px dashed rgba(148,163,184,0.35)',
              px: 2,
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#334155' }}>No attendance records yet</Typography>
              <Typography sx={{ color: '#64748b', fontSize: '0.88rem', mt: 0.4 }}>
                Attendance entries will appear on the calendar as soon as faculty marks them.
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              '& .fc': {
                '--fc-border-color': 'rgba(148,163,184,0.24)',
                '--fc-page-bg-color': 'transparent',
                '--fc-event-border-color': 'transparent',
                '--fc-event-text-color': '#0f172a',
                '--fc-today-bg-color': 'rgba(14,165,164,0.12)',
                fontFamily: '"Avenir Next", "SF Pro Text", "Segoe UI", sans-serif',
              },
              '& .fc .fc-toolbar.fc-header-toolbar': {
                position: 'sticky',
                top: 0,
                zIndex: 2,
                backgroundColor: alpha(theme.palette.background.paper, 0.94),
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                px: 1,
                py: 0.75,
                mb: 1.4,
              },
              '& .fc .fc-toolbar-title': {
                fontSize: '1.02rem',
                color: '#0f172a',
                fontWeight: 700,
              },
              '& .fc .fc-button': {
                borderRadius: 1.8,
                border: 'none',
                backgroundColor: '#e2e8f0',
                color: '#0f172a',
                textTransform: 'capitalize',
                boxShadow: 'none',
              },
              '& .fc .fc-button:hover': {
                backgroundColor: '#cbd5e1',
              },
              '& .fc .fc-button-active': {
                backgroundColor: '#0f766e !important',
                color: '#ffffff !important',
              },
              '& .fc .fc-event': {
                borderRadius: 1.3,
                border: 'none',
                padding: '2px 4px',
              },
              '& .fc .fc-daygrid-day-frame': {
                minHeight: 88,
              },
            }}
          >
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              height="auto"
              events={attendanceEvents}
              dayMaxEvents
              nowIndicator
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              eventClick={(info) => {
                setSelectedEvent(info.event);
              }}
              eventContent={(arg) => {
                const status = arg.event.extendedProps.status || '';
                const color = status === 'Present' ? '#166534' : '#991b1b';
                return (
                  <Tooltip title={`${arg.event.extendedProps.courseName} | ${status}`} arrow>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 0.35 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color }} />
                      <Typography sx={{ fontSize: '0.74rem', color, lineHeight: 1.2 }}>
                        {arg.event.title}
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              }}
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.8 }}>
          {calendarLegend.map((item) => (
            <Chip
              key={item.label}
              size="small"
              label={item.label}
              sx={{ backgroundColor: item.bg, color: item.color, fontWeight: 600 }}
            />
          ))}
        </Box>
      </CardContent>

      <Dialog open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Attendance Details</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.05, pb: 1 }}>
              <Typography sx={{ color: '#0f172a' }}>
                <Box component="span" sx={{ fontWeight: 700 }}>Course: </Box>
                {selectedEvent.extendedProps.courseName}
              </Typography>
              <Typography sx={{ color: '#334155' }}>
                <Box component="span" sx={{ fontWeight: 700 }}>Code: </Box>
                {selectedEvent.extendedProps.courseCode}
              </Typography>
              <Typography sx={{ color: '#334155' }}>
                <Box component="span" sx={{ fontWeight: 700 }}>Status: </Box>
                {selectedEvent.extendedProps.status}
              </Typography>
              <Typography sx={{ color: '#334155' }}>
                <Box component="span" sx={{ fontWeight: 700 }}>Date: </Box>
                {selectedEvent.start?.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Typography>
              <Typography sx={{ color: '#334155' }}>
                <Box component="span" sx={{ fontWeight: 700 }}>Marked by: </Box>
                {selectedEvent.extendedProps.facultyEmail}
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default memo(AttendanceCalendar);
