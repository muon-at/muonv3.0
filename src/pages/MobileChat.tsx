import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs } from 'firebase/firestore';
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
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DM[]>([]);
  const [activeTab, setActiveTab] = useState<'dms' | 'channels'>('dms');

  // Check if user can access a channel (same logic as desktop Chat)
  const checkChannelAccess = (type: string, avdeling?: string, allowedUsers?: string[], project?: string): boolean => {
    if (type === 'global') return true;
    if (type === 'project' && project === 'Allente') return (user as any)?.project === 'Allente' || user?.role === 'owner';
    if (type === 'avdeling' && avdeling) return (user as any)?.avdeling === avdeling || user?.role === 'owner' || user?.role === 'teamleder';
    if (type === 'team') return user?.role === 'owner' || user?.role === 'teamleder';
    if (type === 'admin') return user?.role === 'owner';
    if (allowedUsers) return allowedUsers.includes(user?.name || '');
    return false;
  };

  // Load channels from Firestore with access control
  useEffect(() => {
    if (!user) return;

    const loadChannels = async () => {
      try {
        console.log('📡 Loading channels for user:', user.name, 'role:', user.role);
        const channelsRef = collection(db, 'chat_channels');
        const snapshot = await getDocs(channelsRef);
        
        const channelList: Channel[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          // Check if user has access to this channel
          const canAccess = checkChannelAccess(data.type, data.avdeling, data.allowedUsers, data.project);
          
          if (canAccess) {
            console.log('✅ User can access:', { id: doc.id, name: data.name, type: data.type });
            channelList.push({
              id: doc.id,
              name: data.name || doc.id,
              emoji: data.emoji || '💬',
              unreadCount: 0
            });
          } else {
            console.log('❌ User cannot access:', { id: doc.id, name: data.name, type: data.type });
          }
        });

        // Update unread counts from localStorage
        channelList.forEach(ch => {
          const stored = localStorage.getItem(`chat_unread_${ch.id}`);
          if (stored) {
            ch.unreadCount = parseInt(stored, 10);
          }
        });

        console.log('✅ Channels loaded:', channelList.length);
        setChannels(channelList);
      } catch (error) {
        console.error('❌ Error loading channels:', error);
        setChannels([]);
      }
    };

    loadChannels();
  }, [user]);

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
          onClick={() => setActiveTab('dms')}
        >
          💬 DM ({dms.filter(d => d.unreadCount > 0).length})
        </button>
        <button
          className={`tab ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveTab('channels')}
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
