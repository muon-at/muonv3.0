import { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MinSide.css';

interface SalesRecord {
  dato?: string;
  selger?: string;
  id?: string;
}

const allBadges = ['🏆', '🎓', '🚀', '🎯', '🔥', '⚡', '💎', '👑', '🌟', '🎪', '🎨', '🎭', '🎬', '🎸', '🎺'];

const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  const trimmed = dateStr.trim();
  
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const ddmmyyyy2Match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy2Match) {
    const [, day, month, year] = ddmmyyyy2Match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return new Date(dateStr);
};

export default function MinSide() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(0);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(0);
  const [showGoalEdit, setShowGoalEdit] = useState(false);

  useEffect(() => {
    loadEmployeeData();
  }, [user]);

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
      const employeeContracts = contracts.filter(c => {
        const selger = c.selger || '';
        const externalName = user?.externalName || '';
        return selger === externalName || selger.startsWith(externalName + ' /');
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const salesToday = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date.getTime() === today.getTime();
      }).length;

      const salesThisWeek = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= weekStart && date <= today;
      }).length;

      const salesThisMonth = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= monthStart && date <= today;
      }).length;

      const avgPerDay = Math.round(employeeContracts.length / 365);
      const total = employeeContracts.length;

      setStats([
        { value: salesToday, label: 'Dag', color: '#E8956E', icon: '📊' },
        { value: salesThisWeek, label: 'Uke', color: '#E8956E', icon: '📈' },
        { value: salesThisMonth, label: 'Måned', color: '#E8956E', icon: '🎯' },
        { value: avgPerDay, label: 'År', color: '#5B7FFF', icon: '📅' },
        { value: total, label: 'Altid', color: '#A855C9', icon: '⭐' },
      ]);

      // Calculate badges
      const badges: string[] = [];
      if (salesToday >= 5) badges.push(allBadges[2]); // 🚀
      if (salesToday >= 10) badges.push(allBadges[3]); // 🎯
      if (salesToday >= 15) badges.push(allBadges[4]); // 🔥
      if (salesToday >= 20) badges.push(allBadges[5]); // ⚡
      if (total > 0) badges.push(allBadges[1]); // 🎓
      if (total > 100) badges.push(allBadges[0]); // 🏆

      setEarnedBadges(badges);
      setLoading(false);
    } catch (err) {
      console.error('Error loading employee data:', err);
      setLoading(false);
    }
  };

  if (loading) return <div className="minside-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Laster...</div></div>;

  return (
    <div className="minside-container">
      {/* HEADER - SAME AS ADMIN & TEAMLEDER */}
      <div className="page-header-standard">
        <div className="header-left">
          <div>
            <h1>👤 Min Side</h1>
            <p className="subtitle">Din personlige oversikt og prestasjonsbadges</p>
          </div>
        </div>
      </div>



      {/* MAIN CONTENT */}
      <div className="minside-main">
        <div className="stats-circles">
          <div className="trophy-placeholder">🏆</div>
          {stats.map((stat, idx) => (
            <div key={idx} className="stat-circle" style={{ backgroundColor: stat.color }}>
              <div className="stat-number">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
          <div className="trophy-placeholder">🏆</div>
        </div>

        <div className="goals-sidebar">
          <div className="goals-header">
            <span style={{ fontSize: '1.2rem' }}>🎯</span>
            <div>
              <h3>Mine Mål</h3>
              <p>Ukesmål & Månedsmål</p>
            </div>
          </div>

          <div className="goals-stats">
            <div className="goal-stat">
              <span className="goal-label">UKESMÅL</span>
              <span className="goal-value">{weeklyGoal}</span>
              <span className="goal-unit">ordrer/uke</span>
            </div>
            <div className="goal-stat">
              <span className="goal-label">MÅNEDSMÅL</span>
              <span className="goal-value">{monthlyGoal}</span>
              <span className="goal-unit">ordrer/måned</span>
            </div>
          </div>

          <button className="edit-goals-btn" onClick={() => setShowGoalEdit(!showGoalEdit)}>
            Endre mål
          </button>

          {showGoalEdit && (
            <div className="goal-edit-form">
              <input 
                type="number" 
                value={weeklyGoal} 
                onChange={(e) => setWeeklyGoal(parseInt(e.target.value))}
                placeholder="Ukesmål"
              />
              <input 
                type="number" 
                value={monthlyGoal} 
                onChange={(e) => setMonthlyGoal(parseInt(e.target.value))}
                placeholder="Månedsmål"
              />
            </div>
          )}
        </div>
      </div>

      {/* BADGES SECTION */}
      <div className="badges-section">
        <div className="badges-header">
          <h2>🎖️ Dine Merker</h2>
          <p>Oppsummering av dine prestasjonsbadges</p>
        </div>
        <div className="badges-grid">
          {allBadges.map((badge, idx) => (
            <div key={idx} className={`badge-item ${earnedBadges.includes(badge) ? 'earned' : 'locked'}`}>
              <div className="badge-icon">{badge}</div>
              <div className="badge-info">
                <div className="badge-name">Badge {idx + 1}</div>
                <div className="badge-desc">{earnedBadges.includes(badge) ? '✓ Oppnådd' : 'Låst'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PROGRESS BARS */}
      <div className="progress-section">
        <div className="progress-item">
          <div className="progress-label">
            <span>Dagens Mål</span>
            <span>100%</span>
          </div>
          <div className="progress-bar blue">
            <div className="progress-fill" style={{ width: '100%' }}></div>
          </div>
          <div className="progress-text">4 / 33 <span className="checkmark">✓ Mål nådd</span></div>
        </div>

        <div className="progress-item">
          <div className="progress-label">
            <span>Ukes Mål</span>
            <span>100%</span>
          </div>
          <div className="progress-bar green">
            <div className="progress-fill" style={{ width: '100%' }}></div>
          </div>
          <div className="progress-text">32 / 25 <span className="checkmark">✓ Mål nådd</span></div>
        </div>

        <div className="progress-item">
          <div className="progress-label">
            <span>Måneds Mål</span>
            <span>100%</span>
          </div>
          <div className="progress-bar orange">
            <div className="progress-fill" style={{ width: '100%' }}></div>
          </div>
          <div className="progress-text">103 / 100 <span className="checkmark">✓ Mål nådd</span></div>
        </div>
      </div>
    </div>
  );
}
