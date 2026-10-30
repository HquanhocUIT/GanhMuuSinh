import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider } from './auth';
import App from './App';
const Admin = lazy(() => import('./admin/Admin'));
const isAdminRoute = () => /^#admin(?:\/|$)/.test(location.hash);
export default function Root() {
  const [admin, setAdmin] = useState(isAdminRoute);
  useEffect(() => {
    const change = () => setAdmin(isAdminRoute());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div className="state-panel" role="status">
            Đang mở không gian…
          </div>
        }
      >
        {admin ? <Admin /> : <App />}
      </Suspense>
    </AuthProvider>
  );
}
