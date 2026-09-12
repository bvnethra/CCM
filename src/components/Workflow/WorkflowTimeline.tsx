import React from 'react';
import { RequestStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

interface WorkflowTimelineProps {
  currentStatus: RequestStatus;
}

const LIFECYCLE_STAGES: { key: RequestStatus; label: string }[] = [
  { key: 'COLLECTED', label: 'Collection' },
  { key: 'CREATED', label: 'Availability Check' },
  { key: 'LAB_QUEUE', label: 'Request' },
  { key: 'VERIFICATION', label: 'Lab Verification' },
  { key: 'CALIBRATION', label: 'Calibration' },
  { key: 'QUOTATION', label: 'Commercial' },
  { key: 'DISPATCHED', label: 'Dispatch' },
  { key: 'DELIVERY_SIGNED', label: 'Delivery' },
  { key: 'COMPLETED', label: 'Completed' },
];

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ currentStatus }) => {
  const isBlocked = currentStatus === 'ON_HOLD' || currentStatus === 'FAULTY' || currentStatus === 'DISCREPANCY';
  const currentIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full py-2 overflow-x-auto">
      <div className="flex items-center min-w-[800px] justify-between px-2">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isDone = idx < currentIndex || currentStatus === 'COMPLETED';
          const isCurrent = idx === currentIndex && currentStatus !== 'COMPLETED';

          let circleStyle = 'bg-slate-900 border-slate-800 text-slate-500';
          if (isDone) {
            circleStyle = 'bg-sky-600 border-sky-500 text-white font-bold';
          } else if (isCurrent) {
            circleStyle = isBlocked
              ? 'bg-amber-950 border-amber-500 text-amber-300 font-bold animate-pulse'
              : 'bg-sky-950 border-sky-400 text-sky-300 font-bold animate-pulse';
          }

          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs transition-all ${circleStyle}`}>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent && isBlocked ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : isCurrent ? (
                    <Clock className="w-4 h-4 text-sky-400" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium mt-1.5 text-center whitespace-nowrap ${
                    isCurrent ? (isBlocked ? 'text-amber-400 font-bold' : 'text-sky-400 font-bold') : isDone ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {idx < LIFECYCLE_STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 ${idx < currentIndex ? 'bg-sky-500' : 'bg-slate-800'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
