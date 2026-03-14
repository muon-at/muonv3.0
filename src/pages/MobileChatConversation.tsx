import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileChatConversation.css';

interface Message {
  id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: any;
  type: 'text' | 'image' | 'file';
  fileName?: string;
}

export default function MobileChatConversation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { type, id } = useParams<{ type: string; id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [chatTitle, setChatTitle] = useState('');
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  console.log('📱 MobileChatConversation mounted with params:', { type, id });
  
  const isDM = type === 'dm';
  // For DM: decode, for channel: use as-is
  const chatName = isDM ? (id ? decodeURIComponent(id) : '') : (id || '');
  
  console.log('📱 Resolved chatName:', { chatName, isDM, type, id });

  // Load conversation
  useEffect(() => {
    if (!chatName || !user?.id) return;

    console.log('🔍 Loading conversation:', { isDM, chatName, userId: user?.id, userName: user?.name });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (isDM) {
      setChatTitle(chatName);
      
      // Create stable DM ID from sorted participant names
      const participants = [user.name, chatName].sort();
      const dmId = participants.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_');
      console.log('🔑 Using DM ID:', dmId, 'Participants:', participants);

      // Load messages for this DM
      const messagesRef = collection(db, 'chat_dms', dmId, 'messages');
      const messagesQ = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(messagesQ, (msgSnapshot) => {
        console.log('💬 Messages snapshot:', msgSnapshot.size, 'msgs');
        const msgs: Message[] = [];
        msgSnapshot.forEach(msgDoc => {
          const msgData = msgDoc.data();
          msgs.push({
            id: msgDoc.id,
            sender: msgData.sender,
            senderId: msgData.senderId,
            content: msgData.content,
            timestamp: msgData.timestamp,
            type: msgData.type || 'text',
            fileName: msgData.fileName
          });
        });
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }, (error) => {
        console.error('❌ Message listener error:', error);
        // Fallback: show empty state
        setMessages([]);
      });
      
      return unsubscribe;
    } else {
      // Load channel
      if (!chatName) return;
      const channelNames: { [key: string]: string } = {
        'global': 'Global',
        'project-allente': 'Allente Chat',
        'dept-krs': 'KRS',
        'dept-osl': 'OSL',
        'dept-skien': 'Skien',
        'admin-channel': 'Admin',
        'teamleder-channel': 'Teamleder'
      };
      const title = channelNames[chatName] || chatName;
      setChatTitle(title);
      console.log('📺 Loading channel:', { chatName, title });

      let unsubscribe: (() => void) | undefined;

      // Initialize channel async
      console.log('🚀 Initializing channel:', { chatName, title, isDM, type });
      
      if (chatName === 'project-allente') {
        console.log('⚠️ ALLENTE CHAT DETECTED - debugging this one');
      }
      
      // Load current document to see structure
      const channelDocRef = doc(db, 'chat_channels', chatName);
      
      setDoc(channelDocRef, {
        id: chatName,
        name: title,
        type: 'channel',
        unread: 0,
        createdAt: serverTimestamp(),
        lastMessage: '',
        lastMessageTime: serverTimestamp()
      }, { merge: true }).then(async () => {
        console.log('✅ Channel doc ready:', chatName);
        
        // Log current document structure for debugging
        try {
          const docSnap = await getDoc(channelDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log('📄 Channel document structure:', {
              fields: Object.keys(data),
              hasMessages: 'messages' in data,
              type: data.type,
              name: data.name
            });
          } else {
            console.log('⚠️ Channel doc not found:', chatName);
          }
        } catch (e) {
          console.log('⚠️ Could not read channel doc:', (e as any).message);
        }
        
        // Load messages
        const messagesRef = collection(db, 'chat_channels', chatName, 'messages');
        const messagesQ = query(messagesRef, orderBy('timestamp', 'asc'));
        
        console.log('🔍 Setting up listener for:', { 
          path: `chat_channels/${chatName}/messages`,
          chatName,
          title
        });
        
        let snapshotCount = 0;
        let hasData = false;
        timeoutId = setTimeout(() => {
          if (!hasData && snapshotCount === 0) {
            console.warn('⚠️ Listener timeout - no data received:', chatName);
            setMessages([]);
          }
        }, 3000);
        
        unsubscribe = onSnapshot(messagesQ, (snapshot) => {
          hasData = true;
          if (timeoutId) clearTimeout(timeoutId);
          snapshotCount++;
          console.log('💬 Messages snapshot #' + snapshotCount + ':', { 
            count: snapshot.size, 
            channelId: chatName,
            empty: snapshot.empty,
            isDeptChannel: chatName.startsWith('dept-')
          });
          const msgs: Message[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            msgs.push({
              id: doc.id,
              sender: data.sender || 'Unknown',
              senderId: data.senderId || '',
              content: data.content || '',
              timestamp: data.timestamp,
              type: data.type || 'text',
              fileName: data.fileName
            });
          });
          console.log('✅ Setting messages:', msgs.length, 'items');
          setMessages(msgs);
          if (msgs.length > 0) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        }, (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ Listener error for channel:', chatName);
          console.error('Error:', {
            code: (error as any)?.code,
            message: (error as any)?.message
          });
          setMessages([]);
        });
      }).catch((error) => {
        console.error('❌ Channel init error:', error);
        console.error('❌ Stack:', error instanceof Error ? error.stack : 'no stack');
        setMessages([]);
      });

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (unsubscribe) unsubscribe();
      };
    }
  }, [chatName, isDM, user]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !chatName) return;

    try {
      if (isDM) {
        // Create stable DM ID from sorted participant names
        const participants = [user.name, chatName].sort();
        const dmId = participants.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        console.log('📤 Sending to DM:', dmId);

        // Create DM if it doesn't exist
        console.log('✏️ Creating/ensuring DM:', dmId);
        await setDoc(doc(db, 'chat_dms', dmId), {
          participants: participants,
          unread: {
            [user.name]: 0,
            [chatName]: 1
          },
          lastMessageTime: serverTimestamp()
        }, { merge: true });

        // Add message
        await addDoc(collection(db, 'chat_dms', dmId, 'messages'), {
          sender: user.name,
          senderId: user.id,
          content: messageText,
          timestamp: serverTimestamp(),
          type: 'text'
        });

        // Update unread
        await updateDoc(doc(db, 'chat_dms', dmId), {
          [`unread.${chatName}`]: 0,
          lastMessageTime: serverTimestamp()
        });
      } else {
        // Ensure channel exists
        const channelRef = doc(db, 'chat_channels', chatName);
        const channelNames: { [key: string]: string } = {
          'global': 'Global',
          'project-allente': 'Allente Chat',
          'dept-krs': 'KRS',
          'dept-osl': 'OSL',
          'dept-skien': 'Skien',
          'admin-channel': 'Admin',
          'teamleder-channel': 'Teamleder'
        };
        await setDoc(channelRef, {
          id: chatName,
          name: channelNames[chatName] || chatName,
          unread: 0,
          createdAt: serverTimestamp()
        }, { merge: true });

        // Add message to channel
        await addDoc(collection(db, 'chat_channels', chatName, 'messages'), {
          sender: user.name,
          senderId: user.id,
          content: messageText,
          timestamp: serverTimestamp(),
          type: 'text'
        });
      }

      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const dataUrl = event.target?.result as string;
          const msgType = file.type.startsWith('image/') ? 'image' : 'file';
          
          if (isDM) {
            const participants = [user!.name, chatName].sort();
            const dmId = participants.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_');
            await addDoc(collection(db, 'chat_dms', dmId, 'messages'), {
              sender: user!.name,
              senderId: user!.id,
              content: dataUrl,
              fileName: file.name,
              timestamp: serverTimestamp(),
              type: msgType
            });
          } else {
            await addDoc(collection(db, 'chat_channels', chatName, 'messages'), {
              sender: user!.name,
              senderId: user!.id,
              content: dataUrl,
              fileName: file.name,
              timestamp: serverTimestamp(),
              type: msgType
            });
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
          console.error('File upload error:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      return;
    }
    setGifLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=20&api_key=rocNGj67aZ4GXyTkBiLKHDgso3j4EQ3c`
      );
      const data = await response.json();
      setGifResults(data.data || []);
    } catch (error) {
      console.error('GIF search error:', error);
    } finally {
      setGifLoading(false);
    }
  };

  const sendGif = async (gifUrl: string) => {
    try {
      if (isDM) {
        const participants = [user!.name, chatName].sort();
        const dmId = participants.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        await addDoc(collection(db, 'chat_dms', dmId, 'messages'), {
          sender: user!.name,
          senderId: user!.id,
          content: gifUrl,
          timestamp: serverTimestamp(),
          type: 'image'
        });
      } else {
        await addDoc(collection(db, 'chat_channels', chatName, 'messages'), {
          sender: user!.name,
          senderId: user!.id,
          content: gifUrl,
          timestamp: serverTimestamp(),
          type: 'image'
        });
      }
      setShowGifPicker(false);
      setGifSearch('');
      setGifResults([]);
    } catch (error) {
      console.error('GIF send error:', error);
    }
  };

  const handleGifClick = () => {
    setShowGifPicker(!showGifPicker);
    if (!showGifPicker) setGifSearch('');
  };

  const deleteMessage = async (messageId: string, senderName: string) => {
    if (!user) return;

    // Check permissions
    const canDelete = isDM 
      ? senderName === user.name // DM: only own messages
      : user.role === 'owner'; // Channel: only owner

    if (!canDelete) {
      alert('Du kan ikke slette denne meldingen');
      return;
    }

    if (!confirm('Slett melding?')) return;

    try {
      const path = isDM
        ? `chat_dms/${[user.name, chatName].sort().join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_')}/messages/${messageId}`
        : `chat_channels/${chatName}/messages/${messageId}`;

      await deleteDoc(doc(db, path));
      console.log('✅ Message deleted');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Kunne ikke slette melding');
    }
  };

  // Safety check
  if (!chatName) {
    return (
      <div className="mobile-chat-conversation">
        <div className="mobile-chat-header">
          <button className="back-button" onClick={() => navigate('/home/chat')}>
            ← Tilbake
          </button>
          <h1>Feil</h1>
          <div style={{ width: '40px' }} />
        </div>
        <div className="messages-container">
          <div style={{ padding: '1rem', color: '#999' }}>Kunne ikke laste chat</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-chat-conversation">
      <div className="mobile-chat-header">
        <button className="back-button" onClick={() => navigate('/home/chat')}>
          ← Tilbake
        </button>
        <h1>{chatTitle || 'Laster...'}</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="messages-container">
        {messages.length === 0 && chatName ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '1rem', flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
            <div>Ingen meldinger ennå 💬</div>
            <div style={{ fontSize: '0.85rem', color: '#555' }}>Channel: {chatName}</div>
          </div>
        ) : null}
        {messages.map(msg => {
          const canDelete = isDM 
            ? msg.senderId === user?.id
            : user?.role === 'owner';
          
          return (
            <div
              key={msg.id}
              className={`message ${msg.senderId === user?.id ? 'sent' : 'received'}`}
              style={{ position: 'relative' }}
              onMouseEnter={(e) => {
                const deleteBtn = e.currentTarget.querySelector('.message-delete');
                if (deleteBtn) (deleteBtn as HTMLElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const deleteBtn = e.currentTarget.querySelector('.message-delete');
                if (deleteBtn) (deleteBtn as HTMLElement).style.opacity = '0';
              }}
            >
              {msg.senderId !== user?.id && <div className="message-sender">{msg.sender}</div>}
              <div className="message-bubble">
                {msg.type === 'text' ? (
                  msg.content
                ) : msg.type === 'image' ? (
                  <img src={msg.content} alt="Melding" style={{ maxWidth: '200px', borderRadius: '8px' }} />
                ) : (
                  <div className="message-media">📄 {(msg as any).fileName || msg.type}</div>
                )}
              </div>
              {canDelete && (
                <button
                  className="message-delete"
                  onClick={() => deleteMessage(msg.id, msg.sender)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#999',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    fontSize: '0.9rem',
                    opacity: 0,
                    transition: 'opacity 0.2s'
                  }}
                >
                  🗑️
                </button>
              )}
              {msg.timestamp && (
                <div className="message-time">
                  {new Date(msg.timestamp.toDate()).toLocaleTimeString('nb-NO', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {showGifPicker && (
        <div className="gif-picker-modal">
          <div className="gif-picker-header">
            <h3>Søk GIFs</h3>
            <button className="gif-picker-close" onClick={() => setShowGifPicker(false)}>×</button>
          </div>
          <input
            type="text"
            className="gif-search-input"
            placeholder="Søk GIF..."
            value={gifSearch}
            onChange={(e) => {
              setGifSearch(e.target.value);
              searchGifs(e.target.value);
            }}
          />
          {gifLoading && <div className="gif-loading">Laster...</div>}
          <div className="gif-results">
            {gifResults.map((gif) => (
              <img
                key={gif.id}
                src={gif.images.fixed_height.url}
                alt="GIF"
                className="gif-result-item"
                onClick={() => sendGif(gif.images.fixed_height.url)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="write-field">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <button className="write-button" onClick={() => fileInputRef.current?.click()} title="Legg til fil">
          📎
        </button>

        <button className="write-button" onClick={handleGifClick} title="Legg til GIF">
          🎬
        </button>

        <input
          type="text"
          className="write-input"
          placeholder="Skriv melding..."
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          onKeyPress={e => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
        />

        <button
          className="send-button"
          onClick={handleSendMessage}
          disabled={!messageText.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
