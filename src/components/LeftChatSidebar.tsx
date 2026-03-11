import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import '../styles/LeftChatSidebar.css';

interface LeftChatSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const LeftChatSidebar: React.FC<LeftChatSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    console.log('🟦 LeftChatSidebar isOpen changed:', isOpen);
  }, [isOpen]);

  const handleChannelClick = (channelId: string) => {
    navigate('/chat', { state: { selectedChannel: channelId } });
    if (onClose) onClose();
  };

  const handleDMClick = () => {
    navigate('/chat', { state: { selectedDM: 'list' } });
    if (onClose) onClose();
  };

  return (
    <div className={`left-chat-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-content">
        {/* HEADER */}
        <div className="sidebar-header">
          <h2>💬 Chat</h2>
          {onClose && (
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {/* GLOBAL SECTION */}
        <div className="channel-section">
          <h3 className="section-title">🌍 GLOBAL</h3>
          <button 
            className="channel-button"
            onClick={() => handleChannelClick('global')}
          >
            <span className="channel-icon">🌐</span>
            <span className="channel-name">Global</span>
          </button>
        </div>

        {/* DEPARTMENTS SECTION (Owner only) */}
        {user?.role === 'owner' && (
          <div className="channel-section">
            <h3 className="section-title">📍 AVDELINGER</h3>
            <button 
              className="channel-button"
              onClick={() => handleChannelClick('dept-krs')}
            >
              <span className="channel-circle">KRS</span>
              <span className="channel-name">KRS</span>
            </button>
            <button 
              className="channel-button"
              onClick={() => handleChannelClick('dept-osl')}
            >
              <span className="channel-circle">OSL</span>
              <span className="channel-name">OSL</span>
            </button>
            <button 
              className="channel-button"
              onClick={() => handleChannelClick('dept-skien')}
            >
              <span className="channel-circle">SKN</span>
              <span className="channel-name">Skien</span>
            </button>
          </div>
        )}

        {/* USER'S DEPARTMENT */}
        {user?.department && user.department !== 'MUON' && user?.role !== 'owner' && (
          <div className="channel-section">
            <h3 className="section-title">📍 MIN AVDELING</h3>
            <button 
              className="channel-button"
              onClick={() => handleChannelClick(`dept-${(user.department || '').toLowerCase()}`)}
            >
              <span className="channel-circle">
                {user.department === 'KRS' ? 'KRS' : user.department === 'OSL' ? 'OSL' : 'SKN'}
              </span>
              <span className="channel-name">{user.department}</span>
            </button>
          </div>
        )}

        {/* PROJECTS */}
        {user?.project && (
          <div className="channel-section">
            <h3 className="section-title">💼 PROSJEKTER</h3>
            <button 
              className="channel-button"
              onClick={() => handleChannelClick('project-allente')}
            >
              <span className="channel-icon">📊</span>
              <span className="channel-name">Allente</span>
            </button>
          </div>
        )}

        {/* TEAMS */}
        {(user?.role === 'owner' || user?.role === 'teamleder') && (
          <div className="channel-section">
            <h3 className="section-title">👥 TEAM</h3>
            <button 
              className="channel-button"
              onClick={() => handleChannelClick('team')}
            >
              <span className="channel-icon">👥</span>
              <span className="channel-name">Teamledere</span>
            </button>
          </div>
        )}

        {/* ADMIN */}
        {user?.role === 'owner' && (
          <div className="channel-section">
            <h3 className="section-title">🔒 ADMIN</h3>
            <button 
              className="channel-button"
              onClick={() => handleChannelClick('admin')}
            >
              <span className="channel-icon">🔒</span>
              <span className="channel-name">Admin</span>
            </button>
          </div>
        )}

        {/* DIRECT MESSAGES */}
        <div className="channel-section">
          <h3 className="section-title">💬 DIREKTEMELDINGER</h3>
          <button 
            className="channel-button"
            onClick={handleDMClick}
          >
            <span className="channel-icon">✉️</span>
            <span className="channel-name">Direktemeldinger</span>
          </button>
        </div>
      </div>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={onClose}
        />
      )}
    </div>
  );
};
