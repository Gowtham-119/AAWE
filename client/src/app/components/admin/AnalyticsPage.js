import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { CalendarRange } from 'lucide-react';
import { getAdvancedAnalyticsData } from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { Calendar } from '../ui/calendar';

const toDateLabel = (dateValue) => {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const toDateKey = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultDateRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  return { from, to };
};

export const AnalyticsPage = () => {
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [pendingRange, setPendingRange] = useState(dateRange);

  const queryStartDate = toDateKey(dateRange.from);
  const queryEndDate = toDateKey(dateRange.to);

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: [...queryKeys.admin.analytics(), queryStartDate, queryEndDate],
    queryFn: () => getAdvancedAnalyticsData({ startDate: queryStartDate, endDate: queryEndDate }),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const attendanceTrend = analyticsData?.attendanceTrend || [];
  const marksDistribution = analyticsData?.marksDistribution || [];
  const departments = analyticsData?.departments || [];
  const departmentComparison = analyticsData?.departmentComparison || [];
  const topDefaulters = analyticsData?.topDefaulters || [];

  const rangeLabel = `${toDateLabel(dateRange.from)} - ${toDateLabel(dateRange.to)}`;

  const comparisonByDepartment = useMemo(() => {
    const map = new Map();
    departmentComparison.forEach((row) => {
      map.set(row.department, row);
    });
    return map;
  }, [departmentComparison]);

  const departmentColors = useMemo(() => {
    const palette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
    const colorMap = new Map();
    departments.forEach((department, index) => {
      colorMap.set(department, palette[index % palette.length]);
    });
    return colorMap;
  }, [departments]);

  const handleOpenRangeDialog = () => {
    setPendingRange(dateRange);
    setIsRangeDialogOpen(true);
  };

  const handleApplyRange = () => {
    if (!pendingRange?.from || !pendingRange?.to) return;
    setDateRange({ from: pendingRange.from, to: pendingRange.to });
    setIsRangeDialogOpen(false);
  };

  const glassCardSx = useMemo(() => ({
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  }), []);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Advanced Analytics</Typography>
        <Button
          onClick={handleOpenRangeDialog}
          variant="outlined"
          startIcon={<CalendarRange size={18} />}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {rangeLabel}
        </Button>
      </Box>
      <Typography sx={{ color: '#6b7280', mt: -2 }}>Date-filtered academic analytics across departments</Typography>

      {isLoading && <Typography sx={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading analytics...</Typography>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Attendance Trend (Last 30 Days in Range)" />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="attendancePct" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Avg Attendance %" />
                </LineChart>
              </ResponsiveContainer>
              {!attendanceTrend.length && (
                <Typography sx={{ color: '#6b7280', fontSize: '0.875rem', mt: 1 }}>No attendance data in selected range.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Marks Distribution by Grade and Department" />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={marksDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {departments.map((department) => (
                    <Bar
                      key={department}
                      dataKey={department}
                      fill={departmentColors.get(department)}
                      name={department}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              {!marksDistribution.length && (
                <Typography sx={{ color: '#6b7280', fontSize: '0.875rem', mt: 1 }}>No marks data in selected range.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Department Comparison (AG / CS / IT)" />
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>AG</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>CS</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>IT</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Avg Attendance %</TableCell>
                    <TableCell>{comparisonByDepartment.get('AG')?.avgAttendancePct || 0}</TableCell>
                    <TableCell>{comparisonByDepartment.get('CS')?.avgAttendancePct || 0}</TableCell>
                    <TableCell>{comparisonByDepartment.get('IT')?.avgAttendancePct || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Avg Marks</TableCell>
                    <TableCell>{comparisonByDepartment.get('AG')?.avgMarks || 0}</TableCell>
                    <TableCell>{comparisonByDepartment.get('CS')?.avgMarks || 0}</TableCell>
                    <TableCell>{comparisonByDepartment.get('IT')?.avgMarks || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Enrollment Count</TableCell>
                    <TableCell>{comparisonByDepartment.get('AG')?.enrollmentCount || 0}</TableCell>
                    <TableCell>{comparisonByDepartment.get('CS')?.enrollmentCount || 0}</TableCell>
                    <TableCell>{comparisonByDepartment.get('IT')?.enrollmentCount || 0}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Top Defaulters (Attendance < 75%)" />
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Attendance %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!topDefaulters.length && (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ color: '#6b7280' }}>No defaulters in selected date range.</TableCell>
                    </TableRow>
                  )}
                  {topDefaulters.map((student) => (
                    <TableRow key={student.email}>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.department}</TableCell>
                      <TableCell>{student.attendancePct}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={isRangeDialogOpen} onClose={() => setIsRangeDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Select Date Range</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <Calendar
              mode="range"
              selected={pendingRange}
              onSelect={(value) => setPendingRange(value || pendingRange)}
              numberOfMonths={2}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsRangeDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleApplyRange}
            disabled={!pendingRange?.from || !pendingRange?.to}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(135deg,#007AFF,#005FCC)' }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnalyticsPage;
