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
  const [closingItem, setClosingItem] = useState<string | null>(null); // Track which item is closing
  const [isNotificationOpen, setIsNotificationOpen] = useState(false); // Notification panel state

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
      // Start closing animation
      setClosingItem(itemId);
      // After animation completes (3500ms = 3.5s tab closing), actually close
      setTimeout(() => {
        setExpandedItem(null);
        setClosingItem(null);
      }, 3500);
    } else {
      // Opening new item
      setClosingItem(null);
      setExpandedItem(itemId);
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
          {/* NOTIFICATION BELL - Top of navbar - Simple Yellow Emoji */}
          <button 
            className="notification-bell-button"
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '3rem',
              padding: '0.5rem',
              position: 'relative',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🔔
            {totalUnread > 0 && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                border: '2px solid white',
              }}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </div>
            )}
          </button>

          {/* NOTIFICATION PANEL */}
          {isNotificationOpen && (
            <div className="notification-panel">
              <div style={{ padding: '1rem', color: '#999', fontSize: '0.9rem' }}>
                Notifikasjoner kommer her
              </div>
            </div>
          )}

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
            {(expandedItem === 'min-side' || closingItem === 'min-side') && (
              <div className={`nav-tabs-dropdown ${closingItem === 'min-side' ? 'closing' : ''}`}>
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
            {(expandedItem === 'min-avdeling' || closingItem === 'min-avdeling') && (
              <div className={`nav-tabs-dropdown ${closingItem === 'min-avdeling' ? 'closing' : ''}`}>
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
            {(expandedItem === 'mitt-prosjekt' || closingItem === 'mitt-prosjekt') && (
              <div className={`nav-tabs-dropdown ${closingItem === 'mitt-prosjekt' ? 'closing' : ''}`}>
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
              {(expandedItem === 'teamleder' || closingItem === 'teamleder') && (
                <div className={`nav-tabs-dropdown ${closingItem === 'teamleder' ? 'closing' : ''}`}>
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

          {/* 5. ADMIN - Gear icon WITH TABS */}
          {(user?.role === 'owner') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <button 
                className={`nav-button ${expandedItem === 'admin' ? 'expanded' : ''}`}
                onClick={() => toggleExpandItem('admin')}
              >
                <div className="icon-circle">
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>
                  </svg>
                </div>
                <div className="nav-tooltip">Admin</div>
              </button>

              {/* TABS DROPDOWN FOR ADMIN */}
              {(expandedItem === 'admin' || closingItem === 'admin') && (
                <div className={`nav-tabs-dropdown ${closingItem === 'admin' ? 'closing' : ''}`}>
                  {/* MUON - EXPANDABLE SUBMENU AT TOP */}
                  <div style={{ width: '100%' }}>
                    <button 
                      className={`nav-tab ${(activeTab as string).startsWith('admin-muon') ? 'active' : ''}`}
                      onClick={() => setActiveTab((activeTab as string).includes('admin-muon-') ? 'admin-muon' : 'admin-muon-dashboard')}
                      style={{ position: 'relative', fontWeight: '600' }}
                    >
                      Muon ▼
                    </button>
                    {(activeTab as string).includes('admin-muon-') && (
                      <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid rgba(255,255,255,0.3)' }}>
                        <button 
                          className={`nav-tab ${activeTab === 'admin-muon-dashboard' ? 'active' : ''}`}
                          onClick={() => handleTabClick('admin-muon-dashboard', '/admin-dashboard?tab=muon&muon=dashboard')}
                          style={{ fontSize: '0.8rem', paddingLeft: '0.5rem' }}
                        >
                          Dashboard
                        </button>
                        <button 
                          className={`nav-tab ${activeTab === 'admin-muon-people' ? 'active' : ''}`}
                          onClick={() => handleTabClick('admin-muon-people', '/admin-dashboard?tab=muon&muon=people')}
                          style={{ fontSize: '0.8rem', paddingLeft: '0.5rem' }}
                        >
                          People
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    className={`nav-tab ${activeTab === 'admin-org' ? 'active' : ''}`}
                    onClick={() => handleTabClick('admin-org', '/admin-dashboard?tab=organisasjon')}
                  >
                    Organisasjon
                  </button>

                  {/* PROSJEKT - EXPANDABLE SUBMENU */}
                  <div style={{ width: '100%' }}>
                    <button 
                      className={`nav-tab ${(activeTab as string).startsWith('admin-proj') ? 'active' : ''}`}
                      onClick={() => setActiveTab((activeTab as string).includes('admin-proj-') ? 'admin-proj' : 'admin-proj-allente')}
                      style={{ position: 'relative' }}
                    >
                      Prosjekt ▼
                    </button>
                    {(activeTab as string).includes('admin-proj-') && (
                      <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid rgba(255,255,255,0.3)' }}>
                        {/* ALLENTE - EXPANDABLE WITH TABS */}
                        <div style={{ width: '100%' }}>
                          <button 
                            className={`nav-tab ${(activeTab as string).startsWith('admin-proj-allente') ? 'active' : ''}`}
                            onClick={() => setActiveTab((activeTab as string).includes('admin-allente-') ? 'admin-proj-allente' : 'admin-allente-progresjon')}
                            style={{ fontSize: '0.8rem', paddingLeft: '0.5rem' }}
                          >
                            Allente ▼
                          </button>
                          {(activeTab as string).includes('admin-allente-') && (
                            <div style={{ paddingLeft: '0.3rem', borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                              <button 
                                className={`nav-tab ${activeTab === 'admin-allente-progresjon' ? 'active' : ''}`}
                                onClick={() => handleTabClick('admin-allente-progresjon', '/admin-dashboard?tab=prosjekt&prosjekt=allente&sub=progresjon')}
                                style={{ fontSize: '0.75rem', paddingLeft: '0.3rem' }}
                              >
                                Progresjon
                              </button>
                              <button 
                                className={`nav-tab ${activeTab === 'admin-allente-produkt' ? 'active' : ''}`}
                                onClick={() => handleTabClick('admin-allente-produkt', '/admin-dashboard?tab=prosjekt&prosjekt=allente&sub=produkt')}
                                style={{ fontSize: '0.75rem', paddingLeft: '0.3rem' }}
                              >
                                Produkt
                              </button>
                              <button 
                                className={`nav-tab ${activeTab === 'admin-allente-badges' ? 'active' : ''}`}
                                onClick={() => handleTabClick('admin-allente-badges', '/admin-dashboard?tab=prosjekt&prosjekt=allente&sub=badges')}
                                style={{ fontSize: '0.75rem', paddingLeft: '0.3rem' }}
                              >
                                Badges
                              </button>
                            </div>
                          )}
                        </div>

                        <button 
                          className={`nav-tab ${activeTab === 'admin-proj-surfnet' ? 'active' : ''}`}
                          onClick={() => handleTabClick('admin-proj-surfnet', '/admin-dashboard?tab=prosjekt&prosjekt=surfnet')}
                          style={{ fontSize: '0.8rem', paddingLeft: '0.5rem' }}
                        >
                          Surfnet
                        </button>
                        <button 
                          className={`nav-tab ${activeTab === 'admin-proj-skandia' ? 'active' : ''}`}
                          onClick={() => handleTabClick('admin-proj-skandia', '/admin-dashboard?tab=prosjekt&prosjekt=skandia')}
                          style={{ fontSize: '0.8rem', paddingLeft: '0.5rem' }}
                        >
                          Skandia
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    className={`nav-tab ${activeTab === 'admin-tema' ? 'active' : ''}`}
                    onClick={() => handleTabClick('admin-tema', '/admin-dashboard?tab=tema')}
                  >
                    Tema
                  </button>
                </div>
              )}
            </div>
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
