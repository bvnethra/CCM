import React from 'react';
import { Building, Shield, Users, Lock, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const TenantsPage: React.FC = () => {
  const { user } = useAuth();

  const mockOrgs = [
    { id: 'b0000000-0000-0000-0000-000000000001', code: 'ORG-HQ-01', name: 'Alpha Industrial Calibration HQ', subOrgs: 2 },
    { id: 'b0000000-0000-0000-0000-000000000002', code: 'ORG-WEST-02', name: 'Alpha West Coast Testing Lab', subOrgs: 1 },
  ];

  const mockUsers = [
    { email: 'admin@alphametrology.com', name: 'System Admin', role: 'Super Admin / Tenant Admin' },
    { email: 'agent.smith@alphametrology.com', name: 'Agent Smith', role: 'Collection Agent' },
    { email: 'tech.john@alphametrology.com', name: 'John Doe', role: 'Calibration Technician' },
    { email: 'comm.jane@alphametrology.com', name: 'Jane Commercial', role: 'Commercial User' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building className="w-5 h-5 text-sky-400" /> Multi-Tenant & RBAC Security Hierarchy
          </h2>
          <p className="text-xs text-slate-400">
            Tenant → Organization → Sub-Organization hierarchy with server-side RBAC and database RLS isolation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organizations & Sub-Organizations */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Building className="w-4 h-4 text-sky-400" /> Tenant Organizations & Sub-Organizations
          </h3>

          <div className="divide-y divide-slate-800">
            {mockOrgs.map((org) => (
              <div key={org.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-sky-400 font-mono">{org.code}</p>
                  <p className="text-sm font-medium text-slate-200">{org.name}</p>
                </div>
                <span className="px-2.5 py-1 text-xs bg-slate-800 text-slate-300 rounded border border-slate-700">
                  {org.subOrgs} Sub-Orgs
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Users & Configurable RBAC Roles */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" /> Tenant Users & Assigned Roles
          </h3>

          <div className="divide-y divide-slate-800">
            {mockUsers.map((u, i) => (
              <div key={i} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">{u.name}</p>
                  <p className="text-[11px] text-slate-400">{u.email}</p>
                </div>
                <span className="px-2.5 py-1 text-xs bg-sky-950 text-sky-300 border border-sky-800/60 rounded-full font-medium">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Permissions Matrix Overview */}
      <div className="glass-card p-5 rounded-xl border border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" /> Granular Permission Definitions
        </h3>
        <p className="text-xs text-slate-400">
          Security is validated server-side by the Cloudflare Worker API. UI components hide actions dynamically based on active user context.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {[
            'client.view', 'client.create', 'client.update', 'client.delete',
            'vendor.view', 'vendor.create', 'vendor.update',
            'item.view', 'item.create', 'request.create', 'request.view', 'request.update',
            'request.verify', 'calibration.create', 'calibration.update', 'quotation.create',
            'quotation.approve', 'invoice.create', 'invoice.view', 'dispatch.create',
            'delivery.confirm', 'signature.capture', 'audit.view'
          ].map((perm) => (
            <span key={perm} className="px-2.5 py-1 text-[11px] font-mono bg-slate-900 border border-slate-800 text-sky-300 rounded">
              {perm}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
