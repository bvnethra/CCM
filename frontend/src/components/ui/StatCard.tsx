import React from 'react';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  description,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-subtle',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3">
        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h4>
        {(change || description) && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            {change && (
              <span
                className={cn(
                  'font-medium px-1.5 py-0.5 rounded text-[11px]',
                  changeType === 'positive' && 'bg-emerald-50 text-emerald-700 font-semibold',
                  changeType === 'negative' && 'bg-rose-50 text-rose-700 font-semibold',
                  changeType === 'neutral' && 'bg-slate-100 text-slate-600'
                )}
              >
                {change}
              </span>
            )}
            {description && <span className="text-slate-500">{description}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
