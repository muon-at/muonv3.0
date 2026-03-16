import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

import { useChannelUnread } from '../lib/ChannelUnreadContext';
import '../styles/LeftNavBar.css';

export const LeftNavBar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const { channelUnreadCounts } = useChannelUnread();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [expandedItem, setExpandedItem] = useState<string | null>('min-side'); // Min Side expanded by default
  const [activeTab, setActiveTab] = useState<string>('status'); // Default tab

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Calculate total unread: all channels + all DMs
  const calculateUnread = () => {
    // Sum all channel unread from Context
    const channelTotal = Object.values(channelUnreadCounts).reduce((sum, count) => sum + count, 0);
    
    // Sum all DM unread from localStorage
    let dmTotal = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('chat_unread_dm_')) {
        dmTotal += parseInt(localStorage.getItem(key) || '0', 10);
      }
    });
    
    // Total = channels + DMs
    const total = channelTotal + dmTotal;
    setTotalUnread(total);
    
    console.log('📊 Chat button badge:', { channels: channelTotal, dms: dmTotal, total });
  };
  
  useEffect(() => {
    calculateUnread();
  }, [channelUnreadCounts]);
  
  // Listen for custom chat unread updates (from Sidebar real-time listeners)
  useEffect(() => {
    const handleChatUnreadUpdate = (event: Event) => {
      console.log('💌 Custom event detected - updating unread...');
      
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {};
      
      // Use event detail data if available (fresh from Sidebar)
      let dmTotal = 0;
      if (detail.dmUnread && typeof detail.dmUnread === 'object') {
        dmTotal = Object.values(detail.dmUnread as Record<string, number>).reduce((sum: number, count: number) => sum + count, 0);
        console.log('📦 Using dmUnread from event detail:', detail.dmUnread, '→ total:', dmTotal);
      } else {
        // Fallback to localStorage if no event detail
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('chat_unread_dm_')) {
            dmTotal += parseInt(localStorage.getItem(key) || '0', 10);
          }
        });
        console.log('📦 Using localStorage fallback for DMs → total:', dmTotal);
      }
      
      const channelTotal = Object.values(channelUnreadCounts).reduce((sum, count) => sum + count, 0);
      const total = channelTotal + dmTotal;
      setTotalUnread(total);
      console.log('✅ Navbar badge updated:', { channels: channelTotal, dms: dmTotal, total });
      
      // Update PWA app badge
      if (navigator.setAppBadge) {
        navigator.setAppBadge(total);
        console.log('📱 PWA app badge updated:', total);
      }
    };
    
    window.addEventListener('chatUnreadUpdated', handleChatUnreadUpdate);
    console.log('✅ Event listener attached for chatUnreadUpdated');
    
    return () => window.removeEventListener('chatUnreadUpdated', handleChatUnreadUpdate);
  }, [channelUnreadCounts]);
  
  // Update PWA app badge when totalUnread changes
  useEffect(() => {
    if (navigator.setAppBadge) {
      if (totalUnread > 0) {
        navigator.setAppBadge(totalUnread);
        console.log('📱 PWA app badge set to:', totalUnread);
      } else {
        navigator.clearAppBadge?.();
        console.log('📱 PWA app badge cleared');
      }
    }
  }, [totalUnread]);



  const toggleExpandItem = (itemId: string) => {
    if (expandedItem === itemId) {
      setExpandedItem(null); // Close if already open
    } else {
      setExpandedItem(itemId); // Open this item
    }
  };

  const handleTabClick = (tabId: string, path: string) => {
    setActiveTab(tabId);
    navigate(path);
  };

  return (
    <>
      {/* Desktop NavBar */}
      <div className="left-nav-bar left-nav-bar-desktop">
        <div className="nav-items">
          {/* 1. MIN SIDE - Person icon WITH TABS */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <button 
              className={`nav-button ${expandedItem === 'min-side' ? 'expanded' : ''}`}
              onClick={() => toggleExpandItem('min-side')}
            >
              <div className="icon-circle">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4"/>
                </svg>
              </div>
              <div className="nav-tooltip">Min Side</div>
            </button>

            {/* TABS DROPDOWN FOR MIN SIDE */}
            {expandedItem === 'min-side' && (
              <div className="nav-tabs-dropdown">
                <button 
                  className={`nav-tab ${activeTab === 'status' ? 'active' : ''}`}
                  onClick={() => handleTabClick('status', '/min-side?tab=status')}
                >
                  Status
                </button>
                <button 
                  className={`nav-tab ${activeTab === 'rekorder' ? 'active' : ''}`}
                  onClick={() => handleTabClick('rekorder', '/min-side?tab=rekorder')}
                >
                  Rekorder
                </button>
                <button 
                  className={`nav-tab ${activeTab === 'lonn' ? 'active' : ''}`}
                  onClick={() => handleTabClick('lonn', '/min-side?tab=lonn')}
                >
                  Lønn
                </button>
                <button 
                  className={`nav-tab ${activeTab === 'kalender' ? 'active' : ''}`}
                  onClick={() => handleTabClick('kalender', '/min-side?tab=kalender')}
                >
                  Kalender
                </button>
              </div>
            )}
          </div>

          {/* 2. MIN AVDELING - People icon WITH TABS */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <button 
              className={`nav-button ${expandedItem === 'min-avdeling' ? 'expanded' : ''}`}
              onClick={() => toggleExpandItem('min-avdeling')}
            >
              <div className="icon-circle">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="nav-tooltip">Min Avdeling</div>
            </button>

            {/* TABS DROPDOWN FOR MIN AVDELING */}
            {expandedItem === 'min-avdeling' && (
              <div className="nav-tabs-dropdown">
                <button 
                  className={`nav-tab ${activeTab === 'avd-status' ? 'active' : ''}`}
                  onClick={() => handleTabClick('avd-status', '/min-avdeling?tab=status')}
                >
                  Status
                </button>
                <button 
                  className={`nav-tab ${activeTab === 'avd-walloffame' ? 'active' : ''}`}
                  onClick={() => handleTabClick('avd-walloffame', '/min-avdeling?tab=walloffame')}
                >
                  Wall of Fame MVP
                </button>
              </div>
            )}
          </div>

          {/* 3. MITT PROSJEKT - Briefcase icon WITH TABS */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <button 
              className={`nav-button ${expandedItem === 'mitt-prosjekt' ? 'expanded' : ''}`}
              onClick={() => toggleExpandItem('mitt-prosjekt')}
            >
              <div className="icon-circle">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              </div>
              <div className="nav-tooltip">Mitt Prosjekt</div>
            </button>

            {/* TABS DROPDOWN FOR MITT PROSJEKT */}
            {expandedItem === 'mitt-prosjekt' && (
              <div className="nav-tabs-dropdown">
                <button 
                  className={`nav-tab ${activeTab === 'proj-status' ? 'active' : ''}`}
                  onClick={() => handleTabClick('proj-status', '/mitt-prosjekt?tab=status')}
                >
                  Status
                </button>
                <button 
                  className={`nav-tab ${activeTab === 'proj-walloffame' ? 'active' : ''}`}
                  onClick={() => handleTabClick('proj-walloffame', '/mitt-prosjekt?tab=walloffame')}
                >
                  Wall of Fame MVP
                </button>
              </div>
            )}
          </div>

          {/* 4. TEAMLEDER - People icon WITH TABS */}
          {(user?.role === 'owner' || user?.role === 'teamleder') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <button 
                className={`nav-button ${expandedItem === 'teamleder' ? 'expanded' : ''}`}
                onClick={() => toggleExpandItem('teamleder')}
              >
                <div className="icon-circle">
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="nav-tooltip">Teamleder</div>
              </button>

              {/* TABS DROPDOWN FOR TEAMLEDER */}
              {expandedItem === 'teamleder' && (
                <div className="nav-tabs-dropdown">
                  <button 
                    className={`nav-tab ${activeTab === 'tl-kalendere' ? 'active' : ''}`}
                    onClick={() => handleTabClick('tl-kalendere', '/teamleder?tab=kalendere')}
                  >
                    Kalendere
                  </button>
                  <button 
                    className={`nav-tab ${activeTab === 'tl-selgere' ? 'active' : ''}`}
                    onClick={() => handleTabClick('tl-selgere', '/teamleder?tab=selgere')}
                  >
                    Mine Selgere
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 5. ADMIN - Gear icon */}
          {(user?.role === 'owner') && (
            <button 
              className="nav-button"
              onClick={() => navigate('/admin-dashboard')}
            >
              <div className="icon-circle">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>
                </svg>
              </div>
              <div className="nav-tooltip">Admin</div>
            </button>
          )}

          {/* 6. LOGOUT - Door icon */}
          <button 
            className="nav-button"
            onClick={handleLogout}
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M17 9l4 4m0 0l-4 4m4-4H9"/>
              </svg>
            </div>
            <div className="nav-tooltip">Logg ut</div>
          </button>
        </div>
      </div>

      {/* Mobile Hamburger Menu */}
      <div className={`mobile-nav-menu ${isMobileMenuOpen ? 'open' : ''}`}>
        <button
          className="mobile-hamburger"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          
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
