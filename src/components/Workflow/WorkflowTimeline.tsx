import React from 'react';
import { RequestStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

interface WorkflowTimelineProps {
  currentStatus: RequestStatus;
}

const STAGES: { key: RequestStatus; label: string }[] = [
  { key: 'CREATED', label: 'Created' },
  { key: 'COLLECTED', label: 'Availability Check' },
  { key: 'LAB_QUEUE', label: 'Lab Queue' },
  { key: 'VERIFICATION', label: 'Verified' },
  { key: 'CALIBRATION', label: 'Calibration' },
  { key: 'CALIBRATED', label: 'Calibrated' },
  { key: 'QUOTATION', label: 'Quotation' },
  { key: 'INVOICE_PO', label: 'Invoice / PO' },
  { key: 'CLIENT_SIGN', label: 'Signed' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'COMPLETED', label: 'Completed' },
];

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ currentStatus }) => {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full py-4 overflow-x-auto">
      <div className="flex items-center min-w-[750px] justify-between px-2">
        {STAGES.map((stage, idx) => {
          const isDone = idx < currentIndex || currentStatus === 'COMPLETED';
          const isCurrent = idx === currentIndex && currentStatus !== 'COMPLETED';

          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center group relative">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone
                      ? 'bg-sky-500 border-sky-400 text-slate-950 font-bold'
                      : isCurrent
                      ? 'bg-sky-950 border-sky-400 text-sky-400 font-bold shadow-lg shadow-sky-500/20 animate-pulse'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <span className="text-xs">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium mt-2 text-center whitespace-nowrap ${
                    isCurrent ? 'text-sky-400 font-semibold' : isDone ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 ${
                    idx < currentIndex ? 'bg-sky-500' : 'bg-slate-800'
                  }`}
                ></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
