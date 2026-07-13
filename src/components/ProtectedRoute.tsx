import { useEffect, type ReactNode } from 'react';
import { useStore } from '../context/StoreContext';
import { showToast } from './Toast';
import { Layout, type PageKey } from './Layout';
import { canAccessPage, getDefaultPage } from '../utils/rbac';

interface ProtectedRouteProps {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

export function ProtectedRoute({ page, onNavigate, children }: ProtectedRouteProps) {
  const { service } = useStore();
  const user = service.getCurrentUser();

  useEffect(() => {
    if (!user) return;

    if (!canAccessPage(user.role, page)) {
      showToast('warning', 'Access Denied: your role does not have permission to view this page.');
      onNavigate(getDefaultPage(user.role));
    }
  }, [user, page, onNavigate]);

  if (!user) return null;

  if (!canAccessPage(user.role, page)) {
    return null;
  }

  return (
    <Layout currentPage={page} onNavigate={onNavigate}>
      {children}
    </Layout>
  );
}
