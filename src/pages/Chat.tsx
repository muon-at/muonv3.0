import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, onSnapshot, query, orderBy, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import '../styles/Chat.css';

interface Channel {
  id: string;
  name: string;
  type: 'project' | 'team' | 'admin' | 'avdeling' | 'global';
  unread: number;
}

interface DMThread {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: number;
  unread: number;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  reactions?: Record<string, string[]>;
  replyTo?: {
    id: string;
    sender: string;
    content: string;
  };
  attachments?: {
    type: 'file' | 'gif';
    url: string;
    name?: string;
  }[];
  typingUsers?: string[];
}

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedDM, setSelectedDM] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DMThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isPickingGif, setIsPickingGif] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load channels on mount
  useEffect(() => {
    const load = async () => {
      await loadChannels();
      await loadDMs();
    };
    load();
  }, [user]);

  // Load messages when channel/DM changes
  useEffect(() => {
    if (selectedChannel) {
      loadChannelMessages(selectedChannel);
    } else if (selectedDM) {
      loadDMMessages(selectedDM);
    }
  }, [selectedChannel, selectedDM]);

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
            unread: 0,
          });
        }
      });
      
      setChannels(allowedChannels);
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  };

  const loadDMs = async () => {
    try {
      const dmsRef = collection(db, 'chat_dms');
      const snapshot = await getDocs(dmsRef);
      
      const userDMs: DMThread[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.participants && data.participants.includes(user?.name)) {
          userDMs.push({
            id: doc.id,
            participants: data.participants,
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTime || 0,
            unread: (user?.name && data.unread?.[user.name]) || 0,
          });
        }
      });
      
      setDMs(userDMs);
    } catch (err) {
      console.error('Error loading DMs:', err);
    }
  };

  const checkChannelAccess = (type: string, avdeling?: string): boolean => {
    switch (type) {
      case 'project':
        return true;
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

  const loadDMMessages = async (dmId: string) => {
    try {
      const messagesRef = collection(db, 'chat_dms', dmId, 'messages');
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
      console.error('Error loading DM messages:', err);
    }
  };

  const sendMessage = async (content?: string) => {
    const messageContent = content || newMessage;
    console.log('📤 Send clicked! Message:', messageContent, 'Channel:', selectedChannel);
    if (!messageContent.trim()) return;
    
    try {
      if (selectedChannel) {
        console.log('📝 Sending to channel:', selectedChannel);
        const messagesRef = collection(db, 'chat_channels', selectedChannel, 'messages');
        const msgData: any = {
          sender: user?.name || 'Unknown',
          content: messageContent,
          timestamp: Date.now(),
        };
        if (replyingTo) {
          msgData.replyTo = {
            id: replyingTo.id,
            sender: replyingTo.sender,
            content: replyingTo.content,
          };
        }
        await addDoc(messagesRef, msgData);
        console.log('✅ Message sent successfully!');
      } else if (selectedDM) {
        console.log('📝 Sending to DM:', selectedDM);
        const messagesRef = collection(db, 'chat_dms', selectedDM, 'messages');
        const msgData: any = {
          sender: user?.name || 'Unknown',
          content: messageContent,
          timestamp: Date.now(),
        };
        if (replyingTo) {
          msgData.replyTo = {
            id: replyingTo.id,
            sender: replyingTo.sender,
            content: replyingTo.content,
          };
        }
        await addDoc(messagesRef, msgData);
        console.log('✅ Message sent successfully!');
      }
      
      setNewMessage('');
      setReplyingTo(null);
    } catch (err) {
      console.error('❌ Error sending message:', err);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifs([]);
      return;
    }
    
    try {
      console.log('🔍 Searching GIFs for:', query);
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=8&api_key=MkcEdmOnWYPUmJCPVlUvqJZIgkZv58YZ`
      );
      const data = await response.json();
      console.log('📦 GIF API Response:', data);
      if (data.data && data.data.length > 0) {
        console.log('✅ Found', data.data.length, 'GIFs');
        setGifs(data.data);
      } else {
        console.log('❌ No GIFs found');
        setGifs([]);
      }
    } catch (err) {
      console.error('❌ Error searching GIFs:', err);
      setGifs([]);
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      if (selectedChannel) {
        const msgRef = doc(db, 'chat_channels', selectedChannel, 'messages', messageId);
        const updateData: any = {};
        updateData[`reactions.${emoji}`] = arrayUnion(user?.name || 'Unknown');
        await updateDoc(msgRef, updateData);
      } else if (selectedDM) {
        const msgRef = doc(db, 'chat_dms', selectedDM, 'messages', messageId);
        const updateData: any = {};
        updateData[`reactions.${emoji}`] = arrayUnion(user?.name || 'Unknown');
        await updateDoc(msgRef, updateData);
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  };

  const insertGif = (gif: any) => {
    const gifUrl = gif.images.fixed_height.url;
    sendMessage(`[GIF] ${gifUrl}`);
    setIsPickingGif(false);
    setGifSearch('');
    setGifs([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // For demo, just add file name as message
    sendMessage(`📎 File: ${file.name}`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
                  onClick={() => {
                    setSelectedChannel(channel.id);
                    setSelectedDM(null);
                  }}
                >
                  <span className={`chat-name ${channel.unread > 0 ? 'unread' : ''}`}>
                    # {channel.name}
                  </span>
                  {channel.unread > 0 && (
                    <span className="chat-unread">{channel.unread}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dms' && (
            <div className="chat-list">
              {dms.length === 0 ? (
                <p style={{ padding: '1rem', color: '#999', fontSize: '0.85rem' }}>
                  Ingen DMs ennå
                </p>
              ) : (
                dms.map(dm => {
                  const otherParticipant = dm.participants.find(p => p !== user?.name) || 'Unknown';
                  return (
                    <div
                      key={dm.id}
                      className={`chat-item ${selectedDM === dm.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedDM(dm.id);
                        setSelectedChannel(null);
                      }}
                    >
                      <span className={`chat-name ${dm.unread > 0 ? 'unread' : ''}`}>
                        💬 {otherParticipant}
                      </span>
                      {dm.unread > 0 && (
                        <span className="chat-unread">{dm.unread}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Message Area */}
        <div className="chat-main">
          {selectedChannel || selectedDM ? (
            <>
              {/* Messages */}
              <div className="messages-area">
                {messages.map(msg => (
                  <div key={msg.id} className="message">
                    {msg.replyTo && (
                      <div className="reply-context">
                        <span className="reply-sender">{msg.replyTo.sender}</span>
                        <span className="reply-content">{msg.replyTo.content.substring(0, 50)}...</span>
                      </div>
                    )}
                    <div className="message-header">
                      <span className="message-sender">{msg.sender}</span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-content">{msg.content}</div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="message-attachments">
                        {msg.attachments.map((att, idx) => (
                          <div key={idx} className="attachment">
                            {att.type === 'gif' && <img src={att.url} alt="GIF" />}
                            {att.type === 'file' && <span>📎 {att.name}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="message-actions">
                      <button 
                        className="reply-button"
                        onClick={() => setReplyingTo(msg)}
                      >
                        ↩️ Reply
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '👍')}
                      >
                        👍
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '❤️')}
                      >
                        ❤️
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '😂')}
                      >
                        😂
                      </button>
                    </div>
                    {msg.reactions && (
                      <div className="message-reactions">
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button key={emoji} className="reaction-count">
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Reply Context */}
              {replyingTo && (
                <div className="reply-preview">
                  <span>Replying to <strong>{replyingTo.sender}</strong></span>
                  <button onClick={() => setReplyingTo(null)}>✕</button>
                </div>
              )}

              {/* GIF Picker */}
              {isPickingGif && (
                <div className="gif-picker">
                  <input
                    type="text"
                    placeholder="Search GIFs..."
                    value={gifSearch}
                    onChange={(e) => {
                      setGifSearch(e.target.value);
                      searchGifs(e.target.value);
                    }}
                    className="gif-search-input"
                  />
                  <div className="gif-grid">
                    {gifs.map((gif) => (
                      <img
                        key={gif.id}
                        src={gif.images.fixed_height.url}
                        alt="GIF"
                        onClick={() => insertGif(gif)}
                        className="gif-thumbnail"
                      />
                    ))}
                  </div>
                  <button 
                    onClick={() => setIsPickingGif(false)}
                    className="close-gif-picker"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="message-input-area">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="input-action-btn"
                  title="Upload file"
                >
                  📎
                </button>
                <button
                  onClick={() => setIsPickingGif(!isPickingGif)}
                  className="input-action-btn"
                  title="Pick GIF"
                >
                  🎬
                </button>
                <textarea
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
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
                  onClick={() => sendMessage()}
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
