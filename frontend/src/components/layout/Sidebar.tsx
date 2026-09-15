import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Network,
  ScrollText,
  ShieldCheck,
  ChevronRight,
  Users,
  KeyRound,
  Briefcase,
  Factory,
  Package,
  ClipboardList,
  FlaskConical,
  FileCheck2,
  Award,
  Calendar,
  Wrench,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

export interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpen,
  onClose,
}) => {
  const { isSuperAdmin } = useAuth();
  const { activeTenant } = useTenant();

  const navigationSections = [
    {
      title: 'Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard Overview',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'TENANT & ACCESS',
      items: [
        {
          id: 'tenants',
          label: 'Tenants',
          icon: <Building2 className="w-4 h-4" />,
          badge: isSuperAdmin ? 'Global' : 'Single',
        },
        {
          id: 'organizations',
          label: 'Organizations',
          icon: <Network className="w-4 h-4" />,
        },
        {
          id: 'users',
          label: 'Users',
          icon: <Users className="w-4 h-4" />,
        },
        {
          id: 'roles',
          label: 'Roles & Permissions',
          icon: <KeyRound className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'MASTER DATA',
      items: [
        {
          id: 'clients',
          label: 'Clients',
          icon: <Briefcase className="w-4 h-4" />,
        },
        {
          id: 'vendors',
          label: 'Vendors',
          icon: <Factory className="w-4 h-4" />,
        },
        {
          id: 'items',
          label: 'Items',
          icon: <Package className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'calibration-requests',
          label: 'Calibration Requests',
          icon: <ClipboardList className="w-4 h-4" />,
        },
        {
          id: 'collection',
          label: 'Field Collection',
          icon: <Truck className="w-4 h-4" />,
        },
        {
          id: 'lab-queue',
          label: 'Lab Queue & Intake',
          icon: <FlaskConical className="w-4 h-4" />,
        },
        {
          id: 'lab-verification',
          label: 'Item Verification',
          icon: <FileCheck2 className="w-4 h-4" />,
        },
        {
          id: 'lab-calibration',
          label: 'Calibration Operations',
          icon: <Award className="w-4 h-4" />,
        },
        {
          id: 'calibration-due-list',
          label: 'Calibration Due List',
          icon: <Calendar className="w-4 h-4" />,
        },
        {
          id: 'service-requests',
          label: 'Service & Approvals',
          icon: <Wrench className="w-4 h-4" />,
        },
        {
          id: 'vendor-outsourcing',
          label: 'Vendor Outsourcing',
          icon: <Truck className="w-4 h-4" />,
        },
        {
          id: 'vendor-purchase-orders',
          label: 'Vendor POs',
          icon: <FileCheck2 className="w-4 h-4" />,
        },
        {
          id: 'quotations',
          label: 'Commercial Quotations',
          icon: <ScrollText className="w-4 h-4" />,
        },
        {
          id: 'invoices',
          label: 'Commercial Invoices',
          icon: <FileCheck2 className="w-4 h-4" />,
        },
        {
          id: 'dispatches',
          label: 'Dispatches & Delivery',
          icon: <Truck className="w-4 h-4" />,
        },
        {
          id: 'operations-exceptions',
          label: 'Action & Exception Center',
          icon: <Wrench className="w-4 h-4" />,
        },
        {
          id: 'reports',
          label: 'Executive Reports',
          icon: <ScrollText className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'Compliance',
      items: [
        {
          id: 'audit-logs',
          label: 'Audit Trail',
          icon: <ScrollText className="w-4 h-4" />,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              CCM Platform
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Commercial Metrology</p>
          </div>
        </div>

        {/* Current Active Tenant Card */}
        <div className="mx-4 my-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Active Tenant
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 truncate max-w-[150px]">
              {activeTenant ? activeTenant.name : 'No Tenant Selected'}
            </span>
            <span className="text-[10px] font-mono rounded bg-white px-1.5 py-0.5 text-blue-700 border border-slate-200 font-medium">
              {activeTenant?.code || 'N/A'}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-4 px-3 py-2 overflow-y-auto">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
              {section.items.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="rounded px-1.5 py-0.5 text-[10px] border font-medium bg-slate-100 text-slate-600 border-slate-200">
                        {item.badge}
                      </span>
                    ) : (
                      isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* RLS Multi-Tenant Security Card */}
        <div className="m-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>PostgreSQL RLS Active</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 leading-normal">
            Data boundary isolated at database level. Zero cross-tenant leakage.
          </p>
        </div>
      </aside>
    </>
  );
};
