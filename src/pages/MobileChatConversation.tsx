import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
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

    if (isDM) {
      setChatTitle(chatName);
      // Load DM
      const dmsRef = collection(db, 'chat_dms');
      const unsubscribe = onSnapshot(dmsRef, (snapshot) => {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.participants?.includes(user.name) && data.participants?.includes(chatName)) {
            // Load messages for this DM
            const messagesRef = collection(db, 'chat_dms', docSnap.id, 'messages');
            const messagesQ = query(messagesRef, orderBy('timestamp', 'asc'));
            onSnapshot(messagesQ, (msgSnapshot) => {
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
            });
          }
        });
      });
      return unsubscribe;
    } else {
      // Load channel
      const channelNames: { [key: string]: string } = {
        'global': 'Global',
        'project-allente': 'Allente Chat',
        'dept-krs': 'KRS',
        'dept-osl': 'OSL',
        'dept-skien': 'Skien'
      };
      setChatTitle(channelNames[chatName] || chatName);

      const messagesRef = collection(db, 'chat_channels', chatName, 'messages');
      const messagesQ = query(messagesRef, orderBy('timestamp', 'asc'));
      const unsubscribe = onSnapshot(messagesQ, (snapshot) => {
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
      });
      return unsubscribe;
    }
  }, [chatName, isDM, user]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user) return;

    try {
      if (isDM) {
        // Find DM and send
        const dmsRef = collection(db, 'chat_dms');
        const dmsSnapshot = await getDocs(dmsRef);
        
        for (const docSnap of dmsSnapshot.docs) {
          const data = docSnap.data();
          if (data.participants?.includes(user.name) && data.participants?.includes(chatName)) {
            // Add message
            await addDoc(collection(db, 'chat_dms', docSnap.id, 'messages'), {
              sender: user.name,
              senderId: user.id,
              content: messageText,
              timestamp: serverTimestamp(),
              type: 'text'
            });

            // Update unread
            await updateDoc(doc(db, 'chat_dms', docSnap.id), {
              [`unread.${chatName}`]: 0,
              lastMessageTime: serverTimestamp()
            });
            break;
          }
        }
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
        <h1>{chatTitle}</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="messages-container">
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
