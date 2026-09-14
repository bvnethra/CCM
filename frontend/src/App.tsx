import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { TenantManagementPage } from './features/tenants/TenantManagementPage';
import { OrganizationManagementPage } from './features/organizations/OrganizationManagementPage';
import { SubOrganizationManagementPage } from './features/sub-organizations/SubOrganizationManagementPage';
import { UserManagementPage } from './features/users/UserManagementPage';
import { RolesPermissionsPage } from './features/roles/RolesPermissionsPage';
import { ClientManagementPage } from './features/clients/ClientManagementPage';
import { VendorManagementPage } from './features/vendors/VendorManagementPage';
import { ItemManagementPage } from './features/items/ItemManagementPage';
import { CalibrationRequestListPage } from './features/requests/CalibrationRequestListPage';
import { AuditLogViewer } from './features/audit/AuditLogViewer';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setCurrentView('dashboard')} />;
  }

  return (
    <TenantProvider>
      <DashboardLayout
        currentView={currentView}
        onNavigate={setCurrentView}
        onNavigateToLogin={() => setCurrentView('login')}
      >
        {currentView === 'dashboard' && <DashboardOverview onNavigate={setCurrentView} />}
        {currentView === 'calibration-requests' && <CalibrationRequestListPage />}
        {currentView === 'clients' && <ClientManagementPage />}
        {currentView === 'vendors' && <VendorManagementPage />}
        {currentView === 'items' && <ItemManagementPage />}
        {currentView === 'tenants' && <TenantManagementPage />}
        {currentView === 'organizations' && <OrganizationManagementPage />}
        {currentView === 'sub-organizations' && <SubOrganizationManagementPage />}
        {currentView === 'users' && <UserManagementPage />}
        {currentView === 'roles' && <RolesPermissionsPage />}
        {currentView === 'audit-logs' && <AuditLogViewer />}
      </DashboardLayout>
    </TenantProvider>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
