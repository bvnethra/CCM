import React, { useEffect, useState } from 'react';
import { Users, Plus, Search } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { fetchApi } from '../api/client';
import { Vendor } from '../types';

export const VendorMaster: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vendorCode: '',
    vendorName: '',
    address: '',
    gstTaxInfo: '',
    contactPerson: '',
    phone: '',
    email: '',
    servicedCategories: '',
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    const res = await fetchApi('/api/vendors');
    if (res.success) setVendors(res.data || []);
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const categories = formData.servicedCategories.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await fetchApi('/api/vendors', {
      method: 'POST',
      body: JSON.stringify({ ...formData, servicedCategories: categories }),
    });
    if (res.success) {
      setIsModalOpen(false);
      loadVendors();
      setFormData({
        vendorCode: '',
        vendorName: '',
        address: '',
        gstTaxInfo: '',
        contactPerson: '',
        phone: '',
        email: '',
        servicedCategories: '',
      });
    } else {
      alert(res.error?.message || 'Failed to create vendor');
    }
  };

  const filtered = vendors.filter(
    (v) =>
      v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      v.vendorCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" /> Vendor Master Directory
          </h2>
          <p className="text-xs text-slate-400">Manage external calibration vendors and outsourcing partners.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-sky-500/20 transition"
        >
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by vendor name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">Code</th>
              <th className="p-3.5">Vendor Name</th>
              <th className="p-3.5">Serviced Categories</th>
              <th className="p-3.5">Contact Person</th>
              <th className="p-3.5">Email & Phone</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filtered.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-sky-400">{vendor.vendorCode}</td>
                <td className="p-3.5 font-semibold text-slate-100">{vendor.vendorName}</td>
                <td className="p-3.5">
                  <div className="flex flex-wrap gap-1">
                    {vendor.servicedCategories?.map((cat, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] bg-slate-800 text-sky-300 rounded border border-slate-700">
                        {cat}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3.5">{vendor.contactPerson}</td>
                <td className="p-3.5 text-slate-400">
                  <div>{vendor.email}</div>
                  <div className="text-[11px] text-slate-500">{vendor.phone}</div>
                </td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded">
                    {vendor.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Vendor Record">
        <form onSubmit={handleCreateVendor} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Vendor Code *</label>
              <input
                required
                type="text"
                placeholder="VEN-2003"
                value={formData.vendorCode}
                onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Vendor Name *</label>
              <input
                required
                type="text"
                placeholder="Precision High Temp Calibration"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Address *</label>
            <textarea
              required
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contact Person *</label>
              <input
                required
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
              <input
                required
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Serviced Categories (Comma Separated)</label>
              <input
                type="text"
                placeholder="High Voltage, Laser, Thermal"
                value={formData.servicedCategories}
                onChange={(e) => setFormData({ ...formData, servicedCategories: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg"
            >
              Save Vendor
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
