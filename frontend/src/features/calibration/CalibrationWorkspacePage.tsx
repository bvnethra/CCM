import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import {
  Calibration,
  CalibrationMeasurement,
  Certificate,
  CalibrationResult,
  DocumentItem,
} from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Table, Column } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  FileText,
  Thermometer,
  Award,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';

interface CalibrationWorkspacePageProps {
  requestItemId: string;
  onBack: () => void;
}

export const CalibrationWorkspacePage: React.FC<CalibrationWorkspacePageProps> = ({ requestItemId, onBack }) => {
  const { activeTenant } = useTenant();

  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [measurements, setMeasurements] = useState<CalibrationMeasurement[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Measurement Form State
  const [measPoint, setMeasPoint] = useState('');
  const [measNominal, setMeasNominal] = useState<string>('');
  const [measObserved, setMeasObserved] = useState<string>('');
  const [measUnit, setMeasUnit] = useState('bar');
  const [measTolMin, setMeasTolMin] = useState<string>('');
  const [measTolMax, setMeasTolMax] = useState<string>('');
  const [measRemarks, setMeasRemarks] = useState('');
  const [addingMeas, setAddingMeas] = useState(false);

  // Completion Form Modal State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [finalResult, setFinalResult] = useState<CalibrationResult>('PASS');
  const [calMethod, setCalMethod] = useState('Standard Direct Comparison Metrology (ISO 17025 compliant)');
  const [envCond, setEnvCond] = useState('Temperature: 23.0°C ± 0.5°C, Humidity: 48% RH');
  const [calRemarks, setCalRemarks] = useState('');
  const [freqOverride, setFreqOverride] = useState<string>('');
  const [freqUnitOverride, setFreqUnitOverride] = useState<'MONTHS' | 'YEARS' | 'DAYS'>('MONTHS');
  const [overrideReason, setOverrideReason] = useState('');
  const [completing, setCompleting] = useState(false);

  // Certificate Modal State
  const [generatingCert, setGeneratingCert] = useState(false);

  const fetchWorkspace = async () => {
    if (!activeTenant || !requestItemId) return;
    setLoading(true);
    try {
      const data = await api.getCalibrationWorkspace(requestItemId, activeTenant.id);
      setWorkspaceData(data);
      setCalibration(data.calibration);
      setMeasurements(data.measurements || []);
      setCertificates(data.certificates || []);
      setDocuments(data.documents || []);

      if (data.calibration) {
        setCalMethod(data.calibration.calibration_method || calMethod);
        setEnvCond(data.calibration.environmental_conditions || envCond);
        setFinalResult(data.calibration.result || 'PASS');
      }
    } catch (err: any) {
      console.error('Failed to load calibration workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [activeTenant, requestItemId]);

  // Handle Add Measurement Point
  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !calibration) return;

    if (!measPoint.trim()) {
      alert('Measurement point name is required.');
      return;
    }

    setAddingMeas(true);
    try {
      const newMeas = await api.addMeasurementPoint(activeTenant.id, calibration.id, {
        measurement_point: measPoint.trim(),
        nominal_value: measNominal !== '' ? parseFloat(measNominal) : null,
        observed_value: measObserved !== '' ? parseFloat(measObserved) : null,
        unit: measUnit,
        tolerance_min: measTolMin !== '' ? parseFloat(measTolMin) : null,
        tolerance_max: measTolMax !== '' ? parseFloat(measTolMax) : null,
        remarks: measRemarks.trim() || null,
      });

      setMeasurements([...measurements, newMeas]);
      setMeasPoint('');
      setMeasNominal('');
      setMeasObserved('');
      setMeasTolMin('');
      setMeasTolMax('');
      setMeasRemarks('');
    } catch (err: any) {
      alert(err.message || 'Failed to add measurement point');
    } finally {
      setAddingMeas(false);
    }
  };

  // Handle Delete Measurement Point
  const handleDeleteMeasurement = async (measurementId: string) => {
    if (!activeTenant || !calibration) return;
    if (!confirm('Are you sure you want to delete this measurement point?')) return;

    try {
      await api.deleteMeasurementPoint(activeTenant.id, calibration.id, measurementId);
      setMeasurements(measurements.filter((m) => m.id !== measurementId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete measurement point');
    }
  };

  // Handle Calibration Completion Submit
  const handleCompleteCalibrationSubmit = async () => {
    if (!activeTenant || !calibration) return;

    if (measurements.length === 0 && finalResult === 'PASS') {
      alert('At least one measurement test point must be recorded before completing a PASS calibration.');
      return;
    }

    if (freqOverride && !overrideReason.trim()) {
      alert('Override reason is required when overriding calibration frequency.');
      return;
    }

    setCompleting(true);
    try {
      const updatedCal = await api.completeCalibration(activeTenant.id, calibration.id, {
        result: finalResult,
        calibration_method: calMethod,
        environmental_conditions: envCond,
        remarks: calRemarks,
        calibration_frequency_override: freqOverride ? parseInt(freqOverride, 10) : null,
        calibration_frequency_unit_override: freqOverride ? freqUnitOverride : null,
        override_reason: overrideReason || null,
      });

      setCalibration(updatedCal);
      setIsCompleteModalOpen(false);
      alert(`Calibration successfully completed as ${finalResult}. Next Due Date: ${updatedCal.next_due_date}`);
      fetchWorkspace();
    } catch (err: any) {
      alert(err.message || 'Failed to complete calibration');
    } finally {
      setCompleting(false);
    }
  };

  // Handle Generate Certificate
  const handleGenerateCertificate = async () => {
    if (!activeTenant || !calibration) return;

    setGeneratingCert(true);
    try {
      const res = await api.generateCertificate(activeTenant.id, calibration.id);
      setCertificates([res.certificate, ...certificates]);
      alert(`Certificate ${res.certificate.certificate_number} generated successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate certificate');
    } finally {
      setGeneratingCert(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        Loading Calibration Metrology Workspace...
      </div>
    );
  }

  if (!workspaceData || !workspaceData.request_item) {
    return (
      <div className="py-16 text-center text-slate-500">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="font-semibold text-slate-700">Request Item Not Found</p>
        <Button onClick={onBack} className="mt-4">
          Back to Calibration Queue
        </Button>
      </div>
    );
  }

  const { request_item, verification } = workspaceData;
  const item = request_item.item || {};
  const request = request_item.request || {};
  const client = request.client || {};

  // Real-time calculated error in measurement form preview
  const calcFormError = (measNominal !== '' && measObserved !== '')
    ? (parseFloat(measObserved) - parseFloat(measNominal)).toFixed(4)
    : null;

  const measColumns: Column<CalibrationMeasurement>[] = [
    {
      header: 'Measurement Point',
      render: (m) => <span className="font-sans font-medium text-slate-900">{m.measurement_point}</span>,
    },
    {
      header: 'Nominal',
      headerClassName: 'text-right',
      className: 'text-right font-mono text-slate-700',
      render: (m) => m.nominal_value ?? '—',
    },
    {
      header: 'Observed',
      headerClassName: 'text-right',
      className: 'text-right font-mono font-bold text-slate-900',
      render: (m) => m.observed_value ?? '—',
    },
    {
      header: 'Unit',
      className: 'font-sans text-xs text-slate-500',
      render: (m) => m.unit || '—',
    },
    {
      header: 'Tol Min / Max',
      headerClassName: 'text-right',
      className: 'text-right text-xs text-slate-500 font-mono',
      render: (m) => `${m.tolerance_min ?? '—'} to ${m.tolerance_max ?? '—'}`,
    },
    {
      header: 'Calculated Error',
      headerClassName: 'text-right',
      className: 'text-right font-mono font-bold text-blue-700',
      render: (m) =>
        m.error_value !== null && m.error_value !== undefined
          ? m.error_value > 0 ? `+${m.error_value}` : m.error_value
          : '—',
    },
    {
      header: 'Result',
      render: (m) =>
        m.measurement_result === 'PASS' ? (
          <Badge variant="success">PASS</Badge>
        ) : m.measurement_result === 'FAIL' ? (
          <Badge variant="destructive">FAIL</Badge>
        ) : (
          <Badge variant="default">NOT TESTED</Badge>
        ),
    },
    {
      header: 'Action',
      headerClassName: 'text-right',
      className: 'text-right font-sans',
      render: (m) =>
        calibration?.status === 'IN_PROGRESS' ? (
          <button
            onClick={() => handleDeleteMeasurement(m.id)}
            className="text-slate-400 hover:text-red-600 transition-colors p-1"
            title="Delete Measurement Point"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Calibration Queue
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Calibration Workspace: {item.item_name || 'Instrument'}
            </h1>
            {calibration && (
              <Badge
                variant={
                  calibration.status === 'COMPLETED'
                    ? 'success'
                    : calibration.status === 'IN_PROGRESS'
                    ? 'info'
                    : 'warning'
                }
              >
                {calibration.status}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Request Number: <span className="font-mono text-slate-700 font-semibold">{request.request_number}</span> | Client: <span className="font-semibold text-slate-700">{client.client_name}</span>
          </p>
        </div>

        {/* Top Header Action Buttons */}
        <div className="flex items-center gap-3">
          {calibration && calibration.status === 'IN_PROGRESS' && (
            <Button
              variant="primary"
              onClick={() => setIsCompleteModalOpen(true)}
              className="gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalize & Complete Calibration
            </Button>
          )}

          {calibration && (calibration.status === 'COMPLETED' || calibration.status === 'FAILED') && (
            <Button
              variant="primary"
              onClick={handleGenerateCertificate}
              disabled={generatingCert}
              className="gap-2"
            >
              <Award className="w-4 h-4" />
              {generatingCert ? 'Generating...' : certificates.length > 0 ? 'Regenerate Certificate' : 'Generate Certificate'}
            </Button>
          )}
        </div>
      </div>

      {/* Grid Layout: Summary Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* REQUEST DETAILS */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Request Context</h3>
          </div>
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Request Number:</span>
              <span className="font-mono font-medium text-slate-900">{request.request_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Client Code:</span>
              <span className="font-medium text-slate-800">{client.client_code || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Client Name:</span>
              <span className="font-semibold text-slate-900">{client.client_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Priority:</span>
              <span className="font-medium text-slate-900">{request.priority}</span>
            </div>
          </div>
        </Card>

        {/* INSTRUMENT MASTER SPECS */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Instrument Master Specs</h3>
          </div>
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Item Code:</span>
              <span className="font-mono font-bold text-slate-900">{item.item_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Serial Number:</span>
              <span className="font-mono text-slate-800">{item.serial_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Make / Model:</span>
              <span className="text-slate-800">{item.manufacturer || 'N/A'} / {item.model || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Range / Least Count:</span>
              <span className="text-slate-800">{item.measurement_range || 'N/A'} (LC: {item.least_count || 'N/A'})</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
              <span className="text-slate-500 font-medium">Std Frequency:</span>
              <span className="font-bold text-blue-700">{item.calibration_frequency || 12} {item.calibration_frequency_unit || 'MONTHS'}</span>
            </div>
          </div>
        </Card>

        {/* VERIFICATION STATE */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Intake Verification</h3>
            </div>
            <Badge variant="success">VERIFIED</Badge>
          </div>
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Verified By:</span>
              <span className="font-medium text-slate-800">{verification?.verified_by_user?.full_name || 'Lab Intake Agent'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Verified At:</span>
              <span className="text-slate-700">{verification?.verified_at ? new Date(verification.verified_at).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Received Condition:</span>
              <span className="font-semibold text-emerald-700">{verification?.condition_status || 'GOOD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mandatory Proof Docs:</span>
              <span className="font-medium text-slate-800">{documents.length} File(s) Attached</span>
            </div>
          </div>
        </Card>
      </div>

      {/* CALIBRATION PARAMETERS CARD */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Thermometer className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">Calibration Method & Environmental Conditions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Calibration Procedure / Method</label>
            <Input
              value={calMethod}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCalMethod(e.target.value)}
              disabled={calibration?.status === 'COMPLETED'}
              placeholder="e.g. Standard Direct Comparison Metrology (ISO 17025)"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ambient Environmental Conditions</label>
            <Input
              value={envCond}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnvCond(e.target.value)}
              disabled={calibration?.status === 'COMPLETED'}
              placeholder="e.g. Temperature: 23.0°C ± 0.5°C, Humidity: 48% RH"
            />
          </div>
        </div>
      </Card>

      {/* MEASUREMENT POINTS SECTION */}
      <Card className="space-y-4">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Measurement & Test Point Log</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Record nominal values, observed values, units, and tolerance bounds. Errors ($Observed - Nominal$) are computed automatically.
            </p>
          </div>
          <Badge variant="default">{measurements.length} Test Points</Badge>
        </div>

        {/* Add New Measurement Form (Only if IN_PROGRESS) */}
        {calibration && calibration.status === 'IN_PROGRESS' && (
          <form onSubmit={handleAddMeasurement} className="p-4 mx-5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Add Measurement Point
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 items-end">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Point Name *</label>
                <Input
                  placeholder="e.g. 5.0 bar / 50% Range"
                  value={measPoint}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeasPoint(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nominal</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="5.0"
                  value={measNominal}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeasNominal(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Observed</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="5.02"
                  value={measObserved}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeasObserved(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
                <Input
                  placeholder="bar"
                  value={measUnit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeasUnit(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tol Min</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="4.90"
                  value={measTolMin}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeasTolMin(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tol Max</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="5.10"
                  value={measTolMax}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeasTolMax(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
              <div className="text-xs text-slate-500 font-mono">
                {calcFormError !== null ? (
                  <span>Computed Error: <strong className="text-blue-700">{parseFloat(calcFormError) > 0 ? `+${calcFormError}` : calcFormError} {measUnit}</strong></span>
                ) : (
                  <span>Enter nominal and observed values to preview error.</span>
                )}
              </div>
              <Button type="submit" size="sm" variant="primary" disabled={addingMeas} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                {addingMeas ? 'Adding...' : 'Add Point'}
              </Button>
            </div>
          </form>
        )}

        {/* Measurements Table */}
        <Table<CalibrationMeasurement>
          columns={measColumns}
          data={measurements}
          keyExtractor={(m) => m.id}
          emptyMessage="No measurement test points recorded yet. Add test points above."
        />
      </Card>

      {/* CERTIFICATES SECTION */}
      {certificates.length > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">Generated Calibration Certificates</h2>
            </div>
            <Badge variant="success">{certificates.length} Certificate Version(s)</Badge>
          </div>

          <div className="space-y-3">
            {certificates.map((cert) => (
              <div key={cert.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{cert.certificate_number}</span>
                    <Badge variant="info">v{cert.version}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generated on {new Date(cert.generated_at).toLocaleString()} by {cert.generated_by_user?.full_name || 'Metrology Specialist'}
                  </p>
                </div>

                <a
                  href={`https://storage.ccm.internal/download/${encodeURIComponent(cert.storage_reference)}?sig=mock-presigned-token`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* COMPLETION MODAL */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title="Finalize & Complete Calibration"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Review test measurements and confirm calibration status. Completing will calculate the Next Due Date and make certificate generation available.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Calibration Final Result *</label>
            <Select
              value={finalResult}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFinalResult(e.target.value as CalibrationResult)}
            >
              <option value="PASS">PASS (Normal Successful Calibration)</option>
              <option value="FAIL">FAIL (Non-conforming Test Result)</option>
              <option value="ADJUSTED">ADJUSTED (Instrument Adjusted & Calibrated)</option>
              <option value="NOT_CALIBRATABLE">NOT CALIBRATABLE (Instrument Faulty)</option>
              <option value="OUTSOURCE">OUTSOURCE (Send for External Vendor Calibration)</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Calibration Remarks</label>
            <textarea
              rows={2}
              className="w-full border border-slate-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g. All test points verified within ANSI/NCSL standards."
              value={calRemarks}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCalRemarks(e.target.value)}
            />
          </div>

          {/* Frequency Override Section */}
          <div className="p-3 bg-amber-50 rounded-md border border-amber-200 space-y-2">
            <h5 className="text-xs font-bold text-amber-800 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              Calibration Frequency Override (Optional)
            </h5>
            <p className="text-xs text-amber-700">
              Standard Item Frequency: <strong>{item.calibration_frequency || 12} {item.calibration_frequency_unit || 'MONTHS'}</strong>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600">Override Interval</label>
                <Input
                  type="number"
                  placeholder="e.g. 6"
                  value={freqOverride}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFreqOverride(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600">Unit</label>
                <Select
                  value={freqUnitOverride}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFreqUnitOverride(e.target.value as any)}
                >
                  <option value="MONTHS">MONTHS</option>
                  <option value="YEARS">YEARS</option>
                  <option value="DAYS">DAYS</option>
                </Select>
              </div>
            </div>

            {freqOverride && (
              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">Override Reason *</label>
                <Input
                  placeholder="e.g. High precision cleanroom use interval override"
                  value={overrideReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOverrideReason(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => setIsCompleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCompleteCalibrationSubmit}
              disabled={completing}
            >
              {completing ? 'Completing...' : 'Confirm & Complete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CalibrationWorkspacePage;
