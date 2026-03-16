import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { LeftChatSidebar } from './LeftChatSidebar';
import { ChatSidebarProvider, useChatSidebar } from '../lib/ChatSidebarContext';
import NavbarAccordion from './NavbarAccordion';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'owner' | 'teamleder' | 'employee';
}

export function ProtectedRoute({ children, requiredRole = 'employee' }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const roleHierarchy: { [key: string]: number } = {
    owner: 3,
    teamleder: 2,
    employee: 1,
  };

  // Check if user has required role or higher
  const userRoleLevel = user.role ? roleHierarchy[user.role] : 0;
  if (userRoleLevel < roleHierarchy[requiredRole]) {
    return <Navigate to="/min-side" replace />;
  }

  // MobileHome should NOT have navbar/sidebar - render it standalone
  if (location.pathname === '/home') {
    return children;
  }

  return (
    <ChatSidebarProvider>
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </ChatSidebarProvider>
  );
}

// Inner component that uses the ChatSidebar hook
function ProtectedRouteInner({ children }: { children: React.ReactNode }) {
  const { isChatSidebarOpen, setIsChatSidebarOpen } = useChatSidebar();
  const { logout } = useAuth();

  const handleNavigation = (section: string, tab: string) => {
    // Navigation will be handled by the parent routing logic
    // For now, just console log
    console.log('Navigate to:', section, tab);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* New Vertical Accordion Navbar on left */}
      <NavbarAccordion 
        onNavigate={handleNavigation}
        currentSection="min-side"
        currentTab="ms-status"
        onLogout={handleLogout}
      />

      {/* Chat Sidebar */}
      <LeftChatSidebar 
        isOpen={isChatSidebarOpen}
        onClose={() => setIsChatSidebarOpen(false)}
      />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* 🔔 Notification Button - Floating */}
        {/* Kept as floating element from MinSide */}
        {children}
      </div>
    </div>
  );
}
