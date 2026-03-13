import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileChatConversation.css';

interface Message {
  id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: any;
  type: 'text' | 'image' | 'file';
}

export default function MobileChatConversation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { type, id } = useParams<{ type: string; id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [chatTitle, setChatTitle] = useState('');
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
            type: msgData.type || 'text'
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
        'dept-skien': 'Skien'
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
      
      setDoc(doc(db, 'chat_channels', chatName), {
        id: chatName,
        name: title,
        unread: 0,
        createdAt: serverTimestamp()
      }, { merge: true }).then(() => {
        console.log('✅ Channel doc ready:', chatName);
        
        // Load messages
        const messagesRef = collection(db, 'chat_channels', chatName, 'messages');
        const messagesQ = query(messagesRef, orderBy('timestamp', 'asc'));
        
        console.log('🔍 Setting up listener for:', { 
          path: `chat_channels/${chatName}/messages`,
          chatName,
          title
        });
        
        let snapshotCount = 0;
        unsubscribe = onSnapshot(messagesQ, (snapshot) => {
          snapshotCount++;
          console.log('💬 Messages snapshot #' + snapshotCount + ':', { 
            count: snapshot.size, 
            channelId: chatName,
            empty: snapshot.empty
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
              type: data.type || 'text'
            });
          });
          console.log('✅ Setting messages:', msgs.length, 'items');
          setMessages(msgs);
          if (msgs.length > 0) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        }, (error) => {
          console.error('❌ Listener error:', error);
          console.log('⏱️ Setting empty state due to error');
          setMessages([]);
        });
      }).catch((error) => {
        console.error('❌ Channel init error:', error);
        console.error('❌ Stack:', error instanceof Error ? error.stack : 'no stack');
        setMessages([]);
      });

      return () => {
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
          'dept-skien': 'Skien'
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
      console.log('File selected:', file.name);
      // TODO: Implement file upload
    }
  };

  const handleGifClick = () => {
    console.log('GIF picker clicked');
    // TODO: Implement GIF picker
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
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            Ingen meldinger ennå
          </div>
        ) : null}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message ${msg.senderId === user?.id ? 'sent' : 'received'}`}
          >
            {msg.senderId !== user?.id && <div className="message-sender">{msg.sender}</div>}
            <div className="message-bubble">
              {msg.type === 'text' ? (
                msg.content
              ) : (
                <div className="message-media">[{msg.type}]</div>
              )}
            </div>
            {msg.timestamp && (
              <div className="message-time">
                {new Date(msg.timestamp.toDate()).toLocaleTimeString('nb-NO', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

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
