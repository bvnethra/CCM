import React, { useEffect, useState } from 'react';
import { Gauge, AlertTriangle, FileText, Wrench, ExternalLink, Award } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { fetchApi } from '../api/client';
import { CalibrationRequest, CalibrationRecord } from '../types';

export const CalibrationQueue: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'dueList'>('queue');
  const [requests, setRequests] = useState<CalibrationRequest[]>([]);
  const [dueListData, setDueListData] = useState<any>({ overdue: [], dueSoon: [], active: [] });
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([]);

  const [selectedReq, setSelectedReq] = useState<CalibrationRequest | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Modals
  const [isCalibModalOpen, setIsCalibModalOpen] = useState(false);
  const [isFaultyModalOpen, setIsFaultyModalOpen] = useState(false);
  const [isOutsourceModalOpen, setIsOutsourceModalOpen] = useState(false);

  // Form states
  const [standardUsed, setStandardUsed] = useState('Gauge Block Set Class 0 (SN-GB-992)');
  const [resultStatus, setResultStatus] = useState<'PASS' | 'FAIL' | 'FAULTY' | 'OUTSOURCE'>('PASS');
  const [calibrationDate, setCalibrationDate] = useState(new Date().toISOString().split('T')[0]);
  const [calibrationFrequencyMonths, setCalibrationFrequencyMonths] = useState(12);

  // Faulty form
  const [serviceNotes, setServiceNotes] = useState('Voltage measurement drift detected. Recommended for factory overhaul.');

  // Outsource form
  const [vendorId, setVendorId] = useState('f0000000-0000-0000-0000-000000000001');
  const [poNumber, setPoNumber] = useState('PO-OUT-2026-001');
  const [poAmount, setPoAmount] = useState(350);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const rRes = await fetchApi('/api/requests');
    if (rRes.success) setRequests(rRes.data || []);

    const dRes = await fetchApi('/api/due-list');
    if (dRes.success) setDueListData(dRes.data || {});

    const cRes = await fetchApi('/api/calibrations');
    if (cRes.success) setCalibrations(cRes.data || []);
  };

  const handlePerformCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !selectedItem) return;

    const payload = {
      requestId: selectedReq.id,
      requestItemId: selectedItem.id,
      calibrationDate,
      standardUsed,
      measurementResults: { points: [{ nominal: 10.0, actual: 10.001, error: 0.001 }] },
      resultStatus,
      calibrationFrequencyMonths,
      remarks: 'Calibrated per ISO 17025 standard procedure',
    };

    const res = await fetchApi('/api/calibrations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      alert(`Calibration completed! Certificate ${res.data?.certificateNumber} generated.`);
      setIsCalibModalOpen(false);
      loadData();
    } else {
      alert(res.error?.message || 'Calibration entry failed');
    }
  };

  const handleFaultySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchApi('/api/calibrations/faulty', {
      method: 'POST',
      body: JSON.stringify({
        requestId: selectedReq?.id,
        requestItemId: selectedItem?.id,
        action: 'REQUEST_SERVICE',
        serviceNotes,
      }),
    });

    if (res.success) {
      alert('Faulty item service workflow initiated. Linked to parent request!');
      setIsFaultyModalOpen(false);
      loadData();
    }
  };

  const handleOutsourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchApi('/api/calibrations/outsource', {
      method: 'POST',
      body: JSON.stringify({
        requestId: selectedReq?.id,
        requestItemId: selectedItem?.id,
        vendorId,
        poNumber,
        poAmount,
      }),
    });

    if (res.success) {
      alert('Outsource Purchase Order issued to vendor. Traceability maintained!');
      setIsOutsourceModalOpen(false);
      loadData();
    }
  };

  const pendingCalRequests = requests.filter((r) =>
    ['VERIFICATION', 'CALIBRATION', 'INVOICE_PO'].includes(r.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-sky-400" /> Calibration Operations & Certificate Queue
          </h2>
          <p className="text-xs text-slate-400">Perform instrument calibration, issue certificates, handle faulty items & vendor outsourcing.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'queue' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Calibration Queue
          </button>
          <button
            onClick={() => setActiveTab('dueList')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'dueList' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Calibration Due List ({dueListData.summary?.overdueCount || 0} Overdue)
          </button>
        </div>
      </div>

      {activeTab === 'queue' ? (
        <div className="space-y-4">
          <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Request</th>
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5">Item Description</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Technician Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {pendingCalRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-mono font-bold text-sky-400">{req.requestNumber}</td>
                    <td className="p-3.5 font-semibold text-slate-100">{req.clientName}</td>
                    <td className="p-3.5">
                      {req.items?.map((item) => (
                        <div key={item.id} className="text-xs">
                          <span className="font-semibold text-slate-200">{item.itemName}</span> (SN: <span className="font-mono text-slate-400">{item.serialNumber}</span>)
                        </div>
                      ))}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 text-xs bg-sky-950 text-sky-300 border border-sky-800/60 rounded-full font-medium">
                        {req.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {req.items?.map((item) => (
                        <div key={item.id} className="inline-flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setSelectedItem(item);
                              setIsCalibModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition"
                          >
                            Perform Calibration
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setSelectedItem(item);
                              setIsFaultyModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded font-medium transition"
                          >
                            Flag Faulty
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setSelectedItem(item);
                              setIsOutsourceModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs bg-orange-950 hover:bg-orange-900 text-orange-300 border border-orange-800 rounded font-medium transition"
                          >
                            Outsource
                          </button>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calibration Due List View */
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60">
              <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Overdue Calibration</p>
              <h3 className="text-2xl font-bold text-rose-200 mt-1">{dueListData.overdue?.length || 0} Instruments</h3>
            </div>
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Due in 30 Days</p>
              <h3 className="text-2xl font-bold text-amber-200 mt-1">{dueListData.dueSoon?.length || 0} Instruments</h3>
            </div>
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Calibrated</p>
              <h3 className="text-2xl font-bold text-emerald-200 mt-1">{dueListData.active?.length || 0} Instruments</h3>
            </div>
          </div>

          <div className="glass-card rounded-xl border border-slate-800 p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Calibration Certificate Records</h4>
            <div className="divide-y divide-slate-800/60">
              {calibrations.map((cal) => (
                <div key={cal.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-400 text-xs">{cal.certificateNumber}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded">
                        {cal.resultStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">Standard: {cal.standardUsed}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Calibrated: {cal.calibrationDate}</p>
                    <p className="text-xs text-amber-400 font-semibold">Next Due: {cal.nextDueDate}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Perform Calibration Modal */}
      <Modal isOpen={isCalibModalOpen} onClose={() => setIsCalibModalOpen(false)} title="Perform Calibration & Issue Certificate">
        <form onSubmit={handlePerformCalibration} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Master Standard Used *</label>
            <input
              required
              type="text"
              value={standardUsed}
              onChange={(e) => setStandardUsed(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Calibration Date *</label>
              <input
                required
                type="date"
                value={calibrationDate}
                onChange={(e) => setCalibrationDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Frequency (Months) *</label>
              <input
                required
                type="number"
                value={calibrationFrequencyMonths}
                onChange={(e) => setCalibrationFrequencyMonths(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Result Status *</label>
            <select
              value={resultStatus}
              onChange={(e: any) => setResultStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            >
              <option value="PASS">PASS (Within Tolerance)</option>
              <option value="FAIL">FAIL (Out of Tolerance)</option>
              <option value="FAULTY">FAULTY (Service Required)</option>
              <option value="OUTSOURCE">OUTSOURCE (Vendor PO Required)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsCalibModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg">
              Save Calibration & Generate Certificate
            </button>
          </div>
        </form>
      </Modal>

      {/* Flag Faulty Modal */}
      <Modal isOpen={isFaultyModalOpen} onClose={() => setIsFaultyModalOpen(false)} title="Faulty Item Exception Workflow">
        <form onSubmit={handleFaultySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Service & Overhaul Notes *</label>
            <textarea
              required
              rows={3}
              value={serviceNotes}
              onChange={(e) => setServiceNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsFaultyModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg">
              Submit Service Exception
            </button>
          </div>
        </form>
      </Modal>

      {/* Outsource Modal */}
      <Modal isOpen={isOutsourceModalOpen} onClose={() => setIsOutsourceModalOpen(false)} title="Vendor Outsourcing Purchase Order">
        <form onSubmit={handleOutsourceSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Outsource Vendor PO Number *</label>
            <input
              required
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">PO Estimated Amount ($) *</label>
            <input
              required
              type="number"
              value={poAmount}
              onChange={(e) => setPoAmount(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsOutsourceModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg">
              Issue Vendor PO & Outsource
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
