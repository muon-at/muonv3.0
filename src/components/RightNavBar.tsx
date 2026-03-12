import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { useChatSidebar } from '../lib/ChatSidebarContext';
import { useDMUnread } from '../lib/DMUnreadContext';
import '../styles/RightNavBar.css';

export const RightNavBar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isChatSidebarOpen, setIsChatSidebarOpen } = useChatSidebar();
  const { totalDMUnread } = useDMUnread(); // Get total DM unread from global context
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Update unread count from BOTH DMs (context) + channels (sessionStorage)
  useEffect(() => {
    // Get channel unread from sessionStorage
    const stored = sessionStorage.getItem('chat_unread_count');
    const channelUnread = stored ? parseInt(stored, 10) : 0;
    
    // Get DM unread from context
    const dmUnread = totalDMUnread;
    
    // Total = channels + DMs
    const total = channelUnread + dmUnread;
    setUnreadCount(total);
    
    console.log('📊 Badge update:', { channelUnread, dmUnread, total });
  }, [totalDMUnread]);
  
  // Also poll sessionStorage periodically to catch channel unread updates
  useEffect(() => {
    const readUnreadCount = () => {
      const stored = sessionStorage.getItem('chat_unread_count');
      if (stored) {
        const channelUnread = parseInt(stored, 10);
        const total = channelUnread + totalDMUnread;
        setUnreadCount(total);
      }
    };

    // Poll every 1000ms 
    const interval = setInterval(readUnreadCount, 1000);
    return () => clearInterval(interval);
  }, [totalDMUnread]);

  const handleChatToggle = () => {
    console.log('🔵 Chat button clicked!', 'Current state:', isChatSidebarOpen);
    setIsChatSidebarOpen(!isChatSidebarOpen);
    console.log('✅ Sidebar state toggled to:', !isChatSidebarOpen);
  };

  return (
    <>
      {/* Desktop NavBar */}
      <div className="right-nav-bar right-nav-bar-desktop">
        <div className="nav-items">
          {/* LOGOUT - Door icon */}
          <button 
            className="nav-button"
            onClick={handleLogout}
            title="Logg ut"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M17 9l4 4m0 0l-4 4m4-4H9"/>
              </svg>
            </div>
            <div className="nav-tooltip">Logg ut</div>
          </button>

          {/* BACK - Arrow left */}
          <button 
            className="nav-button"
            onClick={() => window.history.back()}
            title="Tilbake"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </div>
            <div className="nav-tooltip">Tilbake</div>
          </button>

          {/* ADMIN - Gear icon */}
          {(user?.role === 'owner') && (
            <button 
              className="nav-button"
              onClick={() => navigate('/admin-dashboard')}
              title="Admin"
            >
              <div className="icon-circle">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>
                </svg>
              </div>
              <div className="nav-tooltip">Admin</div>
            </button>
          )}

          {/* TEAMLEDER - People icon */}
          {(user?.role === 'owner' || user?.role === 'teamleder') && (
            <button 
              className="nav-button"
              onClick={() => navigate('/teamleder')}
              title="Teamleder"
            >
              <div className="icon-circle">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="nav-tooltip">Teamleder</div>
            </button>
          )}

          {/* MIN SIDE - Person icon */}
          <button 
            className="nav-button"
            onClick={() => navigate('/min-side')}
            title="Min Side"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4"/>
              </svg>
            </div>
            <div className="nav-tooltip">Min Side</div>
          </button>

          {/* CHAT - Speech bubble icon (BOTTOM) */}
          <button 
            className={`nav-button ${isChatSidebarOpen ? 'active' : ''}`}
            onClick={handleChatToggle}
            title="Chat"
          >
            <div className="icon-circle" style={{ position: 'relative' }}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {/* Unread badge */}
              {unreadCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  border: '2px solid white',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </div>
            <div className="nav-tooltip">Chat {unreadCount > 0 ? `(${unreadCount})` : ''}</div>
          </button>
        </div>
      </div>

      {/* Mobile Hamburger Menu */}
      <div className={`mobile-nav-menu ${isMobileMenuOpen ? 'open' : ''}`}>
        <button
          className="mobile-hamburger"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title="Menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
            {isMobileMenuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        {/* Mobile Menu Drawer */}
        <div className={`mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-items">
            {/* CHAT */}
            <button
              className="mobile-nav-button"
              onClick={() => { handleChatToggle(); setIsMobileMenuOpen(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Chat</span>
            </button>

            {/* LOGOUT */}
            <button
              className="mobile-nav-button"
              onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M17 9l4 4m0 0l-4 4m4-4H9"/>
              </svg>
              <span>Logg ut</span>
            </button>

            {/* BACK */}
            <button
              className="mobile-nav-button"
              onClick={() => { window.history.back(); setIsMobileMenuOpen(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Tilbake</span>
            </button>

            {/* ADMIN */}
            {(user?.role === 'owner') && (
              <button
                className="mobile-nav-button"
                onClick={() => { navigate('/admin-dashboard'); setIsMobileMenuOpen(false); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>
                </svg>
                <span>Admin</span>
              </button>
            )}

            {/* TEAMLEDER */}
            {(user?.role === 'owner' || user?.role === 'teamleder') && (
              <button
                className="mobile-nav-button"
                onClick={() => { navigate('/teamleder'); setIsMobileMenuOpen(false); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>Teamleder</span>
              </button>
            )}

            {/* MIN SIDE */}
            <button
              className="mobile-nav-button"
              onClick={() => { navigate('/min-side'); setIsMobileMenuOpen(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4"/>
              </svg>
              <span>Min Side</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
