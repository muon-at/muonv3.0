import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import '../styles/MinSide.css';

export default function MinSide() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const canAccessTeamleder = user?.role === 'owner' || user?.role === 'teamlead';

  // Mock data - will be replaced with Firestore later
  const userData = {
    name: 'Stian Abrahamsen',
    role: 'owner',
    project: 'Muon',
    profileImage: '📷',
  };

  // Badge order: In-use (8) + Future (6)
  const badges = [
    // In-use badges
    '🏆', '👑', '⭐', '🎓', '🚀', '🎯', '🔥', '💎',
    // Future badges (no duplicates)
    '💪', '☀️', '⚡', '🎭', '🏅', '🎖️'
  ];

  const stats = [
    { value: 57, label: 'Dag', color: '#E8956E' },
    { value: 476, label: 'Uke', color: '#E8956E' },
    { value: 57, label: 'Måned', color: '#E8956E' },
    { value: 328, label: 'År', color: '#5B7FFF' },
    { value: 678, label: 'Altid', color: '#A855C9' },
  ];

  const goals = {
    weekly: { current: 19, unit: 'order/uke' },
    monthly: { current: 120, unit: 'order/måned' },
  };

  const progressData = [
    { label: 'Dagens Mål', current: 7, target: 33, color: '#3B82F6', status: '✓ Mål nådd!' },
    { label: 'Ukes Mål', current: 29, target: 25, color: '#10B981', status: '✓ Mål nådd!' },
    { label: 'Måneds Mål', current: 152, target: 100, color: '#F97316', status: '✓ Mål nådd!' },
  ];

  return (
    <div className="minside-container">
      {/* Profile Banner */}
      <div className="profile-banner">
        <div className="banner-left">
          <div className="profile-image">{userData.profileImage}</div>
        </div>
        
        <div className="banner-center">
          <h1 className="user-name">{userData.name}</h1>
          <p className="user-subtitle">{userData.role} • {userData.project}</p>
          <div className="badges-row">
            {badges.map((badge, idx) => (
              <div key={idx} className="badge-circle">{badge}</div>
            ))}
          </div>
        </div>

        <div className="header-buttons">
          <button className="nav-button-minside" onClick={() => navigate('/chat')}>
            💬 Chat
          </button>
          {canAccessTeamleder && (
            <button className="nav-button-minside" onClick={() => navigate('/teamleder')}>
              👥 Teamleder →
            </button>
          )}
          <button className="logout-button-minside" onClick={logout}>
            Logg ut
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="minside-content">
        {/* Left: Statistics */}
        <div className="stats-section">
          <div className="trophy-left">🏆</div>
          
          <div className="stats-circles">
            {stats.map((stat, idx) => (
              <div key={idx} className="stat-circle-wrapper">
                <div 
                  className="stat-circle"
                  style={{ backgroundColor: stat.color }}
                >
                  {stat.value}
                </div>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="trophy-right">🏆</div>
        </div>

        {/* Right: Goals Sidebar */}
        <div className="goals-sidebar">
          <h2>🎯 Mine Mål</h2>
          <p className="goals-subtitle">Ukesmål & Månedsmål</p>
          
          <div className="goals-grid">
            <div className="goal-item">
              <label>UKESMÅL</label>
              <p className="goal-value">{goals.weekly.current}</p>
              <span className="goal-unit">{goals.weekly.unit}</span>
            </div>
            
            <div className="goal-item">
              <label>MÅNEDSMÅL</label>
              <p className="goal-value">{goals.monthly.current}</p>
              <span className="goal-unit">{goals.monthly.unit}</span>
            </div>
          </div>

          <button className="endre-mal-btn">Endre mål</button>
        </div>
      </div>

      {/* Progress Bars Section */}
      <div className="progress-section">
        {progressData.map((item, idx) => (
          <div key={idx} className="progress-item">
            <div className="progress-header">
              <label>{item.label}</label>
              <span className="progress-percent">100%</span>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar"
                style={{ 
                  backgroundColor: item.color,
                  width: '100%'
                }}
              />
            </div>
            <div className="progress-footer">
              <span className="progress-fraction">{item.current} / {item.target}</span>
              <span className="progress-status">{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
