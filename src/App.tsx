import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/Layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TenantsPage } from './pages/TenantsPage';
import { ClientMaster } from './pages/ClientMaster';
import { VendorMaster } from './pages/VendorMaster';
import { ItemMaster } from './pages/ItemMaster';
import { CollectionRequests } from './pages/CollectionRequests';
import { LabQueue } from './pages/LabQueue';
import { CalibrationQueue } from './pages/CalibrationQueue';
import { QuotationsPage } from './pages/QuotationsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { SignatureCapturePage } from './pages/SignatureCapturePage';
import { DispatchPage } from './pages/DispatchPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { RequestDetailView } from './pages/RequestDetailView';

const MainAppContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [inspectRequestId, setInspectRequestId] = useState<string | null>(null);

  if (!user) {
    return <Login />;
  }

  const handleNavigate = (tab: string, requestId?: string) => {
    setActiveTab(tab);
    if (requestId) setInspectRequestId(requestId);
    else setInspectRequestId(null);
  };

  const renderActiveTab = () => {
    if (inspectRequestId) {
      return <RequestDetailView requestId={inspectRequestId} onBack={() => setInspectRequestId(null)} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'tenants':
        return <TenantsPage />;
      case 'clients':
        return <ClientMaster />;
      case 'vendors':
        return <VendorMaster />;
      case 'items':
        return <ItemMaster />;
      case 'collection':
        return <CollectionRequests />;
      case 'lab':
        return <LabQueue />;
      case 'calibration':
        return <CalibrationQueue />;
      case 'commercial':
        return <QuotationsPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'signatures':
        return <SignatureCapturePage />;
      case 'dispatch':
        return <DispatchPage />;
      case 'delivery':
        return <DeliveryPage />;
      case 'audit':
        return <AuditTrailPage />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout activeTab={activeTab} setActiveTab={(tab) => { setInspectRequestId(null); setActiveTab(tab); }}>
      {renderActiveTab()}
    </AppLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

export default App;
