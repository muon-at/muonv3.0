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

  const isDM = type === 'dm';
  const chatName = isDM ? (id ? decodeURIComponent(id) : '') : id;

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

      const messagesRef = collection(db, 'chat_channels', chatName, 'messages');
      const messagesQ = query(messagesRef, orderBy('timestamp', 'asc'));
      const unsubscribe = onSnapshot(messagesQ, (snapshot) => {
        console.log('💬 Channel messages:', snapshot.size);
        const msgs: Message[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          msgs.push({
            id: doc.id,
            sender: data.sender,
            senderId: data.senderId,
            content: data.content,
            timestamp: data.timestamp,
            type: data.type || 'text'
          });
        });
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }, (error) => {
        console.error('❌ Channel listener error:', error);
      });
      return unsubscribe;
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

  return (
    <div className="mobile-chat-conversation">
      <div className="mobile-chat-header">
        <button className="back-button" onClick={() => navigate('/home/chat')}>
          ← {isDM ? 'DM' : 'Channels'}
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
