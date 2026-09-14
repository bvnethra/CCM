import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tenant, Organization, SubOrganization } from '../types';
import { apiClient } from '../lib/api';
import { useAuth } from './AuthContext';
import { initialTenants } from '../lib/mockData';

interface TenantContextType {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  activeOrganization: Organization | null;
  organizations: Organization[];
  subOrganizations: SubOrganization[];
  isLoading: boolean;
  error: string | null;
  setActiveTenantId: (tenantId: string) => void;
  setActiveOrganizationId: (orgId: string | null) => void;
  refreshData: () => Promise<void>;
  isLockedToUserTenant: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [subOrganizations, setSubOrganizations] = useState<SubOrganization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load Tenants & scope based on role
  const loadData = useCallback(async () => {
    if (!currentUser) {
      setTenants([]);
      setActiveTenant(null);
      setOrganizations([]);
      setSubOrganizations([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const rawTenants = await apiClient.getTenants(currentUser.role, currentUser.tenant_id);
      const tenantList = rawTenants && rawTenants.length > 0 ? rawTenants : initialTenants;
      setTenants(tenantList);

      // Determine active tenant:
      // If user is locked to a specific tenant (tenant_admin or below), they MUST be in their own tenant
      let currentActive: Tenant | null = null;
      if (!isSuperAdmin) {
        currentActive = tenantList.find((t) => t.id === currentUser.tenant_id) || tenantList[0] || initialTenants[0];
      } else {
        // Super admin can maintain selection from state or pick first
        currentActive = (activeTenant && tenantList.find((t) => t.id === activeTenant.id)) || tenantList[0] || initialTenants[0];
      }
      setActiveTenant(currentActive);

      if (currentActive) {
        // Load organizations for active tenant
        const orgList = await apiClient.getOrganizations(currentActive.id);
        setOrganizations(orgList);

        // Load sub-organizations for active tenant
        const subList = await apiClient.getSubOrganizations(currentActive.id);
        setSubOrganizations(subList);

        // Auto-select org if user has assigned org
        if (currentUser.organization_id) {
          const matchedOrg = orgList.find((o) => o.id === currentUser.organization_id);
          setActiveOrganization(matchedOrg || null);
        } else {
          setActiveOrganization((prev) => (prev && orgList.find((o) => o.id === prev.id)) || null);
        }
      } else {
        setOrganizations([]);
        setSubOrganizations([]);
        setActiveOrganization(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant data');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isSuperAdmin, activeTenant?.id]);

  useEffect(() => {
    loadData();
    // Subscribe to in-memory changes
    const unsubscribe = apiClient.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role, currentUser?.tenant_id]);

  // When active tenant changes manually
  const setActiveTenantId = async (tenantId: string) => {
    if (!isSuperAdmin && currentUser?.tenant_id !== tenantId) {
      setError('Security Violation: You are not authorized to switch to this tenant.');
      return;
    }

    const found = tenants.find((t) => t.id === tenantId);
    if (found) {
      setActiveTenant(found);
      setIsLoading(true);
      try {
        const [orgs, subs] = await Promise.all([
          apiClient.getOrganizations(found.id),
          apiClient.getSubOrganizations(found.id),
        ]);
        setOrganizations(orgs);
        setSubOrganizations(subs);
        setActiveOrganization(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const setActiveOrganizationId = (orgId: string | null) => {
    if (!orgId) {
      setActiveOrganization(null);
    } else {
      const found = organizations.find((o) => o.id === orgId);
      setActiveOrganization(found || null);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenant,
        activeOrganization,
        organizations,
        subOrganizations,
        isLoading,
        error,
        setActiveTenantId,
        setActiveOrganizationId,
        refreshData: loadData,
        isLockedToUserTenant: !isSuperAdmin,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
