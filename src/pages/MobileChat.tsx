import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileChat.css';

interface Channel {
  id: string;
  name: string;
  emoji: string;
  unreadCount: number;
}

interface DM {
  name: string;
  unreadCount: number;
}

export default function MobileChat() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DM[]>([]);
  // Default to channels tab (user came from channel, usually)
  const [activeTab, setActiveTab] = useState<'dms' | 'channels'>(() => {
    const saved = localStorage.getItem('mobile_chat_active_tab');
    return (saved as 'dms' | 'channels') || 'channels';
  });

  // Ensure all channels exist in Firestore (same setup as Global)
  useEffect(() => {
    const ensureChannels = async () => {
      const channelDefs = [
        { id: 'global', name: 'Global', emoji: '🌍' },
        { id: 'project-allente', name: 'Allente Chat', emoji: '🏢' },
        { id: 'dept-krs', name: 'KRS', emoji: '🏢' },
        { id: 'dept-osl', name: 'OSL', emoji: '🏢' },
        { id: 'dept-skien', name: 'Skien', emoji: '🏢' },
        { id: 'admin-channel', name: 'Admin', emoji: '⚙️' },
        { id: 'teamleder-channel', name: 'Teamleder', emoji: '👥' },
      ];

      // Create all channel documents with EXACT same structure as Global
      for (const ch of channelDefs) {
        try {
          const channelDoc = doc(db, 'chat_channels', ch.id);
          await setDoc(channelDoc, {
            // Exact fields that Global should have
            id: ch.id,
            name: ch.name,
            emoji: ch.emoji,
            type: 'global', // Same as Global
            unread: 0,
            createdAt: serverTimestamp(),
            lastMessage: '',
            lastMessageTime: serverTimestamp()
          }, { merge: true });
          
          console.log('✅ Channel created with Global structure:', ch.id);
        } catch (error) {
          console.error('❌ Error creating channel:', ch.id, error);
        }
      }

      // Now load them
      const channelList: Channel[] = channelDefs.map(ch => ({
        ...ch,
        unreadCount: 0
      }));

      // Update unread counts from localStorage
      channelList.forEach(ch => {
        const stored = localStorage.getItem(`chat_unread_${ch.id}`);
        if (stored) {
          ch.unreadCount = parseInt(stored, 10);
        }
      });

      setChannels(channelList);
    };

    ensureChannels();
  }, []);

  // Load DMs
  useEffect(() => {
    const loadDMs = () => {
      const dmList: { [key: string]: DM } = {};
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('chat_unread_dm_')) {
          const name = key.replace('chat_unread_dm_', '');
          const count = parseInt(localStorage.getItem(key) || '0', 10);
          dmList[name] = { name, unreadCount: count };
        }
      });

      // Sort by unread first
      const sorted = Object.values(dmList).sort((a, b) => b.unreadCount - a.unreadCount);
      setDMs(sorted);
    };

    loadDMs();
  }, []);

  // Listen for updates
  useEffect(() => {
    const handleUpdate = () => {
      // Update DMs
      const dmList: { [key: string]: DM } = {};
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('chat_unread_dm_')) {
          const name = key.replace('chat_unread_dm_', '');
          const count = parseInt(localStorage.getItem(key) || '0', 10);
          dmList[name] = { name, unreadCount: count };
        }
      });
      const sorted = Object.values(dmList).sort((a, b) => b.unreadCount - a.unreadCount);
      setDMs(sorted);

      // Update channels
      setChannels(prev =>
        prev.map(ch => ({
          ...ch,
          unreadCount: parseInt(localStorage.getItem(`chat_unread_${ch.id}`) || '0', 10)
        }))
      );
    };

    window.addEventListener('chatUnreadUpdated', handleUpdate);
    return () => window.removeEventListener('chatUnreadUpdated', handleUpdate);
  }, []);

  return (
    <div className="mobile-chat">
      <div className="mobile-chat-header">
        <button className="back-button" onClick={() => navigate('/home')}>
          ← Tilbake
        </button>
        <h1>Chat</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="mobile-chat-tabs">
        <button
          className={`tab ${activeTab === 'dms' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('dms');
            localStorage.setItem('mobile_chat_active_tab', 'dms');
          }}
        >
          💬 DM ({dms.filter(d => d.unreadCount > 0).length})
        </button>
        <button
          className={`tab ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('channels');
            localStorage.setItem('mobile_chat_active_tab', 'channels');
          }}
        >
          📢 Channels ({channels.filter(c => c.unreadCount > 0).length})
        </button>
      </div>

      <div className="mobile-chat-list">
        {activeTab === 'dms' ? (
          dms.length > 0 ? (
            dms.map(dm => (
              <button
                key={dm.name}
                className="chat-list-item"
                onClick={() => navigate(`/home/chat/dm/${encodeURIComponent(dm.name)}`)}
              >
                <div className="chat-list-avatar">👤</div>
                <div className="chat-list-info">
                  <div className="chat-list-name">{dm.name}</div>
                </div>
                {dm.unreadCount > 0 && (
                  <div className="chat-list-badge">{dm.unreadCount}</div>
                )}
              </button>
            ))
          ) : (
            <div className="empty-state">Ingen DM-er ennå</div>
          )
        ) : (
          channels.map(ch => (
            <button
              key={ch.id}
              className="chat-list-item"
              onClick={() => navigate(`/home/chat/channel/${ch.id}`)}
            >
              <div className="chat-list-avatar">{ch.emoji}</div>
              <div className="chat-list-info">
                <div className="chat-list-name">{ch.name}</div>
              </div>
              {ch.unreadCount > 0 && (
                <div className="chat-list-badge">{ch.unreadCount}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
