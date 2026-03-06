import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MinSide.css';

interface SalesRecord {
  dato?: string;
  selger?: string;
  id?: string;
}

export default function MinSide() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  const canAccessTeamleder = user?.role === 'owner' || user?.role === 'teamlead';

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadEmployeeData();
  }, [user, navigate]);

  const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const dateString = String(dateStr).trim();
    const ddmmRegex = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;
    const match = dateString.match(ddmmRegex);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      return new Date(year, month - 1, day);
    }
    const isoDate = new Date(dateString);
    if (!isNaN(isoDate.getTime())) return isoDate;
    return null;
  };

  const loadEmployeeData = async () => {
    try {
      const salesRef = collection(db, 'allente_kontraktsarkiv');
      const snapshot = await getDocs(salesRef);
      
      const contracts: SalesRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        contracts.push({ id: doc.id, ...data });
      });

      // Filter for this employee
      const employeeContracts = contracts.filter(c => c.selger === user?.externalName);

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const salesToday = employeeContracts.filter(c => {
        const date = parseDate(c.dato);
        return date && date.getTime() === today.getTime();
      }).length;

      const salesThisWeek = employeeContracts.filter(c => {
        const date = parseDate(c.dato);
        return date && date >= weekStart && date <= today;
      }).length;

      const salesThisMonth = employeeContracts.filter(c => {
        const date = parseDate(c.dato);
        return date && date >= monthStart && date <= today;
      }).length;

      setStats([
        { value: salesToday, label: 'Dag', color: '#E8956E' },
        { value: salesThisWeek, label: 'Uke', color: '#E8956E' },
        { value: salesThisMonth, label: 'Måned', color: '#E8956E' },
        { value: Math.round(employeeContracts.length / 12), label: 'År', color: '#5B7FFF' },
        { value: employeeContracts.length, label: 'Altid', color: '#A855C9' },
      ]);

      // Badges: simplified - show if they have sales
      const badges: string[] = [];
      if (employeeContracts.length > 0) badges.push('🎓'); // First sale
      if (salesToday >= 5) badges.push('🚀');
      if (salesToday >= 10) badges.push('🎯');
      if (salesToday >= 15) badges.push('🔥');
      if (salesToday >= 20) badges.push('💎');
      setEarnedBadges(badges.length > 0 ? badges : ['🏆']); // Show at least one badge
    } catch (err) {
      console.error('Error loading employee data:', err);
    } finally {
      setLoading(false);
    }
  };

  const allBadges = ['🏆', '👑', '⭐', '🎓', '🚀', '🎯', '🔥', '💎', '💪', '☀️', '⚡', '🎭', '🏅', '🎖️'];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
        Laster personlig data...
      </div>
    );
  }

  return (
    <div className="minside-container">
      {/* Profile Banner */}
      <div className="profile-banner">
        <div className="banner-left">
          <div className="profile-image">👤</div>
        </div>
        
        <div className="banner-center">
          <h1 className="user-name">{user?.name}</h1>
          <p className="user-subtitle">{user?.role || '-'} • {user?.department || '-'} • {user?.project || '-'}</p>
          <div className="badges-row">
            {allBadges.map((badge, idx) => (
              <div key={idx} className={`badge-circle ${earnedBadges.includes(badge) ? '' : 'unused'}`} style={{ opacity: earnedBadges.includes(badge) ? 1 : 0.3 }}>
                {badge}
              </div>
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
      </div>
    </div>
  );
}
