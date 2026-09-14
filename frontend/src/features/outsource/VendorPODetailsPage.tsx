import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { PurchaseOrder, POStatus } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table, Column } from '../../components/ui/Table';
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';

interface VendorPODetailsPageProps {
  poId: string;
  onBack?: () => void;
  onNavigateToOutsourceDetails?: (outsourceId: string) => void;
}

export const VendorPODetailsPage: React.FC<VendorPODetailsPageProps> = ({
  poId,
  onBack,
  onNavigateToOutsourceDetails,
}) => {
  const { activeTenant } = useTenant();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPODetails = async () => {
    if (!activeTenant || !poId) return;
    setLoading(true);
    try {
      const data = await api.getVendorPurchaseOrderDetails(poId, activeTenant.id);
      setPo(data);
    } catch (err) {
      console.error('Failed to load Vendor PO details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPODetails();
  }, [activeTenant, poId]);

  const handleIssuePO = async () => {
    if (!activeTenant || !po) return;
    setActionLoading(true);
    try {
      await api.issueVendorPurchaseOrder(activeTenant.id, poId);
      await fetchPODetails();
    } catch (err: any) {
      alert(err.message || 'Failed to issue PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading Vendor Purchase Order details...
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-8 text-center text-slate-600 space-y-4">
        <p>Purchase order record not found.</p>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back to PO Directory
          </Button>
        )}
      </div>
    );
  }

  const renderStatusBadge = (status: POStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>;
      case 'ISSUED':
        return <Badge variant="info">Issued</Badge>;
      case 'CLOSED':
        return <Badge variant="success">Closed</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const itemColumns: Column<any>[] = [
    {
      header: '#',
      render: (row) => <span className="font-mono text-xs text-slate-500">{row.id || '1'}</span>,
    },
    {
      header: 'Item Description & Code',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.item?.item_name || row.description}</div>
          <div className="text-xs font-mono text-slate-500">
            {row.item?.item_code} | SN: {row.item?.serial_number || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Qty',
      render: (row) => <span className="font-mono text-center">{row.quantity}</span>,
    },
    {
      header: 'Unit Cost (₹)',
      render: (row) => <span className="font-mono text-right">₹{row.unit_cost.toFixed(2)}</span>,
    },
    {
      header: 'Line Total (₹)',
      render: (row) => <span className="font-mono font-bold text-slate-900 text-right">₹{row.line_total.toFixed(2)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto print:p-0">
      {/* Non-Printable Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Purchase Orders
          </Button>
        )}

        <div className="flex items-center gap-3">
          {po.outsource_request_id && onNavigateToOutsourceDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateToOutsourceDetails(po.outsource_request_id!)}
              className="text-xs"
            >
              View Linked Outsource Request
            </Button>
          )}

          {po.status === 'DRAFT' && (
            <Button
              onClick={handleIssuePO}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Issue Purchase Order
            </Button>
          )}

          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-1.5 text-xs text-slate-700 border-slate-300"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable PO Enterprise Card */}
      <Card className="p-8 space-y-8 bg-white border border-slate-300 shadow-sm print:shadow-none print:border-none print:p-0">
        {/* PO Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-7 h-7 text-indigo-600" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                VENDOR PURCHASE ORDER
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Commercial Metrology Outsourcing Purchase Order
            </p>
          </div>

          <div className="text-right">
            <div className="text-xl font-bold font-mono text-slate-900">{po.po_number}</div>
            <div className="mt-1">{renderStatusBadge(po.status)}</div>
            <div className="text-xs text-slate-500 font-mono mt-1">
              PO Date: {new Date(po.po_date).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Vendor & Tenant Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-lg border border-slate-200">
          <div className="space-y-1 text-xs">
            <span className="font-bold text-slate-900 uppercase tracking-wider block mb-1">
              Vendor Information (Supplier)
            </span>
            <div className="font-semibold text-slate-900 text-sm">{po.vendor?.vendor_name}</div>
            <div className="font-mono text-slate-600">Vendor Code: {po.vendor?.vendor_code}</div>
            <div className="text-slate-600">Contact: {po.vendor?.contact_person || 'N/A'} ({po.vendor?.contact_email})</div>
            <div className="text-slate-600 font-mono">GST #: {po.vendor?.gst_number || 'N/A'}</div>
          </div>

          <div className="space-y-1 text-xs sm:text-right">
            <span className="font-bold text-slate-900 uppercase tracking-wider block mb-1">
              Issued By (Acme Calibration Labs)
            </span>
            <div className="font-semibold text-slate-900 text-sm">{activeTenant?.name || 'Acme Calibration Labs'}</div>
            <div className="text-slate-600">Compliance: ISO/IEC 17025 Accredited Laboratory</div>
            <div className="text-slate-600">Currency: {po.currency} (INR ₹)</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Outsource Line Items
          </h3>
          <Table<any>
            columns={itemColumns}
            data={po.items || []}
            keyExtractor={(item) => item.id}
          />
        </div>

        {/* Commercial Totals Card */}
        <div className="flex justify-end pt-4">
          <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 text-xs">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">₹{po.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 text-xs">
              <span>GST / Tax (18%):</span>
              <span className="font-mono font-medium">₹{po.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-300 pt-2">
              <span>Total Amount:</span>
              <span className="font-mono text-emerald-700">₹{po.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Remarks & Signatures Footer */}
        <div className="border-t border-slate-200 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-900 block mb-1">PO Remarks / Special Instructions</span>
            <p className="bg-slate-50 p-3 rounded border border-slate-200 font-mono text-[11px]">
              {po.remarks || 'Standard vendor calibration service terms apply.'}
            </p>
          </div>

          <div className="space-y-2 sm:text-right">
            <span className="font-bold text-slate-900 block">Authorization Signature</span>
            <div className="h-12 border-b border-slate-300 flex items-end justify-end pb-1 font-serif italic text-slate-700">
              {po.issued_by_user?.full_name || po.created_by_user?.full_name || 'Authorized Signatory'}
            </div>
            <p className="text-[10px] text-slate-400">
              Issued at {po.issued_at ? new Date(po.issued_at).toLocaleString() : 'Draft Status'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
