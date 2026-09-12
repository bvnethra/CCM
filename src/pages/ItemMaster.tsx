import React, { useEffect, useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { Modal } from '../components/Common/Modal';
import { fetchApi } from '../api/client';
import { ItemMaster as ItemMasterType } from '../types';

export const ItemMaster: React.FC = () => {
  const [items, setItems] = useState<ItemMasterType[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    itemCode: '',
    itemName: '',
    itemType: 'Dimensional',
    manufacturer: '',
    model: '',
    serialNumber: '',
    measurementRange: '',
    leastCount: '',
    standardCost: 150,
    calibrationFrequencyMonths: 12,
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const res = await fetchApi('/api/items');
    if (res.success) setItems(res.data || []);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchApi('/api/items', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    if (res.success) {
      setIsModalOpen(false);
      loadItems();
      setFormData({
        itemCode: '',
        itemName: '',
        itemType: 'Dimensional',
        manufacturer: '',
        model: '',
        serialNumber: '',
        measurementRange: '',
        leastCount: '',
        standardCost: 150,
        calibrationFrequencyMonths: 12,
      });
    } else {
      alert(res.error?.message || 'Failed to create item');
    }
  };

  const filtered = items.filter(
    (i) =>
      i.itemName.toLowerCase().includes(search.toLowerCase()) ||
      i.itemCode.toLowerCase().includes(search.toLowerCase()) ||
      i.serialNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-400" /> Equipment & Instrument Master
          </h2>
          <p className="text-xs text-slate-400">Master equipment database with measurement ranges, serial numbers & calibration frequency.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-sky-500/20 transition"
        >
          <Plus className="w-4 h-4" /> Add Instrument Master
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by code, item name, or serial number..."
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
              <th className="p-3.5">Instrument Name</th>
              <th className="p-3.5">Type & Make</th>
              <th className="p-3.5">Serial Number</th>
              <th className="p-3.5">Range / Least Count</th>
              <th className="p-3.5">Std Cost</th>
              <th className="p-3.5">Freq</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3.5 font-mono font-bold text-sky-400">{item.itemCode}</td>
                <td className="p-3.5 font-semibold text-slate-100">{item.itemName}</td>
                <td className="p-3.5">
                  <div className="text-slate-200">{item.itemType}</div>
                  <div className="text-[11px] text-slate-500">{item.manufacturer} - {item.model}</div>
                </td>
                <td className="p-3.5 font-mono text-slate-300">{item.serialNumber}</td>
                <td className="p-3.5 text-slate-400">
                  <div>{item.measurementRange}</div>
                  <div className="text-[11px] text-slate-500">LC: {item.leastCount}</div>
                </td>
                <td className="p-3.5 font-mono font-semibold text-emerald-400">${item.standardCost.toFixed(2)}</td>
                <td className="p-3.5 text-slate-300 font-medium">{item.calibrationFrequencyMonths}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Item Master">
        <form onSubmit={handleCreateItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Item Code *</label>
              <input
                required
                type="text"
                placeholder="ITM-004"
                value={formData.itemCode}
                onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Item Name *</label>
              <input
                required
                type="text"
                placeholder="Digital Pressure Gauge 10 Bar"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Item Type *</label>
              <select
                value={formData.itemType}
                onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              >
                <option value="Dimensional">Dimensional</option>
                <option value="Electrical">Electrical</option>
                <option value="Pressure">Pressure</option>
                <option value="Thermal">Thermal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Manufacturer *</label>
              <input
                required
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Model *</label>
              <input
                required
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Serial Number *</label>
              <input
                required
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Measurement Range</label>
              <input
                type="text"
                placeholder="0 - 100 mm"
                value={formData.measurementRange}
                onChange={(e) => setFormData({ ...formData, measurementRange: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Least Count</label>
              <input
                type="text"
                placeholder="0.01 mm"
                value={formData.leastCount}
                onChange={(e) => setFormData({ ...formData, leastCount: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Standard Calibration Cost ($) *</label>
              <input
                required
                type="number"
                value={formData.standardCost}
                onChange={(e) => setFormData({ ...formData, standardCost: parseFloat(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Frequency (Months) *</label>
              <input
                required
                type="number"
                value={formData.calibrationFrequencyMonths}
                onChange={(e) => setFormData({ ...formData, calibrationFrequencyMonths: parseInt(e.target.value) })}
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
              Save Item Master
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
