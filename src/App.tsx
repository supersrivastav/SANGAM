import { useEffect, useRef, useState } from 'react';
import { useFlowStore } from './store/useFlowStore';
import TopBar from './components/TopBar';
import CustomerView from './components/customer/CustomerView';
import StaffPanel from './components/staff/StaffPanel';
import AdminDashboard from './components/admin/AdminDashboard';

import AuthPage from './components/auth/AuthPage';

function CursorGlow() {
  const [position, setPosition] = useState({ x: -1000, y: -1000 });
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      
      const target = e.target as HTMLElement;
      setIsPointer(
        window.getComputedStyle(target).cursor === 'pointer' || 
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' ||
        target.closest('button') !== null ||
        target.closest('a') !== null
      );
    };
    window.addEventListener('mousemove', updatePosition);
    return () => window.removeEventListener('mousemove', updatePosition);
  }, []);

  return (
    <div 
      className="pointer-events-none fixed top-0 left-0 z-50 hidden md:block"
      style={{
        transform: `translate(${position.x - 400}px, ${position.y - 400}px)`,
        width: '800px',
        height: '800px',
        background: `radial-gradient(circle, rgba(17, 103, 246, ${isPointer ? 0.08 : 0.04}) 0%, rgba(17, 103, 246, 0) 50%)`,
        transition: 'background 0.3s ease',
      }}
    />
  );
}

export default function App() {
  const { activeTab, tickSim, isAuthenticated } = useFlowStore();
  const intervalRef = useRef<number | null>(null);

  // Real-world clock loop: tick 1 sim minute every 1 real second
  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      tickSim();
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tickSim]);

  // Sync state to URL for realism
  useEffect(() => {
    const path = !isAuthenticated ? '/login' : `/${activeTab}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, [isAuthenticated, activeTab]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '');
      
      if (path === 'login' || !path) {
        if (isAuthenticated) {
          // User clicked back button to go to login page, log them out
          useFlowStore.getState().logout();
        }
      } else if (['customer', 'staff', 'admin'].includes(path)) {
        if (isAuthenticated) {
          // Check if they have permission for this tab
          const role = useFlowStore.getState().authRole;
          if (
            role === 'admin' || 
            (role === 'staff' && path === 'staff') ||
            (role === 'customer' && path === 'customer')
          ) {
            useFlowStore.getState().setActiveTab(path as any);
          } else {
            // Prevent unauthorized back-navigation (e.g. customer trying to go back to admin)
            window.history.pushState(null, '', `/${activeTab}`);
          }
        } else {
          // Unauthenticated user trying to go to a protected route
          window.history.replaceState(null, '', '/login');
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Initial load check for deep links
    const initialPath = window.location.pathname.replace('/', '');
    if (['customer', 'staff', 'admin'].includes(initialPath) && !isAuthenticated) {
      window.history.replaceState(null, '', '/login');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, activeTab]);

  if (!isAuthenticated) {
    return (
      <>
        <CursorGlow />
        <AuthPage />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <CursorGlow />
      <TopBar />
      <main className="flex-1 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
        {activeTab === 'customer' && <CustomerView />}
        {activeTab === 'staff' && <StaffPanel />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
}
