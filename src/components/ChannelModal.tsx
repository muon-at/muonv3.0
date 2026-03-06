import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: () => void;
  allUsers: any[];
}

export default function ChannelModal({ isOpen, onClose, onChannelCreated, allUsers }: ChannelModalProps) {
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'project' | 'team' | 'admin' | 'avdeling' | 'global'>('project');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [channelEmoji, setChannelEmoji] = useState('💬');
  const [loading, setLoading] = useState(false);
  const [customEmojiUrl, setCustomEmojiUrl] = useState<string | null>(null);

  const commonEmojis = [
    '💬', '👥', '👔', '📊', '🔐', '📢', '💰', '🎯', '🏢', '⚙️', 
    '🎲', '🛠️', '📱', '📋', '🎉', '🔥', '🚀', '⭐', '✨', '💎',
    '🎓', '📚', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎸', '🎹',
    '⚽', '🏀', '🎾', '🏐', '🏈', '⛳', '🎯', '🎳', '🎮', '🎰',
    '🍕', '🍔', '🍟', '🍗', '🌮', '🍜', '🍱', '🍣', '🍤', '🍰',
    '☕', '🍵', '🍶', '🍷', '🍾', '🍻', '🥂', '🥃', '🍪', '🎂',
    '🏝️', '🏖️', '🌴', '🌊', '⛱️', '🏄', '🤿', '🚤'
  ];

  const handleCustomEmojiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // For now, just use a data URL - in production you'd upload to Firebase Storage
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCustomEmojiUrl(dataUrl);
        setChannelEmoji(dataUrl);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading emoji:', err);
      alert('Error uploading emoji');
    }
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      alert('Please enter a channel name');
      return;
    }

    setLoading(true);
    try {
      const channelsRef = collection(db, 'chat_channels');
      await addDoc(channelsRef, {
        name: channelName,
        type: channelType,
        emoji: channelEmoji,
        allowedUsers: selectedUsers.length > 0 ? selectedUsers : null,
        createdAt: new Date(),
      });

      setChannelName('');
      setChannelType('project');
      setSelectedUsers([]);
      setChannelEmoji('💬');
      setCustomEmojiUrl(null);
      onChannelCreated();
      onClose();
    } catch (err) {
      console.error('Error creating channel:', err);
      alert('Error creating channel');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ marginTop: 0 }}>Create New Channel</h2>

        {/* Channel Name */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Channel Name
          </label>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="e.g., #marketing"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Channel Emoji */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Channel Emoji (50+ options)
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: '0.5rem',
            marginBottom: '1rem',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
          }}>
            {commonEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  setChannelEmoji(emoji);
                  setCustomEmojiUrl(null);
                }}
                style={{
                  fontSize: '1.5rem',
                  padding: '0.5rem',
                  background: channelEmoji === emoji && !customEmojiUrl ? '#667eea' : '#f0f0f0',
                  border: channelEmoji === emoji && !customEmojiUrl ? '2px solid #667eea' : 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          
          {/* Custom Emoji Upload */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: 600,
              fontSize: '0.9rem',
              color: '#666'
            }}>
              Or upload your own emoji (PNG/JPG)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCustomEmojiUpload}
              style={{
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            {customEmojiUrl && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: '#f0f0f0',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <img 
                  src={customEmojiUrl} 
                  alt="custom" 
                  style={{ 
                    width: '30px', 
                    height: '30px',
                    borderRadius: '4px',
                  }} 
                />
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  Custom emoji selected ✓
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Channel Type */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Channel Type
          </label>
          <select
            value={channelType}
            onChange={(e) => setChannelType(e.target.value as any)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          >
            <option value="project">Project (All employees)</option>
            <option value="team">Team (Teamleaders only)</option>
            <option value="admin">Admin (Owners only)</option>
            <option value="avdeling">Department (Specific users)</option>
            <option value="global">Global (All users)</option>
          </select>
        </div>

        {/* User Selection (for avdeling/custom) */}
        {(channelType === 'avdeling' || channelType === 'project') && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Allowed Users
            </label>
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              maxHeight: '200px',
              overflow: 'auto',
              padding: '0.5rem',
            }}>
              {allUsers.map(usr => (
                <label key={usr.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(usr.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, usr.name]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(u => u !== usr.name));
                      }
                    }}
                    style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                  />
                  {usr.name} ({usr.department})
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateChannel}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </div>
    </div>
  );
}
