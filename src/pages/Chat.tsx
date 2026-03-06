import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import '../styles/Chat.css';

interface Channel {
  id: string;
  name: string;
  type: 'project' | 'team' | 'admin' | 'avdeling' | 'global';
  unread: number;
}

// DM interface - coming soon
// interface DM {
//   id: string;
//   participant: string;
//   unread: number;
// }

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  reactions?: Record<string, string[]>;
}

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  // const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  // const [dms, setDMs] = useState<DM[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Load channels on mount
  useEffect(() => {
    loadChannels();
  }, [user]);

  // Load messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      loadChannelMessages(selectedChannel);
    }
  }, [selectedChannel]);

  const loadChannels = async () => {
    try {
      const channelsRef = collection(db, 'chat_channels');
      const snapshot = await getDocs(channelsRef);
      
      const allowedChannels: Channel[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const canAccess = checkChannelAccess(data.type, data.avdeling);
        
        if (canAccess) {
          allowedChannels.push({
            id: doc.id,
            name: data.name,
            type: data.type,
            unread: 0, // TODO: implement unread count
          });
        }
      });
      
      setChannels(allowedChannels);
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const checkChannelAccess = (type: string, avdeling?: string): boolean => {
    switch (type) {
      case 'project':
        return true; // All employees can see
      case 'team':
        return user?.role === 'teamlead' || user?.role === 'owner';
      case 'admin':
        return user?.role === 'owner';
      case 'avdeling':
        return (user as any)?.department === avdeling || user?.role === 'owner';
      case 'global':
        return true;
      default:
        return false;
    }
  };

  const loadChannelMessages = async (channelId: string) => {
    try {
      const messagesRef = collection(db, 'chat_channels', channelId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach(doc => {
          msgs.push({
            id: doc.id,
            ...doc.data() as any,
          });
        });
        setMessages(msgs);
      });
      
      return unsubscribe;
    } catch (err) {
      console.error('Error loading channel messages:', err);
    }
  };

  // DM messages loading - coming soon
  // const loadDMMessages = async (dmId: string) => {
  //   try {
  //     const messagesRef = collection(db, 'chat_dms', dmId, 'messages');
  //     const q = query(messagesRef, orderBy('timestamp', 'asc'));
  //     
  //     const unsubscribe = onSnapshot(q, (snapshot) => {
  //       const msgs: Message[] = [];
  //       snapshot.forEach(doc => {
  //         msgs.push({
  //           id: doc.id,
  //           ...doc.data() as any,
  //         });
  //       });
  //       setMessages(msgs);
  //     });
  //     
  //     return unsubscribe;
  //   } catch (err) {
  //     console.error('Error loading DM messages:', err);
  //   }
  // };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      if (selectedChannel) {
        const messagesRef = collection(db, 'chat_channels', selectedChannel, 'messages');
        await addDoc(messagesRef, {
          sender: user?.name || 'Unknown',
          content: newMessage,
          timestamp: Date.now(),
        });
      }
      
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <h1>💬 Chat</h1>
        <button 
          onClick={() => navigate('/min-side')}
          style={{
            padding: '0.5rem 1rem',
            background: '#667eea',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Min Side
        </button>
      </div>

      <div className="chat-content">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-tabs">
            <button
              className={`chat-tab ${activeTab === 'channels' ? 'active' : ''}`}
              onClick={() => setActiveTab('channels')}
            >
              # Kanaler
            </button>
            <button
              className={`chat-tab ${activeTab === 'dms' ? 'active' : ''}`}
              onClick={() => setActiveTab('dms')}
            >
              💬 DM
            </button>
          </div>

          {activeTab === 'channels' && (
            <div className="chat-list">
              {channels.map(channel => (
                <div
                  key={channel.id}
                  className={`chat-item ${selectedChannel === channel.id ? 'active' : ''}`}
                  onClick={() => setSelectedChannel(channel.id)}
                >
                  <span className="chat-name"># {channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="chat-unread">{channel.unread}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dms' && (
            <div className="chat-list">
              <p style={{ padding: '1rem', color: '#999', fontSize: '0.85rem' }}>
                DM-funksjonalitet kommer snart
              </p>
            </div>
          )}
        </div>

        {/* Message Area */}
        <div className="chat-main">
          {selectedChannel ? (
            <>
              {/* Messages */}
              <div className="messages-area">
                {messages.map(msg => (
                  <div key={msg.id} className="message">
                    <div className="message-header">
                      <span className="message-sender">{msg.sender}</span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-content">{msg.content}</div>
                    {msg.reactions && (
                      <div className="message-reactions">
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button key={emoji} className="reaction-button">
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="message-input-area">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Skriv melding... (Shift+Enter for ny linje)"
                  className="message-input"
                />
                <button
                  onClick={sendMessage}
                  className="send-button"
                  disabled={!newMessage.trim()}
                >
                  📤 Send
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
              Velg en kanal
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
