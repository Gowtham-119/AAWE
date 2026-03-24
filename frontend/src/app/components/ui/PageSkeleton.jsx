import React from 'react';
import { Box, Card, CardContent, Grid } from '@mui/material';
import { Skeleton } from './skeleton';

const PageSkeleton = () => {
  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Skeleton className="h-8 w-56" />
      <Grid container spacing={2}>
        {[0, 1, 2].map((index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardContent>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20 mt-3" />
                <Skeleton className="h-2 w-full mt-4" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card>
        <CardContent>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full mt-4" />
        </CardContent>
      </Card>
    </Box>
  );
};

export default PageSkeleton;
