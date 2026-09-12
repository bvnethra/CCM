import React from 'react';
import { RequestStatus } from '../../types';

interface StatusBadgeProps {
  status: RequestStatus | string;
  size?: 'sm' | 'md' | 'lg';
  type?: 'status' | 'availability';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', type = 'status' }) => {
  let badgeStyle = 'bg-slate-800/80 text-slate-300 border-slate-700/80';
  let label = status.replace(/_/g, ' ');

  if (type === 'availability') {
    if (status === 'AVAILABLE' || status === 'YES' || status === 'true') {
      badgeStyle = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
      label = 'Available';
    } else if (status === 'UNAVAILABLE' || status === 'NO' || status === 'false') {
      badgeStyle = 'bg-rose-950/60 text-rose-300 border-rose-800/60';
      label = 'Unavailable';
    } else {
      badgeStyle = 'bg-amber-950/60 text-amber-300 border-amber-800/60';
      label = 'Partial';
    }
  } else {
    switch (status) {
      case 'CREATED':
      case 'COLLECTED':
        badgeStyle = 'bg-sky-950/60 text-sky-300 border-sky-800/60';
        label = 'Pending';
        break;
      case 'LAB_QUEUE':
      case 'VERIFICATION':
        badgeStyle = 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60';
        label = 'In Lab';
        break;
      case 'CALIBRATION':
      case 'CALIBRATED':
        badgeStyle = 'bg-blue-950/60 text-blue-300 border-blue-800/60';
        label = 'Calibration';
        break;
      case 'QUOTATION':
      case 'APPROVAL':
      case 'INVOICE_PO':
        badgeStyle = 'bg-amber-950/60 text-amber-300 border-amber-800/60';
        label = 'Commercial';
        break;
      case 'CLIENT_SIGN':
      case 'READY_TO_DISPATCH':
      case 'DISPATCHED':
        badgeStyle = 'bg-purple-950/60 text-purple-300 border-purple-800/60';
        label = 'Dispatched';
        break;
      case 'CLIENT_RECEIVED':
      case 'DELIVERY_SIGNED':
      case 'COMPLETED':
        badgeStyle = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
        label = 'Completed';
        break;
      case 'FAULTY':
        badgeStyle = 'bg-rose-950/60 text-rose-300 border-rose-800/60';
        label = 'Faulty';
        break;
      case 'OUTSOURCED':
        badgeStyle = 'bg-orange-950/60 text-orange-300 border-orange-800/60';
        label = 'Outsourced';
        break;
      case 'ON_HOLD':
      case 'DISCREPANCY':
      case 'PARTIALLY_COMPLETED':
        badgeStyle = 'bg-amber-950/60 text-amber-300 border-amber-800/60';
        label = status.replace(/_/g, ' ');
        break;
      case 'REJECTED':
      case 'CANCELLED':
        badgeStyle = 'bg-rose-950/60 text-rose-300 border-rose-800/60';
        label = status.replace(/_/g, ' ');
        break;
      default:
        badgeStyle = 'bg-slate-800/80 text-slate-300 border-slate-700/80';
    }
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px]'
      : size === 'lg'
      ? 'px-3 py-1 text-xs font-semibold'
      : 'px-2.5 py-0.5 text-[11px] font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${badgeStyle} ${sizeClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"></span>
      {label}
    </span>
  );
};
