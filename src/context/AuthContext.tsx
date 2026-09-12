import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { fetchApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeTenantId: string;
  login: (email?: string, tenantId?: string) => Promise<boolean>;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  hasPermission: (perm: string) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>({
    id: 'd0000000-0000-0000-0000-000000000001',
    email: 'admin@alphametrology.com',
    fullName: 'System Admin',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    tenantName: 'Alpha Metrology Solutions Ltd.',
    organizationId: 'b0000000-0000-0000-0000-000000000001',
    subOrgId: 'c0000000-0000-0000-0000-000000000001',
    roles: ['Super Admin', 'Tenant Admin'],
    permissions: [
      'client.view', 'client.create', 'client.update', 'client.delete',
      'vendor.view', 'vendor.create', 'vendor.update',
      'item.view', 'item.create',
      'request.create', 'request.view', 'request.update', 'request.verify',
      'calibration.create', 'calibration.update',
      'quotation.create', 'quotation.approve',
      'invoice.create', 'invoice.view',
      'dispatch.create', 'delivery.confirm', 'signature.capture', 'audit.view'
    ],
  });
  const [token, setToken] = useState<string | null>('dev-token');
  const [activeTenantId, setActiveTenantId] = useState<string>('a0000000-0000-0000-0000-000000000001');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const login = async (email: string = 'admin@alphametrology.com', tenantId: string = 'a0000000-0000-0000-0000-000000000001') => {
    setIsLoading(true);
    const res = await fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, tenantId }),
    });

    if (res.success && res.data) {
      setToken(res.data.token);
      setUser(res.data.user);
      setActiveTenantId(tenantId);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('tenantId', tenantId);
      setIsLoading(false);
      return true;
    }
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const switchTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
    localStorage.setItem('tenantId', tenantId);
    if (user) {
      setUser({
        ...user,
        tenantId,
        tenantName: tenantId === 'a0000000-0000-0000-0000-000000000001' ? 'Alpha Metrology Solutions Ltd.' : 'Beta Precision Calibrations Inc.',
      });
    }
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.roles.includes('Super Admin') || user.roles.includes('Tenant Admin')) return true;
    return user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, token, activeTenantId, login, logout, switchTenant, hasPermission, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
