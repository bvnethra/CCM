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
import { LabQueuePage } from './features/lab/LabQueuePage';
import { LabRequestIntakePage } from './features/lab/LabRequestIntakePage';
import { VerificationQueuePage } from './features/verification/VerificationQueuePage';
import { RequestVerificationPage } from './features/verification/RequestVerificationPage';
import { AuditLogViewer } from './features/audit/AuditLogViewer';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedLabRequestId, setSelectedLabRequestId] = useState<string | null>(null);
  const [selectedVerificationRequestId, setSelectedVerificationRequestId] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setCurrentView('dashboard')} />;
  }

  return (
    <TenantProvider>
      <DashboardLayout
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          if (view !== 'lab-intake') {
            setSelectedLabRequestId(null);
          }
          if (view !== 'lab-verification-detail') {
            setSelectedVerificationRequestId(null);
          }
        }}
        onNavigateToLogin={() => setCurrentView('login')}
      >
        {currentView === 'dashboard' && <DashboardOverview onNavigate={setCurrentView} />}
        {currentView === 'calibration-requests' && (
          <CalibrationRequestListPage
            onOpenLabQueue={() => setCurrentView('lab-queue')}
            onOpenLabIntake={(reqId) => {
              setSelectedLabRequestId(reqId);
              setCurrentView('lab-intake');
            }}
          />
        )}
        {currentView === 'lab-queue' && (
          <LabQueuePage
            onOpenIntake={(reqId) => {
              setSelectedLabRequestId(reqId);
              setCurrentView('lab-intake');
            }}
            onNavigateRequests={() => setCurrentView('calibration-requests')}
          />
        )}
        {currentView === 'lab-intake' && (
          <LabRequestIntakePage
            requestId={selectedLabRequestId || undefined}
            onBack={() => setCurrentView('lab-queue')}
          />
        )}
        {currentView === 'lab-verification' && (
          <VerificationQueuePage
            onSelectRequest={(reqId) => {
              setSelectedVerificationRequestId(reqId);
              setCurrentView('lab-verification-detail');
            }}
          />
        )}
        {currentView === 'lab-verification-detail' && (
          <RequestVerificationPage
            requestId={selectedVerificationRequestId || ''}
            onBack={() => setCurrentView('lab-verification')}
          />
        )}
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
