import React, { useEffect, useState } from 'react';
import { Building2, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { fetchApi } from '../api/client';
import { Client } from '../types';

export const ClientMaster: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientCode: '',
    clientName: '',
    address: '',
    billingAddress: '',
    gstTaxInfo: '',
    contactPerson: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const res = await fetchApi('/api/clients');
    if (res.success) setClients(res.data || []);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchApi('/api/clients', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    if (res.success) {
      setIsModalOpen(false);
      loadClients();
      setFormData({
        clientCode: '',
        clientName: '',
        address: '',
        billingAddress: '',
        gstTaxInfo: '',
        contactPerson: '',
        phone: '',
        email: '',
      });
    } else {
      alert(res.error?.message || 'Failed to create client');
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.clientName.toLowerCase().includes(search.toLowerCase()) ||
      c.clientCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-400" /> Client Master Directory
          </h2>
          <p className="text-xs text-slate-400">Manage client profiles, billing addresses, tax info, and contact details.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-sky-500/20 transition"
        >
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by client name or client code..."
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
              <th className="p-3.5">Client Name</th>
              <th className="p-3.5">Contact Person</th>
              <th className="p-3.5">Email & Phone</th>
              <th className="p-3.5">GST / Tax ID</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filtered.map((client) => (
              <tr key={client.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-sky-400">{client.clientCode}</td>
                <td className="p-3.5 font-semibold text-slate-100">{client.clientName}</td>
                <td className="p-3.5">{client.contactPerson}</td>
                <td className="p-3.5 text-slate-400">
                  <div>{client.email}</div>
                  <div className="text-[11px] text-slate-500">{client.phone}</div>
                </td>
                <td className="p-3.5 font-mono text-slate-400">{client.gstTaxInfo || 'N/A'}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded">
                    {client.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Client Record">
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Client Code *</label>
              <input
                required
                type="text"
                placeholder="CLI-1003"
                value={formData.clientCode}
                onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Client Name *</label>
              <input
                required
                type="text"
                placeholder="Apex Instruments Ltd"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
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

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Billing Address *</label>
            <textarea
              required
              rows={2}
              value={formData.billingAddress}
              onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
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
              <label className="block text-xs font-medium text-slate-300 mb-1">GST / Tax Info</label>
              <input
                type="text"
                value={formData.gstTaxInfo}
                onChange={(e) => setFormData({ ...formData, gstTaxInfo: e.target.value })}
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
              Save Client
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
