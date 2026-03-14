import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

// Allowed channel IDs that should display
const ALLOWED_CHANNELS = [
  'global',
  'project-allente',
  'dept-krs',
  'dept-osl',
  'dept-skien',
  'admin-channel',
  'teamleder-channel',
];

// Default emoji mapping for channels (matches PC spec)
const CHANNEL_EMOJIS: { [key: string]: string } = {
  'global': '🌍',
  'project-allente': '🏢',
  'dept-krs': '🏝️',
  'dept-osl': '🏢',
  'dept-skien': '🏭',
  'admin-channel': '⚙️',
  'teamleder-channel': '👥',
};

export default function MobileChat() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  // Default to channels tab (user came from channel, usually)
  const [activeTab, setActiveTab] = useState<'dms' | 'channels'>(() => {
    const saved = localStorage.getItem('mobile_chat_active_tab');
    return (saved as 'dms' | 'channels') || 'channels';
  });

  // Ensure all 7 channels exist in Firestore (matching PC specification)
  const ensureChannels = async () => {
    const channelDefinitions = [
      { id: 'global', name: 'Global', type: 'global', emoji: '🌍' },
      { id: 'project-allente', name: 'Allente Chat', type: 'project', project: 'Allente', emoji: '🏢' },
      { id: 'dept-krs', name: 'KRS', type: 'avdeling', avdeling: 'KRS', emoji: '🏝️' },
      { id: 'dept-osl', name: 'OSL', type: 'avdeling', avdeling: 'OSL', emoji: '🏢' },
      { id: 'dept-skien', name: 'Skien', type: 'avdeling', avdeling: 'Skien', emoji: '🏭' },
      { id: 'admin-channel', name: 'Admin', type: 'admin', emoji: '⚙️' },
      { id: 'teamleder-channel', name: 'Teamleder', type: 'team', emoji: '👥' },
    ];

    try {
      for (const ch of channelDefinitions) {
        const channelRef = doc(db, 'chat_channels', ch.id);
        await setDoc(channelRef, {
          id: ch.id,
          name: ch.name,
          type: ch.type,
          emoji: ch.emoji,
          ...(ch.project && { project: ch.project }),
          ...(ch.avdeling && { avdeling: ch.avdeling }),
          createdAt: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
        }, { merge: true });
      }
      console.log('✅ Ensured all 7 channels exist (matching PC spec)');
    } catch (error) {
      console.error('❌ Error ensuring channels:', error);
    }
  };

  // Load channels from Firestore (same as PC Chat)
  useEffect(() => {
    const loadChannels = async () => {
      try {
        setLoading(true);
        
        // First ensure all channels exist
        await ensureChannels();
        
        // Then load them
        const channelsRef = collection(db, 'chat_channels');
        const snapshot = await getDocs(channelsRef);
        
        const channelList: Channel[] = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const id = data.id || doc.id;
          
          // Only include whitelisted channels
          if (ALLOWED_CHANNELS.includes(id)) {
            const unreadKey = `chat_unread_${id}`;
            const unreadCount = parseInt(localStorage.getItem(unreadKey) || '0', 10);
            
            channelList.push({
              id,
              name: data.name || id,
              emoji: CHANNEL_EMOJIS[id] || '📌',
              unreadCount,
            });
          }
        });
        
        // Sort by ALLOWED_CHANNELS order
        channelList.sort((a, b) => {
          const indexA = ALLOWED_CHANNELS.indexOf(a.id);
          const indexB = ALLOWED_CHANNELS.indexOf(b.id);
          return indexA - indexB;
        });
        
        console.log('✅ Loaded channels from Firestore:', channelList.length, 'channels');
        setChannels(channelList);
      } catch (error) {
        console.error('❌ Error loading channels:', error);
        // Fallback to empty
        setChannels([]);
      } finally {
        setLoading(false);
      }
    };

    loadChannels();
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
        ) : loading ? (
          <div className="empty-state">Laster kanaler...</div>
        ) : channels.length > 0 ? (
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
        ) : (
          <div className="empty-state">Ingen kanaler funnet</div>
        )}
      </div>
    </div>
  );
}
