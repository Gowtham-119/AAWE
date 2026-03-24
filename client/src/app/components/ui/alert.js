import * as React from 'react';
import { cn } from './utils.js';

const severityStyles = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-green-200 bg-green-50 text-green-900',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

function Alert({ className, severity = 'info', ...props }) {
  return <div role="alert" className={cn('w-full rounded-lg border p-4', severityStyles[severity] || severityStyles.info, className)} {...props} />;
}

function AlertTitle({ className, ...props }) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

function AlertDescription({ className, ...props }) {
  return <div className={cn('text-sm', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
