import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { useChatSidebar } from '../lib/ChatSidebarContext';
import { useDMUnread } from '../lib/DMUnreadContext';
import { useChannelUnread } from '../lib/ChannelUnreadContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
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

  // Use Context data if available, fallback to localStorage
  const dmUnreadCount = contextDMUnread > 0 ? contextDMUnread : (() => {
    let total = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('chat_unread_dm_')) {
        total += parseInt(localStorage.getItem(key) || '0', 10);
      }
    });
    return total;
  })();

  const channelUnread = Object.keys(contextChannelUnread).length > 0 ? contextChannelUnread : (() => {
    const counts: Record<string, number> = {};
    const channelIds = ['global', 'project-allente', 'dept-krs', 'dept-osl', 'dept-skien'];
    channelIds.forEach(id => {
      const stored = localStorage.getItem(`chat_unread_${id}`);
      if (stored) {
        const count = parseInt(stored, 10);
        if (count > 0) {
          counts[id] = count;
        }
      }
    });
    return counts;
  })();

  console.log('📊 Sidebar - Using:', {
    dmFromContext: contextDMUnread,
    dmFallback: dmUnreadCount,
    channelsFromContext: Object.keys(contextChannelUnread).length,
    channelsFallback: Object.keys(channelUnread).length
  });

  const handleChannelClick = (channelId: string) => {
    navigate('/chat', { state: { selectedChannel: channelId } });
    setIsChatSidebarOpen(false);
  };

  const handleDMClick = () => {
    navigate('/chat', { state: { selectedDM: 'list' } });
    setIsChatSidebarOpen(false);
  };

  // REAL-TIME listener for DM unread count changes (MOVED HERE so it runs on Sidebar, always visible)
  useEffect(() => {
    console.log('🔍 DM listener useEffect in Sidebar - user.name:', user?.name);
    
    if (!user?.name) {
      console.log('⚠️ DM listener skipped - no user.name');
      return;
    }

    console.log('✅ DM listener starting in Sidebar - looking for user:', user.name);
    const dmsRef = collection(db, 'chat_dms');
    const unsubscribe = onSnapshot(dmsRef, (snapshot) => {
      console.log(`📋 DM snapshot received - ${snapshot.size} total DM documents`);
      const dmUnread: Record<string, number> = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const userInParticipants = data.participants?.includes(user.name);
        
        console.log(`  📄 Checking DM ${doc.id}:`);
        console.log(`      participants array: [${data.participants?.join(', ')}]`);
        console.log(`      looking for: "${user.name}"`);
        console.log(`      match: ${userInParticipants}`);
        
        // Check if current user is participant
        if (!data.participants || !userInParticipants) {
          console.log(`      ⏭️ Skipped - user.name "${user.name}" not in participants`);
          return;
        }

        // Get unread count for this user
        const unreadCount = (data.unread && data.unread[user.name]) || 0;
        console.log(`      ✅ Found user in participants - unreadCount: ${unreadCount}`);
        
        // Use other participant's name as key
        const otherParticipant = data.participants.find((p: string) => p !== user.name);
        if (otherParticipant) {
          if (unreadCount > 0) {
            dmUnread[otherParticipant] = unreadCount;
          }
          
          // Always update localStorage (even if 0!) - so navbar knows it's been cleared
          localStorage.setItem(`chat_unread_dm_${otherParticipant}`, unreadCount.toString());
          console.log(`      💾 Updated localStorage: chat_unread_dm_${otherParticipant} = ${unreadCount}`);
        }
      });
      
      // Trigger custom event so navbar can update INSTANTLY
      console.log('📡 Dispatching chatUnreadUpdated event for DMs:', dmUnread);
      window.dispatchEvent(new CustomEvent('chatUnreadUpdated', { detail: { dmUnread } }));
      
      console.log('💬 DM unread counts updated (real-time):', dmUnread);
    });

    return () => unsubscribe();
  }, [user?.name]);

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
