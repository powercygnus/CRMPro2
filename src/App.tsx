import { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast';
import { FeedbackProvider } from './components/FeedbackModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RepairsPage } from './pages/RepairsPage';
import { UsersPage } from './pages/UsersPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { DevicesPage } from './pages/DevicesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { WarrantyPage } from './pages/WarrantyPage';
import { WhatsAppWorkspacePage } from './pages/WhatsAppWorkspacePage';
import { ActivityPage } from './pages/ActivityPage';
import { LogsPage } from './pages/LogsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AutomationRulesPage } from './pages/AutomationRulesPage';
import { SettingsPage } from './pages/SettingsPage';
import { InventoryPage } from './pages/InventoryPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SalesPage } from './pages/SalesPage';
import { DeliveryPage } from './pages/DeliveryPage';
import type { PageKey } from './components/Layout';
import { getDefaultPage } from './utils/rbac';

function AppContent() {
  const { service } = useStore();
  const user = service.getCurrentUser();
  const [page, setPage] = useState<PageKey>(() => getDefaultPage(user?.role ?? 'technician'));
  const [sessionUserId, setSessionUserId] = useState<string | null>(user?.id ?? null);

  // When the logged-in user changes (login/switch), land on their role's default page.
  if ((user?.id ?? null) !== sessionUserId) {
    setSessionUserId(user?.id ?? null);
    setPage(getDefaultPage(user?.role ?? 'technician'));
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={setPage} />;
      case 'repairs':
        return <RepairsPage />;
      case 'customers':
        return <ProfilesPage />;
      case 'devices':
        return <DevicesPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'sales':
        return <SalesPage />;
      case 'warranty':
        return <WarrantyPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'delivery':
        return <DeliveryPage />;
      case 'whatsapp':
        return <WhatsAppWorkspacePage />;
      case 'users':
        return <UsersPage />;
      case 'activity':
        return <ActivityPage />;
      case 'logs':
        return <LogsPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'rules':
        return <AutomationRulesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setPage} />;
    }
  };

  return (
    <>
      <div key={user.id} className="animate-fade-in-slow">
        <ProtectedRoute page={page} onNavigate={setPage}>
          {renderPage()}
        </ProtectedRoute>
      </div>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <FeedbackProvider>
          <AppContent />
        </FeedbackProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}
