import React from 'react';
import { RequestStatus } from '../../types';

interface StatusBadgeProps {
  status: RequestStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';

  switch (status) {
    case 'CREATED':
    case 'COLLECTED':
      badgeStyle = 'bg-sky-950 text-sky-300 border-sky-800/60';
      break;
    case 'LAB_QUEUE':
    case 'VERIFICATION':
      badgeStyle = 'bg-indigo-950 text-indigo-300 border-indigo-800/60';
      break;
    case 'CALIBRATION':
    case 'CALIBRATED':
      badgeStyle = 'bg-blue-950 text-blue-300 border-blue-800/60';
      break;
    case 'QUOTATION':
    case 'APPROVAL':
    case 'INVOICE_PO':
      badgeStyle = 'bg-amber-950 text-amber-300 border-amber-800/60';
      break;
    case 'CLIENT_SIGN':
    case 'READY_TO_DISPATCH':
    case 'DISPATCHED':
      badgeStyle = 'bg-purple-950 text-purple-300 border-purple-800/60';
      break;
    case 'CLIENT_RECEIVED':
    case 'DELIVERY_SIGNED':
    case 'COMPLETED':
      badgeStyle = 'bg-emerald-950 text-emerald-300 border-emerald-800/60';
      break;
    case 'FAULTY':
    case 'REJECTED':
    case 'CANCELLED':
      badgeStyle = 'bg-rose-950 text-rose-300 border-rose-800/60';
      break;
    case 'OUTSOURCED':
    case 'DISCREPANCY':
    case 'ON_HOLD':
    case 'PARTIALLY_COMPLETED':
      badgeStyle = 'bg-orange-950 text-orange-300 border-orange-800/60';
      break;
    default:
      badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm font-semibold' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${badgeStyle} ${sizeClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
      {status.replace(/_/g, ' ')}
    </span>
  );
};
