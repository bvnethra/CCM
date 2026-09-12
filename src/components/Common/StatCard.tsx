import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  color?: 'sky' | 'emerald' | 'amber' | 'rose' | 'purple' | 'indigo';
  onClick?: () => void;
  statusText?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'sky',
  onClick,
  statusText,
}) => {
  const colorStyles = {
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };

  return (
    <div
      onClick={onClick}
      className={`enterprise-card p-4 flex flex-col justify-between transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-900' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-100 mt-1 tracking-tight">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg border ${colorStyles[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-[11px] text-slate-400 truncate">{subtitle}</span>
        {statusText && (
          <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
};
