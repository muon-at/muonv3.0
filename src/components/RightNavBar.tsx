import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import '../styles/RightNavBar.css';

export const RightNavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Listen for new messages in all accessible channels
  useEffect(() => {
    if (!user) return;

    const channelsToTrack = [
      'global',
      'dept-krs',
      'dept-osl',
      'dept-skien',
      'team',
      `dept-${(user.department || '').toLowerCase()}`,
      `project-${(user.project || '').toLowerCase()}`,
      'admin'
    ];

    const unsubscribers: (() => void)[] = [];

    channelsToTrack.forEach(channelName => {
      try {
        const messagesRef = collection(db, 'chat_channels', channelName, 'messages');
        const q = query(messagesRef);

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
          if (snapshot.docs.length > 0) {
            // Mark channel as having unread messages
            setUnreadChannels(prev => new Set(prev).add(channelName));
          }
        });

        unsubscribers.push(unsubscribe);
      } catch (err) {
        // Channel doesn't exist, skip
      }
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user]);

  // Clear unread when entering a channel
  useEffect(() => {
    const channelId = location.state?.selectedChannel;
    if (channelId) {
      setUnreadChannels(prev => {
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    }
  }, [location.state?.selectedChannel]);

  return (
    <>
      {/* Desktop NavBar (hidden on mobile) */}
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

        {/* TEAMLEDER - Person with ring icon */}
        {(user?.role === 'owner' || user?.role === 'teamleder') && (
          <button 
            className="nav-button"
            onClick={() => navigate('/teamleder')}
            title="Teamleder"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4"/><circle cx="12" cy="12" r="10"/>
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

        {/* CHAT SECTION HEADER */}
        <div style={{
          textAlign: 'center',
          color: '#999',
          fontSize: '0.7rem',
          fontWeight: '700',
          letterSpacing: '1px',
          margin: '0.5rem 0 0.25rem',
          opacity: 0.8,
        }}>
          CHAT
        </div>

        {/* GLOBAL CHAT - Globe icon */}
        <button 
          className={`nav-button ${unreadChannels.has('global') ? 'unread' : ''}`}
          onClick={() => navigate('/chat', { state: { selectedChannel: 'global' } })}
          title="Global"
        >
          <div className="icon-circle">
            {unreadChannels.has('global') && <div className="unread-halo"></div>}
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <div className="nav-tooltip">Global</div>
        </button>

        {/* KRS CHAT - Owner only */}
        {user?.role === 'owner' && (
          <button 
            className={`nav-button ${unreadChannels.has('dept-krs') ? 'unread' : ''}`}
            onClick={() => navigate('/chat', { state: { selectedChannel: 'dept-krs' } })}
            title="KRS"
          >
            <div className="avdeling-circle">
              {unreadChannels.has('dept-krs') && <div className="unread-halo"></div>}
              KRS
            </div>
            <div className="nav-tooltip">KRS</div>
          </button>
        )}

        {/* OSL CHAT - Owner only */}
        {user?.role === 'owner' && (
          <button 
            className={`nav-button ${unreadChannels.has('dept-osl') ? 'unread' : ''}`}
            onClick={() => navigate('/chat', { state: { selectedChannel: 'dept-osl' } })}
            title="OSL"
          >
            <div className="avdeling-circle">
              {unreadChannels.has('dept-osl') && <div className="unread-halo"></div>}
              OSL
            </div>
            <div className="nav-tooltip">OSL</div>
          </button>
        )}

        {/* SKN CHAT - Owner only */}
        {user?.role === 'owner' && (
          <button 
            className={`nav-button ${unreadChannels.has('dept-skien') ? 'unread' : ''}`}
            onClick={() => navigate('/chat', { state: { selectedChannel: 'dept-skien' } })}
            title="SKN"
          >
            <div className="avdeling-circle">
              {unreadChannels.has('dept-skien') && <div className="unread-halo"></div>}
              SKN
            </div>
            <div className="nav-tooltip">SKN</div>
          </button>
        )}

        {/* AVDELING CHAT - Circle with text (user's department) */}
        {user?.department && user.department !== 'MUON' && (
          <button 
            className="nav-button"
            onClick={() => navigate('/chat', { state: { selectedChannel: `dept-${(user.department || '').toLowerCase()}` } })}
            title={`${user?.department} Chat`}
          >
            <div className="avdeling-circle">{user.department === 'KRS' ? 'KRS' : user.department === 'OSL' ? 'OSL' : 'SKN'}</div>
            <div className="nav-tooltip">{user.department}</div>
          </button>
        )}

        {/* DM - Chat message icon */}
        <button 
          className={`nav-button ${unreadChannels.has('dm-list') ? 'unread' : ''}`}
          onClick={() => navigate('/chat', { state: { selectedDM: 'list' } })}
          title="Direct Messages"
        >
          <div className="icon-circle">
            {unreadChannels.has('dm-list') && <div className="unread-halo"></div>}
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="nav-tooltip">DM</div>
        </button>

        {/* PROSJEKT CHAT - Briefcase icon */}
        {user?.project && (
          <button 
            className={`nav-button ${unreadChannels.has('project-allente') ? 'unread' : ''}`}
            onClick={() => {
              // BOTH MUON and Allente users go to project-allente channel
              // This allows organization-wide Allente discussions
              navigate('/chat', { state: { selectedChannel: 'project-allente' } });
            }}
            title="Allente"
          >
            <div className="icon-circle">
              {unreadChannels.has('project-allente') && <div className="unread-halo"></div>}
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div className="nav-tooltip">Allente</div>
          </button>
        )}

        {/* TEAMLEDERE CHAT - People icon */}
        {(user?.role === 'owner' || user?.role === 'teamleder') && (
          <button 
            className={`nav-button ${unreadChannels.has('team') ? 'unread' : ''}`}
            onClick={() => navigate('/chat', { state: { selectedChannel: 'team' } })}
            title="Teamledere"
          >
            <div className="icon-circle">
              {unreadChannels.has('team') && <div className="unread-halo"></div>}
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="nav-tooltip">Teamledere</div>
          </button>
        )}

        {/* ADMIN CHAT - Lock icon */}
        {(user?.role === 'owner') && (
          <button 
            className={`nav-button ${unreadChannels.has('admin') ? 'unread' : ''}`}
            onClick={() => navigate('/chat', { state: { selectedChannel: 'admin' } })}
            title="Admin"
          >
            <div className="icon-circle">
              {unreadChannels.has('admin') && <div className="unread-halo"></div>}
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="nav-tooltip">Admin</div>
          </button>
        )}
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
                  <circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4"/><circle cx="12" cy="12" r="10"/>
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

            <hr style={{ margin: '1rem 0', borderColor: '#eee' }} />

            {/* GLOBAL CHAT */}
            <button
              className={`mobile-nav-button ${unreadChannels.has('global') ? 'unread' : ''}`}
              onClick={() => { navigate('/chat', { state: { selectedChannel: 'global' } }); setIsMobileMenuOpen(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>Global</span>
            </button>

            {/* KRS, OSL, SKN - Owner only */}
            {user?.role === 'owner' && (
              <>
                <button
                  className={`mobile-nav-button ${unreadChannels.has('dept-krs') ? 'unread' : ''}`}
                  onClick={() => { navigate('/chat', { state: { selectedChannel: 'dept-krs' } }); setIsMobileMenuOpen(false); }}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>KRS</div>
                  <span>KRS</span>
                </button>

                <button
                  className={`mobile-nav-button ${unreadChannels.has('dept-osl') ? 'unread' : ''}`}
                  onClick={() => { navigate('/chat', { state: { selectedChannel: 'dept-osl' } }); setIsMobileMenuOpen(false); }}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>OSL</div>
                  <span>OSL</span>
                </button>
              </>
            )}

            {user?.role === 'owner' && (
              <button
                className={`mobile-nav-button ${unreadChannels.has('dept-skien') ? 'unread' : ''}`}
                onClick={() => { navigate('/chat', { state: { selectedChannel: 'dept-skien' } }); setIsMobileMenuOpen(false); }}
              >
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>SKN</div>
                <span>SKN</span>
              </button>
            )}

            {/* DM */}
            <button
              className={`mobile-nav-button ${unreadChannels.has('dm-list') ? 'unread' : ''}`}
              onClick={() => { navigate('/chat', { state: { selectedDM: 'list' } }); setIsMobileMenuOpen(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>DM</span>
            </button>

            {/* ALLENTE */}
            {user?.project && (
              <button
                className={`mobile-nav-button ${unreadChannels.has('project-allente') ? 'unread' : ''}`}
                onClick={() => { navigate('/chat', { state: { selectedChannel: 'project-allente' } }); setIsMobileMenuOpen(false); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
                <span>Allente</span>
              </button>
            )}

            {/* TEAMLEDERE */}
            {(user?.role === 'owner' || user?.role === 'teamleder') && (
              <button
                className={`mobile-nav-button ${unreadChannels.has('team') ? 'unread' : ''}`}
                onClick={() => { navigate('/chat', { state: { selectedChannel: 'team' } }); setIsMobileMenuOpen(false); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>Teamledere</span>
              </button>
            )}

            {/* ADMIN CHAT */}
            {(user?.role === 'owner') && (
              <button
                className={`mobile-nav-button ${unreadChannels.has('admin') ? 'unread' : ''}`}
                onClick={() => { navigate('/chat', { state: { selectedChannel: 'admin' } }); setIsMobileMenuOpen(false); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Admin Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
