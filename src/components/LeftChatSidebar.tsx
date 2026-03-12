import React from 'react';
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

export const LeftChatSidebar: React.FC<LeftChatSidebarProps> = ({ isOpen }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setIsChatSidebarOpen } = useChatSidebar();
  const { totalDMUnread: contextDMUnread } = useDMUnread(); // Get DM unread from context
  const { channelUnreadCounts: contextChannelUnread } = useChannelUnread(); // Get channel unread from context

  // Use Context data directly - Chat.tsx syncs to context
  // No fallbacks needed - if Chat loaded, context has data
  const dmUnreadCount = contextDMUnread;
  const channelUnread = contextChannelUnread;

  console.log('📊 Sidebar - Context data:', { contextDM: contextDMUnread, contextChannels: contextChannelUnread });

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
      </div>

      {/* Global Channel */}
      <div className="channel-section">
        <button
          className="channel-circle"
          onClick={() => handleChannelClick('global')}
          title="Global"
          style={{ position: 'relative' }}
        >
          🌍
          {channelUnread['global'] > 0 && (
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
            className="channel-circle"
            onClick={() => handleChannelClick('project-allente')}
            title="Allente"
          >
            📊
          </button>
        </div>
      )}
    </div>
  );
};
