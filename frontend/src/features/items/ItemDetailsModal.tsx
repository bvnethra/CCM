import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ItemMaster } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  Package,
  Sliders,
  Clock,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemMaster | null;
  onEdit?: () => void;
  canEdit?: boolean;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  isOpen,
  onClose,
  item,
  onEdit,
  canEdit,
}) => {
  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Item Master Profile & Technical Specifications"
      description="Equipment asset metadata, calibration parameters, and metrology scope"
      maxWidth="lg"
    >
      <div className="space-y-6 pt-1">
        {/* Header Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-600 text-white shadow-2xs shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">{item.item_name}</h3>
                  <Badge variant={item.status === 'active' ? 'success' : 'default'}>
                    {item.status}
                  </Badge>
                  {item.item_type && (
                    <Badge variant="info">
                      {item.item_type}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {item.item_code}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">ID: {item.id}</span>
                </div>
              </div>
            </div>

            {canEdit && onEdit && (
              <Button size="sm" onClick={onEdit}>
                Edit Item
              </Button>
            )}
          </div>
        </div>

        {/* Technical Specs & Calibration Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Equipment Specs */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Sliders className="w-4 h-4 text-blue-600" />
              Technical Specifications
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Manufacturer / OEM</span>
                <span className="font-semibold text-slate-800">{item.manufacturer || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Model Number</span>
                <span className="font-mono font-semibold text-slate-800">{item.model || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Serial Number</span>
                <span className="font-mono font-semibold text-slate-800">{item.serial_number || 'Not recorded'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Measurement Range</span>
                <span className="font-semibold text-slate-800">{item.measurement_range || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Least Count / Resolution</span>
                <span className="font-semibold text-slate-800">{item.least_count || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Calibration & Commercial Costing */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Clock className="w-4 h-4 text-emerald-600" />
              Calibration & Commercial
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Calibration Frequency</span>
                <span className="font-semibold text-slate-800">
                  Every {item.calibration_frequency} {item.calibration_frequency_unit || 'Months'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Standard Service Cost</span>
                <span className="font-semibold text-emerald-700 text-sm">
                  ₹{Number(item.standard_cost || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Classification</span>
                <span className="font-semibold text-slate-800">{item.item_type || 'General Instrument'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Operational Qualification</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {item.status === 'active' ? 'Eligible for Calibration Jobs' : 'Offline / Restricted'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Scope & Branch Facility */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            Branch & Facility Scope
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400 text-[11px]">Assigned Organization</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {item.organization ? `${item.organization.name} (${item.organization.code})` : 'All Branches (Global)'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Assigned Testing Facility</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {item.sub_organization ? `${item.sub_organization.name} (${item.sub_organization.code})` : 'All Facilities'}
              </p>
            </div>
          </div>
        </div>

        {/* Future Workflow Compatibility (Section 8: Request Item Availability Architecture) */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Future Calibration Request Compatibility
            </h4>
          </div>
          <p className="text-xs text-blue-700 leading-relaxed">
            This Item Master record is referenced by ID (`{item.id}`). When collection agents or clients
            create a Calibration Request, downstream line items determine dynamic request availability:
            <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-blue-200 text-blue-900 ml-1">
              item_available: YES / NO
            </code>
            without altering this master asset record.
          </p>
        </div>

        {/* Timestamps Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Onboarded: {formatDate(item.created_at)}
            </span>
            <span>Last Updated: {formatDate(item.updated_at)}</span>
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
