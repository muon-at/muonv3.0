import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { useChatSidebar } from '../lib/ChatSidebarContext';
import { useDMUnread } from '../lib/DMUnreadContext';
import { useChannelUnread } from '../lib/ChannelUnreadContext';
import '../styles/LeftChatSidebar.css';

interface LeftChatSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const LeftChatSidebar: React.FC<LeftChatSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setIsChatSidebarOpen } = useChatSidebar();
  const { totalDMUnread: contextDMUnread } = useDMUnread(); // Get DM unread from context
  const { channelUnreadCounts: contextChannelUnread } = useChannelUnread(); // Get channel unread from context

  // Fallback to sessionStorage if contexts are empty
  const [fallbackChannelUnread, setFallbackChannelUnread] = useState<Record<string, number>>({});
  const [fallbackDMUnread, setFallbackDMUnread] = useState<number>(0);

  // Load from sessionStorage as fallback
  useEffect(() => {
    const loadFromSessionStorage = () => {
      const channelIds = ['global', 'project-allente', 'dept-krs', 'dept-osl', 'dept-skien'];
      const channelCounts: Record<string, number> = {};

      channelIds.forEach(channelId => {
        const stored = sessionStorage.getItem(`chat_unread_${channelId}`);
        if (stored) {
          const count = parseInt(stored, 10);
          if (count > 0) {
            channelCounts[channelId] = count;
          }
        }
      });

      setFallbackChannelUnread(channelCounts);

      // Also load total DM unread
      const allKeys = Object.keys(sessionStorage);
      let totalDM = 0;
      allKeys.forEach(key => {
        if (key.startsWith('chat_unread_dm_')) {
          const count = parseInt(sessionStorage.getItem(key) || '0', 10);
          totalDM += count;
        }
      });
      setFallbackDMUnread(totalDM);
    };

    loadFromSessionStorage();

    // Poll every 500ms
    const interval = setInterval(loadFromSessionStorage, 500);
    return () => clearInterval(interval);
  }, []);

  // Use Context data if available, otherwise fallback to sessionStorage
  const dmUnreadCount = contextDMUnread > 0 ? contextDMUnread : fallbackDMUnread;
  const channelUnread = Object.keys(contextChannelUnread).length > 0 ? contextChannelUnread : fallbackChannelUnread;

  console.log('📊 Sidebar unread state:', { contextDMUnread, contextChannelUnread, fallbackChannelUnread, fallbackDMUnread, final: { dmUnreadCount, channelUnread } });

  const handleChannelClick = (channelId: string) => {
    navigate('/chat', { state: { selectedChannel: channelId } });
    setIsChatSidebarOpen(false);
  };

  const handleDMClick = () => {
    navigate('/chat', { state: { selectedDM: 'list' } });
    setIsChatSidebarOpen(false);
  };

  return (
    <div className={`left-chat-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        CHAT
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* GLOBAL */}
      <div className="channel-section">
        <button
          className="channel-button"
          onClick={() => handleChannelClick('global')}
          title="Global"
          style={{ position: 'relative' }}
        >
          <div className="icon-circle">
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          {channelUnread['global'] > 0 && (
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
              border: '2px solid #667eea',
            }}>
              {channelUnread['global']}
            </div>
          )}
        </button>
      </div>

      {/* DEPARTMENTS (Owner only) */}
      {user?.role === 'owner' && (
        <div className="channel-section">
          <button
            className="channel-circle"
            onClick={() => handleChannelClick('dept-krs')}
            title="KRS"
            style={{ position: 'relative' }}
          >
            KRS
            {channelUnread['dept-krs'] > 0 && (
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 'bold',
              }}>
                {channelUnread['dept-krs']}
              </div>
            )}
          </button>
          <button
            className="channel-circle"
            onClick={() => handleChannelClick('dept-osl')}
            title="OSL"
            style={{ position: 'relative' }}
          >
            OSL
            {channelUnread['dept-osl'] > 0 && (
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 'bold',
              }}>
                {channelUnread['dept-osl']}
              </div>
            )}
          </button>
          <button
            className="channel-circle"
            onClick={() => handleChannelClick('dept-skien')}
            title="SKN"
            style={{ position: 'relative' }}
          >
            SKN
            {channelUnread['dept-skien'] > 0 && (
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 'bold',
              }}>
                {channelUnread['dept-skien']}
              </div>
            )}
          </button>
        </div>
      )}

      {/* USER'S DEPARTMENT (non-owner) */}
      {user?.department && user.department !== 'MUON' && user?.role !== 'owner' && (
        <div className="channel-section">
          <button 
            className="channel-circle"
            onClick={() => handleChannelClick(`dept-${(user.department || '').toLowerCase()}`)}
            title={user.department}
          >
            {user.department === 'KRS' ? 'KRS' : user.department === 'OSL' ? 'OSL' : 'SKN'}
          </button>
        </div>
      )}

      {/* DM */}
      <div className="channel-section">
        <button 
          className="channel-button"
          onClick={handleDMClick}
          title="Direct Messages"
          style={{ position: 'relative' }}
        >
          <div className="icon-circle">
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          {dmUnreadCount > 0 && (
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
              border: '2px solid #667eea',
            }}>
              {dmUnreadCount}
            </div>
          )}
        </button>
      </div>

      {/* PROJECTS */}
      {user?.project && (
        <div className="channel-section">
          <button
            className="channel-button"
            onClick={() => handleChannelClick('project-allente')}
            title="Allente"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* TEAMS */}
      {(user?.role === 'owner' || user?.role === 'teamleder') && (
        <div className="channel-section">
          <button
            className="channel-button"
            onClick={() => handleChannelClick('team')}
            title="Teamledere"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* ADMIN */}
      {user?.role === 'owner' && (
        <div className="channel-section">
          <button
            className="channel-button"
            onClick={() => handleChannelClick('admin')}
            title="Admin"
          >
            <div className="icon-circle">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </button>
        </div>
      )}

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
