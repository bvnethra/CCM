import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const ReportsPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.id || 'all';

  const [reportType, setReportType] = useState('CALIBRATION_REQUEST_SUMMARY');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getReports(tenantId, reportType);
      setReportData(data);
    } catch (err) {
      console.error('Failed loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [tenantId, reportType]);

  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) {
      alert('No data available to export');
      return;
    }
    const keys = Object.keys(reportData[0]);
    const csvLines = [
      keys.join(','),
      ...reportData.map((row) => keys.map((k) => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(',')),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + csvLines.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Executive & Operations Reporting Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Server-side filtered reports across calibration requests, completions, service approvals, commercial invoices, and carrier dispatches.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Report
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCSV}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Report Selector Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Report Type</label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600"
        >
          <option value="CALIBRATION_REQUEST_SUMMARY">Calibration Request Summary Report</option>
          <option value="CALIBRATION_COMPLETION_SUMMARY">Calibration Completion Summary Report</option>
          <option value="FAULTY_ITEM_REPORT">Faulty & Non-Calibratable Instruments Report</option>
          <option value="SERVICE_REPORT">Service & Repair Approval Report</option>
          <option value="OUTSOURCING_REPORT">Vendor Outsourcing & Return Report</option>
          <option value="QUOTATION_REPORT">Quotation & Commercial Approval Report</option>
          <option value="INVOICE_REPORT">Client Invoice & Digital Signature Report</option>
          <option value="DISPATCH_REPORT">Dispatch & Carrier Tracking Report</option>
          <option value="DELIVERY_REPORT">Delivery Confirmation & Proof Report</option>
          <option value="DUE_CALIBRATION_REPORT">Due & Overdue Calibration Schedule Report</option>
        </select>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> Generating report data...
          </div>
        </div>
      ) : reportData.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
          <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">No records found for this report scope.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-semibold text-slate-500">
                <tr>
                  {Object.keys(reportData[0]).map((col) => (
                    <th key={col} className="px-4 py-3 capitalize">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    {Object.keys(row).map((col) => (
                      <td key={col} className="px-4 py-3">
                        {col === 'status' || col === 'priority' ? (
                          <Badge variant="info" size="sm">
                            {row[col]}
                          </Badge>
                        ) : (
                          String(row[col] || '-')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
