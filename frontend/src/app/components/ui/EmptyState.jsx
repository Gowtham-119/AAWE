import React from 'react';
import { Box, Button, Typography } from '@mui/material';

const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <Box
      sx={{
        py: 4,
        px: 2,
        borderRadius: 2,
        textAlign: 'center',
        border: '1px dashed rgba(148,163,184,0.38)',
        backgroundColor: 'rgba(248,250,252,0.7)',
      }}
    >
      {Icon ? (
        <Box sx={{ width: 44, height: 44, mx: 'auto', mb: 1.2, borderRadius: '50%', display: 'grid', placeItems: 'center', backgroundColor: 'rgba(226,232,240,0.9)' }}>
          <Icon size={21} color="#475569" />
        </Box>
      ) : null}
      <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>{title}</Typography>
      <Typography sx={{ color: '#64748b', mt: 0.6, fontSize: '0.9rem' }}>{description}</Typography>
      {action ? (
        <Button
          variant={action.variant || 'outlined'}
          onClick={action.onClick}
          sx={{ mt: 1.6 }}
        >
          {action.label}
        </Button>
      ) : null}
    </Box>
  );
};

export default EmptyState;
