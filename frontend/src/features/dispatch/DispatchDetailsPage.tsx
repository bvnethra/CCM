import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Dispatch, DispatchStatus, Signature } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { SignaturePad } from '../../components/ui/SignaturePad';
import {
  ArrowLeft,
  Truck,
  Box,
  MapPin,
  Building2,
  CheckCircle2,
  PackageCheck,
  Printer,
  ShieldCheck,
} from 'lucide-react';

interface DispatchDetailsPageProps {
  dispatchId: string;
  onBack: () => void;
}

export const DispatchDetailsPage: React.FC<DispatchDetailsPageProps> = ({
  dispatchId,
  onBack,
}) => {
  const { activeTenant } = useTenant();
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showMarkPackedModal, setShowMarkPackedModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [showViewSigModal, setShowViewSigModal] = useState(false);

  // Form Fields
  const [packageRef, setPackageRef] = useState('BOX-ACME-001');
  const [numPackages, setNumPackages] = useState(1);
  const [carrierName, setCarrierName] = useState('BlueDart Logistics');
  const [trackingNo, setTrackingNo] = useState(`TRK-${Math.floor(100000000 + Math.random() * 900000000)}`);
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  );

  // Delivery Signature Form
  const [recipientName, setRecipientName] = useState('');
  const [recipientRole, setRecipientRole] = useState('Receiving Manager');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliverySigData, setDeliverySigData] = useState<string | null>(null);

  const fetchDispatch = async () => {
    if (!activeTenant || !dispatchId) return;
    setLoading(true);
    try {
      const data = await api.getDispatchDetails(dispatchId, activeTenant.id);
      setDispatch(data);
      if (data.client) {
        setRecipientName(data.client.contact_person || '');
        setRecipientEmail(data.client.contact_email || '');
        setRecipientPhone(data.client.contact_phone || '');
      }
    } catch (err) {
      console.error('Failed to load dispatch details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatch();
  }, [activeTenant, dispatchId]);

  const handleStartPacking = async () => {
    if (!activeTenant || !dispatch) return;
    setActionLoading(true);
    try {
      await api.startPacking(activeTenant.id, dispatch.id, { remarks: 'Packing initialized.' });
      await fetchDispatch();
    } catch (err: any) {
      alert(err.message || 'Failed to start packing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPackedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !dispatch) return;
    if (!packageRef.trim()) {
      alert('Package reference is required');
      return;
    }

    setActionLoading(true);
    try {
      await api.markPacked(activeTenant.id, dispatch.id, {
        package_reference: packageRef.trim(),
        number_of_packages: Number(numPackages) || 1,
        packing_remarks: 'Items safely packed in cardboard box with protective foam.',
      });
      setShowMarkPackedModal(false);
      await fetchDispatch();
    } catch (err: any) {
      alert(err.message || 'Failed to mark packed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !dispatch) return;
    if (!carrierName.trim() || !trackingNo.trim()) {
      alert('Carrier name and tracking number are required');
      return;
    }

    setActionLoading(true);
    try {
      await api.shipDispatch(activeTenant.id, dispatch.id, {
        carrier_name: carrierName.trim(),
        tracking_number: trackingNo.trim(),
        dispatch_date: dispatchDate,
        expected_delivery_date: expectedDeliveryDate,
      });
      setShowShipModal(false);
      await fetchDispatch();
    } catch (err: any) {
      alert(err.message || 'Failed to ship dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTracking = async (newStatus: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY') => {
    if (!activeTenant || !dispatch) return;
    setActionLoading(true);
    try {
      await api.updateDispatchTracking(activeTenant.id, dispatch.id, {
        status: newStatus,
        carrier_notes: `Carrier updated tracking status to ${newStatus}`,
      });
      await fetchDispatch();
    } catch (err: any) {
      alert(err.message || 'Failed to update tracking status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !dispatch) return;
    if (!recipientName.trim()) {
      alert('Recipient name is required');
      return;
    }
    if (!deliverySigData) {
      alert('Please draw the client delivery signature on the canvas pad before confirming.');
      return;
    }

    setActionLoading(true);
    try {
      await api.confirmDelivery(activeTenant.id, dispatch.id, {
        recipient_name: recipientName.trim(),
        recipient_role: recipientRole.trim(),
        recipient_email: recipientEmail.trim(),
        recipient_phone: recipientPhone.trim(),
        delivery_date: new Date().toISOString(),
        delivery_signature_data: deliverySigData,
        remarks: 'Client delivery confirmed and handheld delivery signature captured.',
      });
      setShowDeliverModal(false);
      await fetchDispatch();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status: DispatchStatus) => {
    switch (status) {
      case 'READY_FOR_DISPATCH':
        return <Badge variant="info">Ready for Dispatch</Badge>;
      case 'PACKING':
        return <Badge variant="warning">Packing in Progress</Badge>;
      case 'PACKED':
        return <Badge variant="purple">Packed</Badge>;
      case 'DISPATCHED':
        return <Badge variant="info" className="bg-blue-600 text-white">Dispatched</Badge>;
      case 'IN_TRANSIT':
        return <Badge variant="purple" className="bg-purple-600 text-white">In Transit</Badge>;
      case 'OUT_FOR_DELIVERY':
        return <Badge variant="warning" className="bg-amber-500 text-white font-bold">Out for Delivery</Badge>;
      case 'DELIVERED':
        return <Badge variant="success" className="bg-emerald-600 text-white font-bold">Delivered</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading dispatch details...</div>;
  }

  if (!dispatch) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Dispatch record not found.
        <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const deliverySig: Signature | null = dispatch.delivery?.signature || null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="text-slate-600 border-slate-300">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                {dispatch.dispatch_number}
              </h1>
              <Badge variant="purple">{dispatch.dispatch_type}</Badge>
              {renderStatusBadge(dispatch.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dispatch Date: {dispatch.dispatch_date} | Expected Delivery: {dispatch.expected_delivery_date || 'N/A'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {dispatch.status === 'READY_FOR_DISPATCH' && (
            <Button
              onClick={handleStartPacking}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              <Box className="w-3.5 h-3.5 mr-1" /> Start Packing
            </Button>
          )}

          {dispatch.status === 'PACKING' && (
            <Button
              onClick={() => setShowMarkPackedModal(true)}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              <PackageCheck className="w-3.5 h-3.5 mr-1" /> Mark Packed
            </Button>
          )}

          {dispatch.status === 'PACKED' && (
            <Button
              onClick={() => setShowShipModal(true)}
              disabled={actionLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              <Truck className="w-3.5 h-3.5 mr-1" /> Dispatch Shipment
            </Button>
          )}

          {dispatch.status === 'DISPATCHED' && (
            <Button
              onClick={() => handleUpdateTracking('IN_TRANSIT')}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              <MapPin className="w-3.5 h-3.5 mr-1" /> Set IN TRANSIT
            </Button>
          )}

          {dispatch.status === 'IN_TRANSIT' && (
            <Button
              onClick={() => handleUpdateTracking('OUT_FOR_DELIVERY')}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              <Truck className="w-3.5 h-3.5 mr-1" /> Set OUT FOR DELIVERY
            </Button>
          )}

          {(dispatch.status === 'DISPATCHED' || dispatch.status === 'IN_TRANSIT' || dispatch.status === 'OUT_FOR_DELIVERY') && (
            <Button
              onClick={() => setShowDeliverModal(true)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm Delivery & Sign
            </Button>
          )}

          {deliverySig && (
            <Button
              onClick={() => setShowViewSigModal(true)}
              variant="outline"
              size="sm"
              className="text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> View Delivery Signature
            </Button>
          )}

          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="text-xs text-slate-700 border-slate-300"
          >
            <Printer className="w-3.5 h-3.5 mr-1" /> Print Delivery Note
          </Button>
        </div>
      </div>

      {/* Dispatch Lifecycle Timeline Banner */}
      <Card className="p-5 border-l-4 border-l-indigo-600 border-slate-200">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Dispatch & Delivery Lifecycle Progress</h2>
          </div>
          <Badge variant={dispatch.status === 'DELIVERED' ? 'success' : 'purple'}>
            Status: {dispatch.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-800">
            <span className="block font-bold">1. Ready</span>
            <span className="text-[10px]">Verified</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${dispatch.status !== 'READY_FOR_DISPATCH' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">2. Packing</span>
            <span className="text-[10px]">{dispatch.status !== 'READY_FOR_DISPATCH' ? 'Packed' : 'Pending'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${dispatch.status === 'PACKED' || dispatch.status === 'DISPATCHED' || dispatch.status === 'IN_TRANSIT' || dispatch.status === 'OUT_FOR_DELIVERY' || dispatch.status === 'DELIVERED' ? 'bg-purple-50 border-purple-200 text-purple-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">3. Packed</span>
            <span className="text-[10px]">{dispatch.items?.[0]?.package_reference || 'Box Ready'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${dispatch.status === 'DISPATCHED' || dispatch.status === 'IN_TRANSIT' || dispatch.status === 'OUT_FOR_DELIVERY' || dispatch.status === 'DELIVERED' ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">4. Dispatched</span>
            <span className="text-[10px]">{dispatch.carrier_name || 'Pending'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${dispatch.status === 'IN_TRANSIT' || dispatch.status === 'OUT_FOR_DELIVERY' || dispatch.status === 'DELIVERED' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">5. In Transit</span>
            <span className="text-[10px]">{dispatch.tracking_number || 'TRK Pending'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${dispatch.status === 'DELIVERED' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">6. Delivered</span>
            <span className="text-[10px]">{dispatch.status === 'DELIVERED' ? 'Delivered' : 'Pending'}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${dispatch.status === 'DELIVERED' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span className="block font-bold">7. Completion</span>
            <span className="text-[10px]">{dispatch.status === 'DELIVERED' ? 'Request Completed' : 'Pending'}</span>
          </div>
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Carrier & Client Info */}
        <Card className="p-5 space-y-4 lg:col-span-1 border-slate-200">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-indigo-600" />
              Carrier & Shipment Tracking
            </h2>
            <div className="text-sm font-bold text-slate-900">{dispatch.carrier_name || 'Carrier Not Assigned'}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Tracking #: <span className="font-semibold text-slate-800">{dispatch.tracking_number || 'N/A'}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Dispatched Date: <span className="font-semibold text-slate-800">{dispatch.dispatch_date}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Expected Delivery: <span className="font-semibold text-slate-800">{dispatch.expected_delivery_date || 'N/A'}</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Client Details & Destination
            </h2>
            <div className="text-sm font-bold text-slate-900">{dispatch.client?.client_name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">Client Code: {dispatch.client?.client_code}</div>
            <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border mt-2">
              <span className="font-semibold text-slate-800 block mb-0.5">Shipping Address Snapshot:</span>
              {dispatch.shipping_address}
            </div>
          </div>

          {dispatch.remarks && (
            <div className="border-t border-slate-200 pt-4 text-xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Packing / Dispatch Remarks</h2>
              <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border italic">{dispatch.remarks}</p>
            </div>
          )}
        </Card>

        {/* Right Column: Dispatched Items Breakdown */}
        <Card className="p-5 space-y-5 lg:col-span-2 border-slate-200">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b pb-2 flex items-center gap-1.5">
            <Box className="w-4 h-4 text-indigo-600" />
            Dispatched Items Traceability ({dispatch.items?.length || 0})
          </h2>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Item Name & Code</th>
                  <th className="p-3">Serial Number</th>
                  <th className="p-3 font-mono">Invoice Number</th>
                  <th className="p-3 font-mono">Package Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dispatch.items || []).map((di, idx) => (
                  <tr key={di.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{di.item?.item_name || 'Instrument'}</div>
                      <div className="text-[11px] font-mono text-slate-500">{di.item?.item_code}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-700">{di.item?.serial_number || 'N/A'}</td>
                    <td className="p-3 font-mono font-semibold text-indigo-600">{dispatch.invoice?.invoice_number || 'INV-2026-000001'}</td>
                    <td className="p-3 font-mono text-purple-700 font-semibold">{di.package_reference || 'BOX-ACME-001'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* MODAL: Mark Packed */}
      <Modal
        isOpen={showMarkPackedModal}
        onClose={() => setShowMarkPackedModal(false)}
        title="Mark Equipment Packed for Dispatch"
      >
        <form onSubmit={handleMarkPackedSubmit} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Enter package reference box ID and packing specifications for dispatch <span className="font-mono font-semibold">{dispatch.dispatch_number}</span>.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Package Reference / Box Barcode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={packageRef}
              onChange={(e) => setPackageRef(e.target.value)}
              placeholder="e.g. BOX-ACME-001"
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Number of Packages</label>
            <input
              type="number"
              min={1}
              value={numPackages}
              onChange={(e) => setNumPackages(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowMarkPackedModal(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={actionLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
              Confirm Item Packing
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Ship Dispatch */}
      <Modal
        isOpen={showShipModal}
        onClose={() => setShowShipModal(false)}
        title="Ship Equipment & Assign Courier Tracking"
      >
        <form onSubmit={handleShipSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Carrier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              placeholder="e.g. BlueDart Logistics / FedEx / Professional Couriers"
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Airway Bill / Tracking Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="e.g. TRK-987654321"
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dispatch Date</label>
              <input
                type="date"
                required
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowShipModal(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
              Ship & Update Tracking
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Confirm Delivery & Capture Delivery Signature */}
      <Modal
        isOpen={showDeliverModal}
        onClose={() => setShowDeliverModal(false)}
        title="Confirm Client Delivery & Capture Delivery Signature"
      >
        <form onSubmit={handleConfirmDeliverySubmit} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Capture client handheld delivery signature for dispatch <span className="font-mono font-semibold">{dispatch.dispatch_number}</span>. This signature is stored separately under <span className="font-semibold text-emerald-700">signature_type = DELIVERY</span>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Recipient Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Kumar"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient Role / Title</label>
              <input
                type="text"
                value={recipientRole}
                onChange={(e) => setRecipientRole(e.target.value)}
                placeholder="e.g. Receiving Officer"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="e.g. r.kumar@acme.com"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient Phone</label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-2">
              Delivery Digital Signature Drawing <span className="text-red-500">*</span>
            </label>
            <SignaturePad
              onSignatureChange={(dataUrl) => setDeliverySigData(dataUrl)}
              width={550}
              height={170}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowDeliverModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={actionLoading || !recipientName.trim() || !deliverySigData}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Confirm Delivery & Update Request Status
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: View Delivery Signature Details */}
      <Modal
        isOpen={showViewSigModal}
        onClose={() => setShowViewSigModal(false)}
        title="Client Delivery Digital Signature Details"
      >
        {deliverySig ? (
          <div className="space-y-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <span className="font-bold">STATUS: DELIVERY SIGNED & VERIFIED</span>
                  <p className="text-[11px] text-emerald-700">Digital signature for equipment receipt (DELIVERY signature type)</p>
                </div>
              </div>
              <Badge variant="success">DELIVERY SIGNATURE</Badge>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Name:</span>
                <span className="font-semibold text-slate-900">{deliverySig.signer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Role:</span>
                <span className="text-slate-800">{deliverySig.signer_role || 'Receiving Officer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Signature Ref:</span>
                <span className="font-mono text-indigo-700">{deliverySig.signature_reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Timestamp:</span>
                <span className="font-mono text-slate-800">{deliverySig.signed_at ? new Date(deliverySig.signed_at).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">R2 Storage Reference:</span>
                <span className="font-mono text-slate-600 text-[11px]">{deliverySig.signature_storage_reference}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowViewSigModal(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-slate-500 text-xs">No delivery signature record available.</div>
        )}
      </Modal>
    </div>
  );
};
