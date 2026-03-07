import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import '../styles/RightNavBar.css';

export const RightNavBar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="right-nav-bar">
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

        {/* TEAMLEDER - Person with tie */}
        {(user?.role === 'owner' || user?.role === 'teamlead') && (
          <button 
            className="nav-button"
            onClick={() => navigate('/teamleder')}
            title="Teamleder"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4"/>
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
          className="nav-button"
          onClick={() => navigate('/chat', { state: { selectedChannel: 'global' } })}
          title="Global Chat"
        >
          <div className="icon-circle">
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <div className="nav-tooltip">Global Chat</div>
        </button>

        {/* KRS CHAT - Circle with text */}
        <button 
          className="nav-button"
          onClick={() => navigate('/chat', { state: { selectedChannel: 'dept-krs' } })}
          title="KRS Chat"
        >
          <div className="avdeling-circle">KRS</div>
          <div className="nav-tooltip">KRS</div>
        </button>

        {/* OSL CHAT - Circle with text */}
        <button 
          className="nav-button"
          onClick={() => navigate('/chat', { state: { selectedChannel: 'dept-osl' } })}
          title="OSL Chat"
        >
          <div className="avdeling-circle">OSL</div>
          <div className="nav-tooltip">OSL</div>
        </button>

        {/* SKN CHAT - Owner only */}
        {user?.role === 'owner' && (
          <button 
            className="nav-button"
            onClick={() => navigate('/chat', { state: { selectedChannel: 'dept-skien' } })}
            title="SKN Chat"
          >
            <div className="avdeling-circle">SKN</div>
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
          className="nav-button"
          onClick={() => navigate('/chat', { state: { selectedDM: 'list' } })}
          title="Direct Messages"
        >
          <div className="icon-circle">
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="nav-tooltip">DM</div>
        </button>

        {/* PROSJEKT CHAT - Briefcase icon */}
        {user?.project && (
          <button 
            className="nav-button"
            onClick={() => {
              const projectId = user.project === 'MUON' ? 'allente' : (user.project || '').toLowerCase();
              navigate('/chat', { state: { selectedChannel: `project-${projectId}` } });
            }}
            title={user.project === 'MUON' ? 'Allente Chat' : `${user.project} Chat`}
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div className="nav-tooltip">{user?.project === 'MUON' ? 'Allente Chat' : (user?.project ? `${user.project} Chat` : 'Prosjekt')}</div>
          </button>
        )}

        {/* TEAMLEDERE CHAT - People icon */}
        {(user?.role === 'owner' || user?.role === 'teamlead') && (
          <button 
            className="nav-button"
            onClick={() => navigate('/chat', { state: { selectedChannel: 'team' } })}
            title="Teamledere"
          >
            <div className="icon-circle">
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
            className="nav-button"
            onClick={() => navigate('/chat', { state: { selectedChannel: 'admin' } })}
            title="Admin Chat"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="nav-tooltip">Admin</div>
          </button>
        )}
      </div>
    </div>
  );
};
