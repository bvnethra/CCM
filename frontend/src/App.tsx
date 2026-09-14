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
import { CalibrationQueuePage } from './features/calibration/CalibrationQueuePage';
import { CalibrationWorkspacePage } from './features/calibration/CalibrationWorkspacePage';
import { CalibrationDueListPage } from './features/calibration/CalibrationDueListPage';
import { ServiceRequestListPage } from './features/service/ServiceRequestListPage';
import { ServiceRequestDetailsPage } from './features/service/ServiceRequestDetailsPage';
import { VendorOutsourceListPage } from './features/outsource/VendorOutsourceListPage';
import { VendorOutsourceDetailsPage } from './features/outsource/VendorOutsourceDetailsPage';
import { VendorPOListPage } from './features/outsource/VendorPOListPage';
import { VendorPODetailsPage } from './features/outsource/VendorPODetailsPage';
import { QuotationListPage } from './features/quotations/QuotationListPage';
import { CreateQuotationPage } from './features/quotations/CreateQuotationPage';
import { QuotationDetailsPage } from './features/quotations/QuotationDetailsPage';
import { InvoiceListPage } from './features/invoices/InvoiceListPage';
import { CreateInvoicePage } from './features/invoices/CreateInvoicePage';
import { InvoiceDetailsPage } from './features/invoices/InvoiceDetailsPage';
import { ClientInvoiceSignPage } from './features/invoices/ClientInvoiceSignPage';
import { DispatchListPage } from './features/dispatch/DispatchListPage';
import { CreateDispatchPage } from './features/dispatch/CreateDispatchPage';
import { DispatchDetailsPage } from './features/dispatch/DispatchDetailsPage';
import { RequestDetailsPage } from './features/requests/RequestDetailsPage';
import { CollectionAgentPage } from './features/collection/CollectionAgentPage';
import { ExceptionCenterPage } from './features/operations/ExceptionCenterPage';
import { AuditLogsPage } from './features/audit/AuditLogsPage';
import { ReportsPage } from './features/reports/ReportsPage';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedLabRequestId, setSelectedLabRequestId] = useState<string | null>(null);
  const [selectedVerificationRequestId, setSelectedVerificationRequestId] = useState<string | null>(null);
  const [selectedCalibrationRequestItemId, setSelectedCalibrationRequestItemId] = useState<string | null>(null);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(null);
  const [selectedOutsourceId, setSelectedOutsourceId] = useState<string | null>(null);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [prefillClientId, setPrefillClientId] = useState<string | undefined>(undefined);
  const [prefillItemId, setPrefillItemId] = useState<string | undefined>(undefined);

  // Check for public client signing URL route /client-sign/invoice/:requestReference
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path.startsWith('/client-sign/invoice/')) {
    const ref = path.replace('/client-sign/invoice/', '').trim();
    return <ClientInvoiceSignPage requestReference={ref} />;
  }

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
          if (view !== 'lab-calibration-detail') {
            setSelectedCalibrationRequestItemId(null);
          }
          if (view !== 'service-request-detail') {
            setSelectedServiceRequestId(null);
          }
          if (view !== 'vendor-outsource-detail') {
            setSelectedOutsourceId(null);
          }
          if (view !== 'vendor-po-detail') {
            setSelectedPOId(null);
          }
          if (view !== 'quotation-detail') {
            setSelectedQuotationId(null);
          }
          if (view !== 'invoice-detail') {
            setSelectedInvoiceId(null);
          }
          if (view !== 'dispatch-detail') {
            setSelectedDispatchId(null);
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
            onOpenRequestDetails={(reqId) => {
              setSelectedRequestId(reqId);
              setCurrentView('calibration-request-detail');
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
        {currentView === 'lab-calibration' && (
          <CalibrationQueuePage
            onOpenWorkspace={(reqItemId) => {
              setSelectedCalibrationRequestItemId(reqItemId);
              setCurrentView('lab-calibration-detail');
            }}
          />
        )}
        {currentView === 'lab-calibration-detail' && (
          <CalibrationWorkspacePage
            requestItemId={selectedCalibrationRequestItemId || ''}
            onBack={() => setCurrentView('lab-calibration')}
          />
        )}
        {currentView === 'calibration-due-list' && (
          <CalibrationDueListPage
            onCreateRequest={() => setCurrentView('calibration-requests')}
            onCreateQuotation={(cId, iId) => {
              setPrefillClientId(cId);
              setPrefillItemId(iId);
              setCurrentView('quotation-create');
            }}
          />
        )}
        {currentView === 'service-requests' && (
          <ServiceRequestListPage
            onSelectServiceRequest={(srId) => {
              setSelectedServiceRequestId(srId);
              setCurrentView('service-request-detail');
            }}
          />
        )}
        {currentView === 'service-request-detail' && (
          <ServiceRequestDetailsPage
            serviceRequestId={selectedServiceRequestId || ''}
            onBack={() => setCurrentView('service-requests')}
            onReturnToCalibrationSuccess={() => setCurrentView('lab-calibration')}
          />
        )}
        {currentView === 'vendor-outsourcing' && (
          <VendorOutsourceListPage
            onSelectOutsource={(id) => {
              setSelectedOutsourceId(id);
              setCurrentView('vendor-outsource-detail');
            }}
          />
        )}
        {currentView === 'vendor-outsource-detail' && (
          <VendorOutsourceDetailsPage
            outsourceId={selectedOutsourceId || ''}
            onBack={() => setCurrentView('vendor-outsourcing')}
          />
        )}
        {currentView === 'vendor-purchase-orders' && (
          <VendorPOListPage
            onSelectPO={(id) => {
              setSelectedPOId(id);
              setCurrentView('vendor-po-detail');
            }}
          />
        )}
        {currentView === 'vendor-po-detail' && (
          <VendorPODetailsPage
            poId={selectedPOId || ''}
            onBack={() => setCurrentView('vendor-purchase-orders')}
          />
        )}
        {currentView === 'quotations' && (
          <QuotationListPage
            onSelectQuotation={(id) => {
              setSelectedQuotationId(id);
              setCurrentView('quotation-detail');
            }}
            onCreateNew={() => {
              setPrefillClientId(undefined);
              setPrefillItemId(undefined);
              setCurrentView('quotation-create');
            }}
          />
        )}
        {currentView === 'quotation-create' && (
          <CreateQuotationPage
            initialClientId={prefillClientId}
            initialItemId={prefillItemId}
            onBack={() => setCurrentView('quotations')}
            onSuccess={(id) => {
              setSelectedQuotationId(id);
              setCurrentView('quotation-detail');
            }}
          />
        )}
        {currentView === 'quotation-detail' && (
          <QuotationDetailsPage
            quotationId={selectedQuotationId || ''}
            onBack={() => setCurrentView('quotations')}
            onRevisionSuccess={(id) => {
              setSelectedQuotationId(id);
              setCurrentView('quotation-detail');
            }}
          />
        )}
        {currentView === 'invoices' && (
          <InvoiceListPage
            onSelectInvoice={(id) => {
              setSelectedInvoiceId(id);
              setCurrentView('invoice-detail');
            }}
            onCreateNew={() => setCurrentView('invoice-create')}
          />
        )}
        {currentView === 'invoice-create' && (
          <CreateInvoicePage
            onBack={() => setCurrentView('invoices')}
            onSuccess={(id) => {
              setSelectedInvoiceId(id);
              setCurrentView('invoice-detail');
            }}
          />
        )}
        {currentView === 'invoice-detail' && (
          <InvoiceDetailsPage
            invoiceId={selectedInvoiceId || ''}
            onBack={() => setCurrentView('invoices')}
          />
        )}
        {currentView === 'dispatches' && (
          <DispatchListPage
            onSelectDispatch={(id) => {
              setSelectedDispatchId(id);
              setCurrentView('dispatch-detail');
            }}
            onCreateNew={() => setCurrentView('dispatch-create')}
          />
        )}
        {currentView === 'dispatch-create' && (
          <CreateDispatchPage
            onBack={() => setCurrentView('dispatches')}
            onSuccess={(id) => {
              setSelectedDispatchId(id);
              setCurrentView('dispatch-detail');
            }}
          />
        )}
        {currentView === 'dispatch-detail' && (
          <DispatchDetailsPage
            dispatchId={selectedDispatchId || ''}
            onBack={() => setCurrentView('dispatches')}
          />
        )}
        {currentView === 'calibration-request-detail' && (
          <RequestDetailsPage
            requestId={selectedRequestId || ''}
            onBack={() => setCurrentView('requests')}
            onNavigate={(route) => setCurrentView(route)}
          />
        )}
        {currentView === 'collection' && <CollectionAgentPage />}
        {currentView === 'operations-exceptions' && (
          <ExceptionCenterPage
            onNavigate={(route) => setCurrentView(route)}
          />
        )}
        {currentView === 'reports' && <ReportsPage />}
        {currentView === 'clients' && <ClientManagementPage />}
        {currentView === 'vendors' && <VendorManagementPage />}
        {currentView === 'items' && <ItemManagementPage />}
        {currentView === 'tenants' && <TenantManagementPage />}
        {currentView === 'organizations' && <OrganizationManagementPage />}
        {currentView === 'sub-organizations' && <SubOrganizationManagementPage />}
        {currentView === 'users' && <UserManagementPage />}
        {currentView === 'roles' && <RolesPermissionsPage />}
        {currentView === 'audit-logs' && <AuditLogsPage />}
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
