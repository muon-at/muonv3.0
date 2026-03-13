import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { useChannelUnread } from '../lib/ChannelUnreadContext';
import '../styles/MobileHome.css';

export default function MobileHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { channelUnreadCounts } = useChannelUnread();
  const [dmUnread, setDmUnread] = useState(0);

  // Calculate DM unread count
  useEffect(() => {
    let total = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('chat_unread_dm_')) {
        total += parseInt(localStorage.getItem(key) || '0', 10);
      }
    });
    setDmUnread(total);
  }, []);

  // Listen for updates
  useEffect(() => {
    const handleUpdate = () => {
      let total = 0;
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('chat_unread_dm_')) {
          total += parseInt(localStorage.getItem(key) || '0', 10);
        }
      });
      setDmUnread(total);
    };

    window.addEventListener('chatUnreadUpdated', handleUpdate);
    return () => window.removeEventListener('chatUnreadUpdated', handleUpdate);
  }, []);

  // Calculate channel unread
  const channelTotal = Object.values(channelUnreadCounts).reduce((sum, count) => sum + count, 0);
  const chatTotal = dmUnread + channelTotal;

  return (
    <div className="mobile-home">
      <div className="mobile-home-header">
        <div className="logo">Muo<span className="logo-n">N</span>exus</div>
        <p className="subtitle">Velg hva du vil gjøre</p>
      </div>

      <div className="mobile-home-grid">
        {/* CHAT Card */}
        <button
          className="mobile-home-card"
          onClick={() => navigate('/home/chat')}
        >
          <div className="card-icon">💬</div>
          <div className="card-label">CHAT</div>
          {chatTotal > 0 && (
            <div className="card-badge">{chatTotal}</div>
          )}
        </button>

        {/* MIN SIDE Card */}
        <button
          className="mobile-home-card"
          onClick={() => navigate('/min-side')}
        >
          <div className="card-icon">👤</div>
          <div className="card-label">MIN SIDE</div>
        </button>

        {/* LØNN Card */}
        <button
          className="mobile-home-card"
          onClick={() => navigate('/chat', { state: { selectedChannel: 'project-allente' } })}
        >
          <div className="card-icon">💰</div>
          <div className="card-label">LØNN</div>
        </button>

        {/* TEAM/AVDELING Card */}
        <button
          className="mobile-home-card"
          onClick={() => navigate('/teamleder')}
        >
          <div className="card-icon">👥</div>
          <div className="card-label">TEAM</div>
        </button>
      </div>

      <div className="mobile-home-footer">
        <p className="user-greeting">Hei {user?.name}! 👋</p>
      </div>
    </div>
  );
}
