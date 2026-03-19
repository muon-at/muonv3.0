import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { LeftChatSidebar } from './LeftChatSidebar';
import { LeftNavBar } from './LeftNavBar';
import { ChatSidebarProvider, useChatSidebar } from '../lib/ChatSidebarContext';

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

  // LIVE kiosk pages should NOT have navbar/sidebar - render full screen
  const livePages = ['/live-krs', '/live-osl', '/live-skien'];
  if (livePages.includes(location.pathname)) {
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

  return (
    <>
      {/* Left Navbar - OLD DESIGN ON LEFT SIDE */}
      <LeftNavBar />

      {/* Chat Sidebar */}
      <LeftChatSidebar 
        isOpen={isChatSidebarOpen}
        onClose={() => setIsChatSidebarOpen(false)}
      />

      {/* Main Content */}
      {children}
    </>
  );
}
