import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [activeTab, setActiveTab] = useState<'dms' | 'channels'>('dms');

  // Load channels (hardcoded 5 main channels)
  useEffect(() => {
    const channelList: Channel[] = [
      { id: 'global', name: 'Global', emoji: '🌍', unreadCount: 0 },
      { id: 'project-allente', name: 'Allente Chat', emoji: '🏢', unreadCount: 0 },
      { id: 'dept-krs', name: 'KRS', emoji: '🏢', unreadCount: 0 },
      { id: 'dept-osl', name: 'OSL', emoji: '🏢', unreadCount: 0 },
      { id: 'dept-skien', name: 'Skien', emoji: '🏢', unreadCount: 0 },
    ];

    // Update unread counts from localStorage
    channelList.forEach(ch => {
      const stored = localStorage.getItem(`chat_unread_${ch.id}`);
      if (stored) {
        ch.unreadCount = parseInt(stored, 10);
      }
    });

    setChannels(channelList);
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
