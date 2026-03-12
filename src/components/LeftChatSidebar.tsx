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

  // Load from localStorage (persists across sessions) + sessionStorage as fallback
  useEffect(() => {
    const loadFromStorage = () => {
      const channelIds = ['global', 'project-allente', 'dept-krs', 'dept-osl', 'dept-skien'];
      const channelCounts: Record<string, number> = {};
      
      channelIds.forEach(channelId => {
        // Try localStorage first (persists across sessions), then sessionStorage
        const stored = localStorage.getItem(`chat_unread_${channelId}`) || sessionStorage.getItem(`chat_unread_${channelId}`);
        if (stored) {
          const count = parseInt(stored, 10);
          if (count > 0) {
            channelCounts[channelId] = count;
          }
        }
      });
      
      setFallbackChannelUnread(channelCounts);
      
      // Also load total DM unread from both storages
      const allLocalKeys = Object.keys(localStorage);
      const allSessionKeys = Object.keys(sessionStorage);
      const allKeys = new Set([...allLocalKeys, ...allSessionKeys]);
      
      let totalDM = 0;
      allKeys.forEach(key => {
        if (key.startsWith('chat_unread_dm_')) {
          const count = parseInt(localStorage.getItem(key) || sessionStorage.getItem(key) || '0', 10);
          totalDM += count;
        }
      });
      setFallbackDMUnread(totalDM);
      
      console.log('📚 Sidebar loaded from storage:', { channelCounts, totalDM });
    };

    loadFromStorage();
    
    // Poll every 500ms to catch updates
    const interval = setInterval(loadFromStorage, 500);
    return () => clearInterval(interval);
  }, []);

  // Load chat data directly if localStorage empty AND sidebar is open
  useEffect(() => {
    if (!isOpen) return;
    
    const hasStorageData = localStorage.getItem('chat_unread_count') !== null;
    if (hasStorageData) return; // Already has data
    
    console.log('⚡ Sidebar opened with NO stored data - loading chat data directly...');
    
    const loadChatDataDirectly = async () => {
      try {
        console.log('🔄 Starting direct Firestore load...');
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        
        // Load channels
        console.log('📊 Loading channels from Firestore...');
        const channelsRef = collection(db, 'chat_channels');
        const channelSnap = await getDocs(channelsRef);
        console.log('📋 Found', channelSnap.size, 'total channels in Firestore');
        
        let channelUnreadTotal = 0;
        let channelCount = 0;
        
        channelSnap.forEach(doc => {
          const ch = doc.data();
          const unreadCount = ch.unread || 0;
          localStorage.setItem(`chat_unread_${doc.id}`, unreadCount.toString());
          channelUnreadTotal += unreadCount;
          channelCount++;
          if (unreadCount > 0) {
            console.log(`  - ${doc.id}: unread=${unreadCount} ⚠️`);
          }
        });
        console.log('✅ Wrote', channelCount, 'channels, channel unread total:', channelUnreadTotal);
        
        // Load DMs
        console.log('📞 Loading DMs from Firestore...');
        const dmsRef = collection(db, 'chat_dms');
        const dmSnap = await getDocs(dmsRef);
        console.log('📋 Found', dmSnap.size, 'total DMs in Firestore');
        
        let dmUnreadTotal = 0;
        let dmCount = 0;
        dmSnap.forEach(doc => {
          const dm = doc.data();
          if (dm.participants && dm.participants.includes(user?.name)) {
            const otherParticipant = dm.participants.find((p: string) => p !== user?.name);
            const unreadCount = (user?.name && dm.unread?.[user.name]) || 0;
            localStorage.setItem(`chat_unread_dm_${otherParticipant}`, unreadCount.toString());
            dmUnreadTotal += unreadCount;
            dmCount++;
            if (unreadCount > 0) {
              console.log(`  - ${otherParticipant}: unread=${unreadCount}`);
            }
          }
        });
        console.log('✅ Wrote', dmCount, 'DMs, DM unread total:', dmUnreadTotal);
        
        const totalUnread = channelUnreadTotal + dmUnreadTotal;
        localStorage.setItem('chat_unread_count', totalUnread.toString());
        console.log('🎉 Direct load complete!');
        console.log('   Channels:', channelCount, '| Unread:', channelUnreadTotal);
        console.log('   DMs:', dmCount, '| Unread:', dmUnreadTotal);
        console.log('   TOTAL UNREAD:', totalUnread);
      } catch (err) {
        console.error('❌ Error loading chat data:', err);
      }
    };
    
    loadChatDataDirectly();
  }, [isOpen, user?.name]);

  // Use Context data if available, otherwise fallback to localStorage/sessionStorage
  const dmUnreadCount = contextDMUnread > 0 ? contextDMUnread : fallbackDMUnread;
  const channelUnread = Object.keys(contextChannelUnread).length > 0 ? contextChannelUnread : fallbackChannelUnread;

  console.log('📊 Sidebar DEBUG:', {
    contextDM: contextDMUnread,
    contextChannels: contextChannelUnread,
    fallbackChannels: fallbackChannelUnread,
    fallbackDM: fallbackDMUnread,
    usingContext: Object.keys(contextChannelUnread).length > 0,
    final: { dmUnreadCount, channelUnread },
    localStorageData: {
      total: localStorage.getItem('chat_unread_count'),
      global: localStorage.getItem('chat_unread_global'),
      krs: localStorage.getItem('chat_unread_dept-krs'),
      dms: Object.keys(localStorage).filter(k => k.startsWith('chat_unread_dm_'))
    }
  });

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
