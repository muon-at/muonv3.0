import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, onSnapshot, query, orderBy, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import ChannelModal from '../components/ChannelModal';
import '../styles/Chat.css';

interface Channel {
  id: string;
  name: string;
  type: 'project' | 'team' | 'admin' | 'avdeling' | 'global';
  unread: number;
  allowedUsers?: string[];
  emoji?: string;
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
  seenBy?: string[];
  isDeleted?: boolean;
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
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load channels on mount
  useEffect(() => {
    const load = async () => {
      await loadChannels();
      await loadDMs();
      await loadAllUsers();
    };
    load();
  }, [user]);

  const loadAllUsers = async () => {
    try {
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      const users: any[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Only add users that are not the current user
        if (data.name !== user?.name) {
          users.push({
            id: doc.id,
            name: data.name,
            email: data.email,
            department: data.department,
            role: data.role,
          });
        }
      });
      
      setAllUsers(users.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

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
        const canAccess = checkChannelAccess(data.type, data.avdeling, data.allowedUsers);
        
        if (canAccess) {
          allowedChannels.push({
            id: doc.id,
            name: data.name,
            type: data.type,
            unread: 0,
            allowedUsers: data.allowedUsers,
            emoji: getChannelEmoji(data.name, data.emoji),
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
      
      // Sort by most recent first
      userDMs.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setDMs(userDMs);
    } catch (err) {
      console.error('Error loading DMs:', err);
    }
  };

  const startOrOpenDM = async (otherUser: any) => {
    try {
      const participants = [user?.name || 'Unknown', otherUser.name].sort();
      
      // Check if DM already exists
      const dmsRef = collection(db, 'chat_dms');
      const snapshot = await getDocs(dmsRef);
      
      let existingDMId: string | null = null;
      snapshot.forEach(doc => {
        const data = doc.data();
        const dmParticipants = data.participants.sort();
        if (JSON.stringify(dmParticipants) === JSON.stringify(participants)) {
          existingDMId = doc.id;
        }
      });
      
      if (existingDMId) {
        // Open existing DM
        setSelectedDM(existingDMId);
        setSelectedChannel(null);
      } else {
        // Create new DM
        const newDMRef = await addDoc(dmsRef, {
          participants,
          lastMessage: '',
          lastMessageTime: Date.now(),
          createdAt: new Date(),
        });
        setSelectedDM(newDMRef.id);
        setSelectedChannel(null);
        // Reload DMs to show the new one
        await loadDMs();
      }
      
      setDmSearchQuery('');
    } catch (err) {
      console.error('Error starting DM:', err);
    }
  };

  const getChannelEmoji = (channelName: string, customEmoji?: string): string => {
    if (customEmoji) return customEmoji;
    
    const emojiMap: Record<string, string> = {
      'team': '👥',
      'teamledere': '👔',
      'osl': '🏢',
      'admin': '🔐',
      'allente': '📊',
      'skien': '🏭',
      'krs': '🏝️',
      'general': '💬',
      'random': '🎲',
      'announcements': '📢',
      'sales': '💰',
      'marketing': '📱',
      'support': '🎯',
      'engineering': '🛠️',
    };
    
    const lower = channelName.toLowerCase();
    return emojiMap[lower] || '💬';
  };

  const renderChannelEmoji = (emoji?: string) => {
    const emojiStr = emoji || '💬';
    
    // Check if it's a data URL (custom emoji image)
    if (emojiStr.startsWith('data:') || emojiStr.startsWith('http')) {
      return <img src={emojiStr} alt="emoji" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '4px' }} />;
    }
    
    // Regular emoji
    return emojiStr;
  };

  const checkChannelAccess = (type: string, avdeling?: string, allowedUsers?: string[]): boolean => {
    // If allowedUsers is set, check if user is in the list
    if (allowedUsers && allowedUsers.length > 0) {
      return allowedUsers.includes(user?.name || '') || user?.role === 'owner';
    }
    
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
    
    // Calculate deleteAt timestamp (90 days from now)
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const deleteAtDate = new Date(Date.now() + ninetyDaysMs);
    
    try {
      if (selectedChannel) {
        console.log('📝 Sending to channel:', selectedChannel);
        const messagesRef = collection(db, 'chat_channels', selectedChannel, 'messages');
        const msgData: any = {
          sender: user?.name || 'Unknown',
          content: messageContent,
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
        };
        if (replyingTo) {
          msgData.replyTo = {
            id: replyingTo.id,
            sender: replyingTo.sender,
            content: replyingTo.content,
          };
        }
        await addDoc(messagesRef, msgData);
        console.log('✅ Message sent successfully! Will auto-delete on:', deleteAtDate.toLocaleDateString());
      } else if (selectedDM) {
        console.log('📝 Sending to DM:', selectedDM);
        const messagesRef = collection(db, 'chat_dms', selectedDM, 'messages');
        const msgData: any = {
          sender: user?.name || 'Unknown',
          content: messageContent,
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
        };
        if (replyingTo) {
          msgData.replyTo = {
            id: replyingTo.id,
            sender: replyingTo.sender,
            content: replyingTo.content,
          };
        }
        await addDoc(messagesRef, msgData);
        
        // Update DM thread with last message
        const dmRef = doc(db, 'chat_dms', selectedDM);
        await updateDoc(dmRef, {
          lastMessage: messageContent,
          lastMessageTime: Date.now(),
        });
        
        console.log('✅ Message sent successfully! Will auto-delete on:', deleteAtDate.toLocaleDateString());
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
    
    // Demo GIFs - Perfect for testing, can upgrade to real API later
    const demoGifs: any[] = [
      { id: '1', images: { fixed_height: { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' } } },
      { id: '2', images: { fixed_height: { url: 'https://media.giphy.com/media/g9GWuLSJF63qE/giphy.gif' } } },
      { id: '3', images: { fixed_height: { url: 'https://media.giphy.com/media/d3ODAKGlul0c4gVo/giphy.gif' } } },
      { id: '4', images: { fixed_height: { url: 'https://media.giphy.com/media/5xtDarmwsuR9sDKgF2c/giphy.gif' } } },
      { id: '5', images: { fixed_height: { url: 'https://media.giphy.com/media/l0HlDtKPoYJhFtHTG/giphy.gif' } } },
      { id: '6', images: { fixed_height: { url: 'https://media.giphy.com/media/hEc8uIVxNf89i/giphy.gif' } } },
      { id: '7', images: { fixed_height: { url: 'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif' } } },
      { id: '8', images: { fixed_height: { url: 'https://media.giphy.com/media/l0MYCNFdM2fHz1sxO/giphy.gif' } } },
    ];
    
    console.log('✅ Demo GIFs loaded -', demoGifs.length, 'GIFs ready');
    setGifs(demoGifs);
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

  const pinMessage = async (messageId: string, message: Message) => {
    try {
      if (selectedChannel) {
        const channelRef = doc(db, 'chat_channels', selectedChannel);
        await updateDoc(channelRef, {
          pinnedMessageId: messageId,
        });
        setPinnedMessage(message);
      } else if (selectedDM) {
        const dmRef = doc(db, 'chat_dms', selectedDM);
        await updateDoc(dmRef, {
          pinnedMessageId: messageId,
        });
        setPinnedMessage(message);
      }
    } catch (err) {
      console.error('Error pinning message:', err);
    }
  };

  const unpinMessage = async () => {
    try {
      if (selectedChannel) {
        const channelRef = doc(db, 'chat_channels', selectedChannel);
        await updateDoc(channelRef, {
          pinnedMessageId: null,
        });
      } else if (selectedDM) {
        const dmRef = doc(db, 'chat_dms', selectedDM);
        await updateDoc(dmRef, {
          pinnedMessageId: null,
        });
      }
      setPinnedMessage(null);
    } catch (err) {
      console.error('Error unpinning message:', err);
    }
  };

  const deleteMessage = async (messageId: string) => {
    // Only owner can delete
    if (user?.role !== 'owner') {
      alert('Only owners can delete messages');
      return;
    }
    
    try {
      if (selectedChannel) {
        const msgRef = doc(db, 'chat_channels', selectedChannel, 'messages', messageId);
        await updateDoc(msgRef, {
          content: '[Deleted]',
          isDeleted: true,
        });
      } else if (selectedDM) {
        const msgRef = doc(db, 'chat_dms', selectedDM, 'messages', messageId);
        await updateDoc(msgRef, {
          content: '[Deleted]',
          isDeleted: true,
        });
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      broadcastTyping(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      broadcastTyping(false);
    }, 3000);
  };

  const broadcastTyping = async (isTyping: boolean) => {
    try {
      if (selectedChannel) {
        const typingRef = doc(db, 'chat_channels', selectedChannel, 'typing_status', user?.name || 'Unknown');
        if (isTyping) {
          await updateDoc(typingRef, {
            user: user?.name || 'Unknown',
            timestamp: Date.now(),
          }).catch(() => {
            // Document doesn't exist, will be created on read
          });
        }
      }
    } catch (err) {
      // Silently fail - typing indicators are nice to have
    }
  };

  // Listen for typing status in channel
  useEffect(() => {
    if (!selectedChannel) return;
    
    const typingRef = collection(db, 'chat_channels', selectedChannel, 'typing_status');
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const typing: string[] = [];
      const now = Date.now();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Only show typing if timestamp is recent (within 3 seconds)
        if (now - data.timestamp < 3000 && data.user !== user?.name) {
          typing.push(data.user);
        }
      });
      
      setTypingUsers(typing);
    });
    
    return () => unsubscribe();
  }, [selectedChannel, user]);

  // Mark messages as seen
  const markMessageSeen = async (messageId: string) => {
    try {
      if (selectedChannel) {
        const msgRef = doc(db, 'chat_channels', selectedChannel, 'messages', messageId);
        await updateDoc(msgRef, {
          seenBy: arrayUnion(user?.name || 'Unknown'),
        }).catch(() => {
          // Silently fail if document doesn't exist yet
        });
      } else if (selectedDM) {
        const msgRef = doc(db, 'chat_dms', selectedDM, 'messages', messageId);
        await updateDoc(msgRef, {
          seenBy: arrayUnion(user?.name || 'Unknown'),
        }).catch(() => {
          // Silently fail if document doesn't exist yet
        });
      }
    } catch (err) {
      // Silently fail - read receipts are nice to have
    }
  };

  // Auto-mark messages as seen when they appear
  useEffect(() => {
    if (messages.length === 0) return;
    
    const timer = setTimeout(() => {
      messages.forEach(msg => {
        if (msg.sender !== user?.name && !msg.seenBy?.includes(user?.name || 'Unknown')) {
          markMessageSeen(msg.id);
        }
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [messages, user, selectedChannel, selectedDM]);

  // Filter messages by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMessages(messages);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = messages.filter(msg => 
      msg.content.toLowerCase().includes(query) ||
      msg.sender.toLowerCase().includes(query)
    );
    
    setFilteredMessages(filtered);
  }, [messages, searchQuery]);

  const insertGif = (gif: any) => {
    const gifUrl = gif.images.fixed_height.url;
    insertGifAsAttachment(gifUrl);
    setIsPickingGif(false);
    setGifSearch('');
    setGifs([]);
  };

  const insertGifAsAttachment = async (gifUrl: string) => {
    // Calculate deleteAt timestamp (90 days from now)
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const deleteAtDate = new Date(Date.now() + ninetyDaysMs);
    
    try {
      if (selectedChannel) {
        const messagesRef = collection(db, 'chat_channels', selectedChannel, 'messages');
        await addDoc(messagesRef, {
          sender: user?.name || 'Unknown',
          content: '🎬 Shared a GIF',
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
          attachments: [
            {
              type: 'gif',
              url: gifUrl,
            }
          ],
        });
      } else if (selectedDM) {
        const messagesRef = collection(db, 'chat_dms', selectedDM, 'messages');
        await addDoc(messagesRef, {
          sender: user?.name || 'Unknown',
          content: '🎬 Shared a GIF',
          timestamp: Date.now(),
          deleteAt: deleteAtDate, // Auto-delete after 90 days
          attachments: [
            {
              type: 'gif',
              url: gifUrl,
            }
          ],
        });
      }
    } catch (err) {
      console.error('Error inserting GIF:', err);
    }
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
      <div className="chat-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h1 style={{ margin: 0 }}>💬 Chat</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {user?.role === 'owner' && (
            <button 
              onClick={() => setIsChannelModalOpen(true)}
              style={{
                padding: '0.5rem 1rem',
                background: '#48bb78',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              🆕 New Channel
            </button>
          )}
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
      </div>

      {/* Channel Creation Modal */}
      <ChannelModal 
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        onChannelCreated={() => loadChannels()}
        allUsers={allUsers}
      />

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
                  className={`chat-item-compact ${selectedChannel === channel.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedChannel(channel.id);
                    setSelectedDM(null);
                  }}
                  style={{ position: 'relative' }}
                >
                  <div 
                    className={`emoji-circle ${channel.unread > 0 ? 'unread' : ''}`}
                    title={channel.name}
                    style={{
                      background: selectedChannel === channel.id ? '#764ba2' : '#667eea',
                    }}
                  >
                    {renderChannelEmoji(channel.emoji)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dms' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Search field */}
              <input
                type="text"
                placeholder="Search users..."
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
                style={{
                  padding: '0.75rem',
                  margin: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  color: '#fff',
                  background: '#2d3748',
                }}
              />
              
              {/* Search results or DM list */}
              <div className="chat-list" style={{ flex: 1, overflow: 'auto' }}>
                {dmSearchQuery.trim() ? (
                  /* Show search results */
                  <>
                    {allUsers
                      .filter(u => u.name.toLowerCase().includes(dmSearchQuery.toLowerCase()))
                      .map(user => (
                        <div
                          key={user.id}
                          className="chat-item"
                          onClick={() => startOrOpenDM(user)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="chat-name">👤 {user.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#999' }}>
                            {user.department}
                          </span>
                        </div>
                      ))}
                    {allUsers.filter(u => u.name.toLowerCase().includes(dmSearchQuery.toLowerCase())).length === 0 && (
                      <p style={{ padding: '1rem', color: '#999', fontSize: '0.85rem' }}>
                        No users found
                      </p>
                    )}
                  </>
                ) : (
                  /* Show active DMs */
                  <>
                    {dms.length === 0 ? (
                      <p style={{ padding: '1rem', color: '#999', fontSize: '0.85rem' }}>
                        No DMs yet. Search for a user to start chatting!
                      </p>
                    ) : (
                      dms.map(dm => {
                        const otherParticipant = dm.participants.find(p => p !== user?.name) || 'Unknown';
                        return (
                          <div
                            key={dm.id}
                            className={`chat-item-compact ${selectedDM === dm.id ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedDM(dm.id);
                              setSelectedChannel(null);
                            }}
                            style={{ position: 'relative' }}
                          >
                            <div 
                              className={`emoji-circle ${dm.unread > 0 ? 'unread' : ''}`}
                              title={otherParticipant}
                              style={{
                                background: selectedDM === dm.id ? '#764ba2' : '#667eea',
                                fontSize: '1.2rem',
                              }}
                            >
                              👤
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Message Area */}
        <div className="chat-main">
          {selectedChannel || selectedDM ? (
            <>
              {/* Channel Header */}
              {selectedChannel && channels.find(c => c.id === selectedChannel) && (
                <div style={{
                  padding: '1rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                      {renderChannelEmoji(channels.find(c => c.id === selectedChannel)?.emoji)}
                    </span>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                        {channels.find(c => c.id === selectedChannel)?.name}
                      </h2>
                      <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                        {channels.find(c => c.id === selectedChannel)?.type}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}>
                      📄 Files
                    </button>
                    <button style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}>
                      📌 Pins
                    </button>
                  </div>
                </div>
              )}

              {/* Pinned Message */}
              {pinnedMessage && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#fff9e6',
                  borderBottom: '2px solid #ffd700',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      📌 Pinned: {pinnedMessage.sender}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#333' }}>
                      {pinnedMessage.content.substring(0, 60)}...
                    </div>
                  </div>
                  <button
                    onClick={() => unpinMessage()}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      color: '#999'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Search field */}
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  borderBottom: '1px solid #e2e8f0',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  color: '#fff',
                  background: '#2d3748',
                }}
              />

              {/* Messages */}
              <div className="messages-area">
                {filteredMessages.map(msg => (
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
                    <div className="message-content" style={{
                      color: msg.isDeleted ? '#999' : '#333',
                      fontStyle: msg.isDeleted ? 'italic' : 'normal',
                      opacity: msg.isDeleted ? 0.7 : 1,
                    }}>
                      {msg.content}
                    </div>
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
                    {msg.seenBy && msg.seenBy.length > 0 && msg.sender === user?.name && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#999', 
                        marginTop: '0.25rem'
                      }}>
                        ✔️ Seen by {msg.seenBy.length} {msg.seenBy.length === 1 ? 'person' : 'people'}
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
                        className="reply-button"
                        onClick={() => pinMessage(msg.id, msg)}
                      >
                        📌 Pin
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
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '🔥')}
                      >
                        🔥
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '👏')}
                      >
                        👏
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '😍')}
                      >
                        😍
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '🎉')}
                      >
                        🎉
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '💯')}
                      >
                        💯
                      </button>
                      <button 
                        className="reaction-button"
                        onClick={() => addReaction(msg.id, '😢')}
                      >
                        😢
                      </button>
                      {user?.role === 'owner' && !msg.isDeleted && (
                        <button
                          className="reply-button"
                          onClick={() => {
                            if (confirm('Delete this message?')) {
                              deleteMessage(msg.id);
                            }
                          }}
                          style={{ color: '#ff4757' }}
                        >
                          🗑️ Delete
                        </button>
                      )}
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
                
                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div style={{ 
                    padding: '0.5rem 1rem', 
                    color: '#999', 
                    fontSize: '0.85rem',
                    fontStyle: 'italic'
                  }}>
                    {typingUsers.length === 1 
                      ? `${typingUsers[0]} is typing...` 
                      : `${typingUsers.join(', ')} are typing...`}
                  </div>
                )}
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
