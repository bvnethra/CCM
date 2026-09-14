import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import {
  VendorOutsourceRequest,
  OutsourceStatus,
  VendorCalibrationResult,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeft,
  Truck,
  Building,
  Send,
  RotateCcw,
  FileCheck2,
  Award,
} from 'lucide-react';

interface VendorOutsourceDetailsPageProps {
  outsourceId: string;
  onBack?: () => void;
  onViewPO?: (poId: string) => void;
  onReintegrateSuccess?: () => void;
}

export const VendorOutsourceDetailsPage: React.FC<VendorOutsourceDetailsPageProps> = ({
  outsourceId,
  onBack,
  onViewPO,
  onReintegrateSuccess,
}) => {
  const { activeTenant } = useTenant();

  const [request, setRequest] = useState<VendorOutsourceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showPOModal, setShowPOModal] = useState(false);
  const [poUnitCost, setPoUnitCost] = useState('15000');
  const [poRemarks, setPoRemarks] = useState('');

  const [showSendModal, setShowSendModal] = useState(false);
  const [carrier, setCarrier] = useState('BlueDart Express');
  const [trackingNumber, setTrackingNumber] = useState('');

  const [showCalModal, setShowCalModal] = useState(false);
  const [vendorCertNo, setVendorCertNo] = useState('');
  const [vendorResult, setVendorResult] = useState<VendorCalibrationResult>('PASS');
  const [calRemarks, setCalRemarks] = useState('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnCarrier, setReturnCarrier] = useState('BlueDart Express');
  const [returnTracking, setReturnTracking] = useState('');

  const fetchDetails = async () => {
    if (!activeTenant || !outsourceId) return;
    setLoading(true);
    try {
      const data = await api.getVendorOutsourceDetails(outsourceId, activeTenant.id);
      setRequest(data);
    } catch (err) {
      console.error('Failed to load vendor outsource details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [activeTenant, outsourceId]);

  const handleCreatePO = async () => {
    if (!activeTenant || !request || !request.request_item) return;
    setActionLoading(true);
    try {
      const po = await api.createVendorPurchaseOrder(activeTenant.id, {
        vendor_id: request.vendor_id,
        request_id: request.request_id,
        outsource_request_id: request.id,
        items: [
          {
            request_item_id: request.request_item_id,
            item_id: request.request_item.item_id,
            quantity: 1,
            unit_cost: parseFloat(poUnitCost) || 0,
            description: `External Calibration for ${request.request_item.item?.item_name || 'Item'}`,
          },
        ],
        remarks: poRemarks,
      });
      setShowPOModal(false);
      alert(`Vendor Purchase Order ${po.po_number} created successfully as DRAFT!`);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to create Vendor PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssuePO = async () => {
    if (!activeTenant || !request || !request.purchase_order) return;
    setActionLoading(true);
    try {
      await api.issueVendorPurchaseOrder(activeTenant.id, request.purchase_order.id);
      alert(`Vendor PO ${request.purchase_order.po_number} has been ISSUED.`);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to issue PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToVendor = async () => {
    if (!activeTenant || !request) return;
    if (!trackingNumber.trim()) {
      alert('Tracking number is required.');
      return;
    }
    setActionLoading(true);
    try {
      await api.sendItemToVendor(activeTenant.id, request.id, {
        carrier,
        tracking_number: trackingNumber,
      });
      setShowSendModal(false);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to send item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVendorReceived = async () => {
    if (!activeTenant || !request) return;
    setActionLoading(true);
    try {
      await api.markVendorReceived(activeTenant.id, request.id, {
        remarks: 'Item safely received at vendor facility.',
      });
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to mark vendor receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartVendorCal = async () => {
    if (!activeTenant || !request) return;
    setActionLoading(true);
    try {
      await api.startVendorCalibration(activeTenant.id, request.id);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to start vendor calibration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordVendorCal = async () => {
    if (!activeTenant || !request) return;
    if (!vendorCertNo.trim()) {
      alert('Vendor certificate number is required.');
      return;
    }
    if ((vendorResult === 'FAIL' || vendorResult === 'NOT_CALIBRATABLE') && !calRemarks.trim()) {
      alert('Mandatory failure remarks are required when recording a vendor FAIL result.');
      return;
    }

    setActionLoading(true);
    try {
      await api.recordVendorCalibrationResult(activeTenant.id, request.id, {
        vendor_certificate_number: vendorCertNo,
        vendor_result: vendorResult,
        remarks: calRemarks,
      });
      setShowCalModal(false);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to record vendor calibration result');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordReturn = async () => {
    if (!activeTenant || !request) return;
    if (!returnTracking.trim()) {
      alert('Return tracking number is required.');
      return;
    }
    setActionLoading(true);
    try {
      await api.recordVendorReturn(activeTenant.id, request.id, {
        carrier: returnCarrier,
        tracking_number: returnTracking,
      });
      setShowReturnModal(false);
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to record return shipment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveBack = async () => {
    if (!activeTenant || !request) return;
    setActionLoading(true);
    try {
      await api.receiveItemBack(activeTenant.id, request.id, {
        remarks: 'Item inspected and received back in lab.',
      });
      await fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to receive item back');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReintegrate = async () => {
    if (!activeTenant || !request) return;
    if (!confirm('Are you sure you want to reintegrate this vendor-calibrated item as CALIBRATED into the main flow?')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.reintegrateIntoMainFlow(activeTenant.id, request.id);
      alert('Item successfully reintegrated as CALIBRATED into main flow!');
      if (onReintegrateSuccess) {
        onReintegrateSuccess();
      } else {
        await fetchDetails();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reintegrate item');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading vendor outsourcing workspace...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center text-slate-600 space-y-4">
        <p>Outsourcing request record not found.</p>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back to Directory
          </Button>
        )}
      </div>
    );
  }

  const renderStatusBadge = (status: OutsourceStatus) => {
    switch (status) {
      case 'OUTSOURCE_REQUIRED':
        return <Badge variant="warning">Outsource Required</Badge>;
      case 'VENDOR_SELECTED':
        return <Badge variant="info">Vendor Selected</Badge>;
      case 'PO_DRAFT':
        return <Badge variant="default">PO Draft</Badge>;
      case 'PO_ISSUED':
        return <Badge variant="purple">PO Issued</Badge>;
      case 'SENT_TO_VENDOR':
        return <Badge variant="info">Sent to Vendor</Badge>;
      case 'VENDOR_RECEIVED':
        return <Badge variant="info">Vendor Received</Badge>;
      case 'VENDOR_CALIBRATION':
        return <Badge variant="purple">In Vendor Cal</Badge>;
      case 'VENDOR_COMPLETED':
        return <Badge variant="success">Vendor Cal Done</Badge>;
      case 'AWAITING_RETURN':
        return <Badge variant="warning">Awaiting Return</Badge>;
      case 'RECEIVED_BACK':
        return <Badge variant="info">Received Back</Badge>;
      case 'REINTEGRATED':
        return <Badge variant="success">Reintegrated (Calibrated)</Badge>;
      case 'VENDOR_FAILED':
        return <Badge variant="destructive">Vendor Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back Button */}
      {onBack && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-700 hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Outsourcing Directory
        </Button>
      )}

      {/* Header Banner */}
      <Card className="p-6 border-l-4 border-l-indigo-600 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {request.id}
              </h1>
              {renderStatusBadge(request.outsource_status)}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Request #{request.request?.request_number || 'N/A'} | Vendor: <span className="font-semibold">{request.vendor?.vendor_name}</span>
            </p>
          </div>

          {/* Action CTAs depending on workflow stage */}
          <div className="flex items-center gap-2 flex-wrap">
            {!request.purchase_order && (
              <Button
                onClick={() => setShowPOModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
              >
                Create Vendor PO
              </Button>
            )}

            {request.purchase_order && request.purchase_order.status === 'DRAFT' && (
              <Button
                onClick={handleIssuePO}
                disabled={actionLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs"
              >
                Issue Vendor PO
              </Button>
            )}

            {request.outsource_status === 'PO_ISSUED' && (
              <Button
                onClick={() => setShowSendModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send Item to Vendor
              </Button>
            )}

            {request.outsource_status === 'SENT_TO_VENDOR' && (
              <Button
                onClick={handleVendorReceived}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
              >
                Mark Vendor Received
              </Button>
            )}

            {request.outsource_status === 'VENDOR_RECEIVED' && (
              <Button
                onClick={handleStartVendorCal}
                disabled={actionLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs"
              >
                Start Vendor Calibration
              </Button>
            )}

            {request.outsource_status === 'VENDOR_CALIBRATION' && (
              <Button
                onClick={() => setShowCalModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs inline-flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                Record Vendor Result & Cert
              </Button>
            )}

            {request.outsource_status === 'VENDOR_COMPLETED' && (
              <Button
                onClick={() => setShowReturnModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs"
              >
                Record Vendor Return Shipment
              </Button>
            )}

            {request.outsource_status === 'AWAITING_RETURN' && (
              <Button
                onClick={handleReceiveBack}
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
              >
                Receive Item Back in Lab
              </Button>
            )}

            {request.outsource_status === 'RECEIVED_BACK' && (
              <Button
                onClick={handleReintegrate}
                disabled={actionLoading}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reintegrate Into Main Flow (Calibrated)
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Outsource Reason & Context */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <Truck className="w-5 h-5 text-indigo-600" />
              Outsourcing Request Parameters
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Outsource Reason
                </label>
                <p className="mt-1 text-sm text-slate-900 bg-slate-50 p-3 rounded border border-slate-200">
                  {request.outsource_reason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Expected Return Date
                  </label>
                  <span className="text-sm font-semibold font-mono text-slate-900">
                    {request.expected_return_date ? new Date(request.expected_return_date).toLocaleDateString() : 'Unscheduled'}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Vendor Reference
                  </label>
                  <span className="text-sm font-mono text-slate-800">
                    {request.vendor_reference || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Vendor Calibration Record Card */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <Award className="w-5 h-5 text-amber-600" />
              External Vendor Calibration Certificate & Result
            </h2>

            {request.vendor_calibration_record ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Vendor Certificate Number</span>
                    <span className="font-mono font-bold text-slate-900">{request.vendor_calibration_record.vendor_certificate_number}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Vendor Result</span>
                    <Badge variant={request.vendor_calibration_record.vendor_result === 'PASS' || request.vendor_calibration_record.vendor_result === 'ADJUSTED' ? 'success' : 'destructive'}>
                      {request.vendor_calibration_record.vendor_result}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Calibration Date</span>
                    <span className="text-slate-800 font-mono">
                      {request.vendor_calibration_record.calibrated_at || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Report Recorded Date</span>
                    <span className="text-slate-800">
                      {new Date(request.vendor_calibration_record.report_received_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {request.vendor_calibration_record.remarks && (
                  <div className="pt-2">
                    <span className="text-xs text-slate-500 block">Vendor Remarks</span>
                    <p className="text-xs text-slate-700 italic bg-slate-50 p-2.5 rounded border border-slate-200 mt-1">
                      "{request.vendor_calibration_record.remarks}"
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500 flex items-center justify-between">
                <span>Vendor calibration result has not been recorded yet.</span>
                {request.outsource_status === 'VENDOR_CALIBRATION' && (
                  <Button size="sm" variant="outline" onClick={() => setShowCalModal(true)}>
                    Record Result Now
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Physical Shipment Movements Card */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <Send className="w-5 h-5 text-blue-600" />
              Shipment Movement Traceability
            </h2>

            {request.movements && request.movements.length > 0 ? (
              <div className="space-y-3">
                {request.movements.map((mov) => (
                  <div key={mov.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block">{mov.movement_type}</span>
                      <span className="text-slate-500">Carrier: {mov.carrier || 'N/A'} | Tracking: <strong className="font-mono">{mov.tracking_number}</strong></span>
                    </div>
                    <span className="text-slate-500 font-mono">{mov.movement_date}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No physical shipments recorded yet.</p>
            )}
          </Card>
        </div>

        {/* Sidebar Right Column (1 Col) */}
        <div className="space-y-6">
          {/* Vendor PO Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                Vendor Purchase Order
              </h3>
              {request.purchase_order && (
                <Badge variant={request.purchase_order.status === 'ISSUED' ? 'purple' : 'default'}>
                  {request.purchase_order.status}
                </Badge>
              )}
            </div>

            {request.purchase_order ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">PO Number</span>
                  <span className="font-mono font-bold text-slate-900">{request.purchase_order.po_number}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Total Amount (incl. Tax)</span>
                  <span className="font-mono font-bold text-emerald-700 text-base">
                    ₹{request.purchase_order.total_amount.toFixed(2)}
                  </span>
                </div>
                {onViewPO && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewPO(request.purchase_order!.id)}
                    className="w-full mt-2 text-xs"
                  >
                    View PO Details & Print
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 space-y-2">
                <p>No PO generated for this outsourcing request.</p>
                <Button size="sm" onClick={() => setShowPOModal(true)} className="w-full">
                  Create Vendor PO
                </Button>
              </div>
            )}
          </Card>

          {/* Vendor Details Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-slate-500" />
              Outsource Vendor Details
            </h3>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Vendor Name</span>
                <span className="font-semibold text-slate-900">{request.vendor?.vendor_name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Vendor Code</span>
                <span className="font-mono text-slate-800">{request.vendor?.vendor_code}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Contact Person</span>
                <span className="text-slate-800">{request.vendor?.contact_person || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Serviced Categories</span>
                <span className="text-xs text-slate-700 font-medium">
                  {request.vendor?.serviced_categories?.join(', ') || 'All Categories'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* CREATE PO MODAL */}
      {showPOModal && (
        <Modal isOpen={showPOModal} onClose={() => setShowPOModal(false)} title="Generate Vendor Purchase Order (PO)">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Cost (₹ INR) *</label>
              <Input
                type="number"
                value={poUnitCost}
                onChange={(e) => setPoUnitCost(e.target.value)}
                placeholder="15000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PO Remarks / Notes</label>
              <Input
                type="text"
                value={poRemarks}
                onChange={(e) => setPoRemarks(e.target.value)}
                placeholder="e.g. Authorized under NABL primary standard calibration contract."
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="outline" onClick={() => setShowPOModal(false)}>Cancel</Button>
              <Button onClick={handleCreatePO} disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Generate Draft PO
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* SEND ITEM MODAL */}
      {showSendModal && (
        <Modal isOpen={showSendModal} onClose={() => setShowSendModal(false)} title="Send Item to Vendor">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Carrier / Logistics Provider *</label>
              <Input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tracking Number *</label>
              <Input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. BLR-EXP-99201"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
              <Button onClick={handleSendToVendor} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                Confirm Shipment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* RECORD CALIBRATION MODAL */}
      {showCalModal && (
        <Modal isOpen={showCalModal} onClose={() => setShowCalModal(false)} title="Record Vendor Calibration Result">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Certificate Number *</label>
              <Input
                type="text"
                value={vendorCertNo}
                onChange={(e) => setVendorCertNo(e.target.value)}
                placeholder="e.g. NABL-CERT-2026-9901"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Calibration Result *</label>
              <Select
                value={vendorResult}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVendorResult(e.target.value as VendorCalibrationResult)}
              >
                <option value="PASS">PASS (Conforms to Specification)</option>
                <option value="ADJUSTED">ADJUSTED (Adjusted & Calibrated)</option>
                <option value="FAIL">FAIL (Out of Specification)</option>
                <option value="NOT_CALIBRATABLE">NOT CALIBRATABLE (Damaged / Faulty)</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Remarks / Reason {(vendorResult === 'FAIL' || vendorResult === 'NOT_CALIBRATABLE') && '(Mandatory *)'}
              </label>
              <Input
                type="text"
                value={calRemarks}
                onChange={(e) => setCalRemarks(e.target.value)}
                placeholder="Remarks or failure reason..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="outline" onClick={() => setShowCalModal(false)}>Cancel</Button>
              <Button onClick={handleRecordVendorCal} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Submit Vendor Result
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* RETURN SHIPMENT MODAL */}
      {showReturnModal && (
        <Modal isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} title="Record Vendor Return Shipment">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Return Carrier *</label>
              <Input
                type="text"
                value={returnCarrier}
                onChange={(e) => setReturnCarrier(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Return Tracking Number *</label>
              <Input
                type="text"
                value={returnTracking}
                onChange={(e) => setReturnTracking(e.target.value)}
                placeholder="e.g. RET-BLR-88190"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="outline" onClick={() => setShowReturnModal(false)}>Cancel</Button>
              <Button onClick={handleRecordReturn} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
                Record Return Shipment
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
