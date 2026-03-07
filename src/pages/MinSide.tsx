import { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MinSide.css';

interface SalesRecord {
  dato?: string;
  selger?: string;
  id?: string;
}

interface BadgeDefinition {
  emoji: string;
  navn: string;
  verdi: string;
  beskrivelse: string;
}

// Badge definitions - only show badges with descriptions (from Admin panel)
const badgeDefinitions: BadgeDefinition[] = [
  { emoji: '🏆', navn: 'BEST', verdi: 'Løpende', beskrivelse: 'Den som har flest salg totalt (kun en)' },
  { emoji: '👑', navn: 'MVP MÅNED', verdi: 'Historisk', beskrivelse: 'Har vært best i minst en måned' },
  { emoji: '⭐', navn: 'MVP DAG', verdi: 'Historisk', beskrivelse: 'Har vært best på minst en dag' },
  { emoji: '🎓', navn: 'FØRSTE SALGET', verdi: '1+', beskrivelse: '1+ salg totalt' },
  { emoji: '🚀', navn: '5 SALG', verdi: '5+', beskrivelse: '5+ salg på EN dag' },
  { emoji: '🎯', navn: '10 SALG', verdi: '10+', beskrivelse: '10+ salg på EN dag' },
  { emoji: '🔥', navn: '15 SALG', verdi: '15+', beskrivelse: '15+ salg på EN dag' },
  { emoji: '💎', navn: '20 SALG', verdi: '20+', beskrivelse: '20+ salg på EN dag' },
];

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
  const [badgeStatus, setBadgeStatus] = useState<{ [key: string]: boolean }>({});
  const [weeklyGoal, setWeeklyGoal] = useState<number>(0);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(0);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    loadEmployeeData();
    // Load cached badges from Firestore
    loadCachedBadges();
  }, [user]);

  const loadCachedBadges = async () => {
    try {
      const externalName = user?.externalName || '';
      console.log('🔍 loadCachedBadges called for:', externalName);
      if (!externalName) {
        console.log('⚠️ No externalName, skipping');
        return;
      }
      
      // Load badges from allente_badges collection (where Admin Dashboard stores them)
      const badgesRef = collection(db, 'allente_badges');
      const snapshot = await getDocs(badgesRef);
      console.log(`📊 Found ${snapshot.size} total badges in Firestore`);
      
      const userEarnedBadges: string[] = [];
      const statusMap: { [key: string]: boolean } = {};
      
      // Initialize all badges as unearned
      badgeDefinitions.forEach(def => {
        statusMap[def.emoji] = false;
      });
      
      // Mark earned badges
      snapshot.forEach(doc => {
        const badgeData = doc.data();
        const emoji = badgeData.emoji;
        const selger = badgeData.selger || '';
        
        // Check if this badge belongs to current user
        // Handle both "Name" and "Name / rolle" formats
        const matches = 
          selger === externalName || 
          selger.includes(externalName) || 
          selger.startsWith(externalName + ' /');
        
        if (matches && statusMap[emoji] !== undefined) {
          statusMap[emoji] = true;
          userEarnedBadges.push(emoji);
          console.log(`  ✅ ${emoji} earned for ${selger}`);
        }
      });
      
      console.log(`✅ FINAL: ${userEarnedBadges.length} badges for ${externalName}:`, userEarnedBadges);
      
      setEarnedBadges(userEarnedBadges);
      setBadgeStatus(statusMap);
    } catch (err) {
      console.error('Error loading cached badges:', err);
    }
  };

  const saveBadges = async (badgeMap: { [key: string]: boolean }) => {
    try {
      const externalName = user?.externalName || '';
      if (!externalName) return;
      
      const badgesRef = doc(db, 'employee_badges', externalName);
      await setDoc(badgesRef, { badges: badgeMap, updatedAt: new Date() });
      console.log('💾 Saved badges to Firestore for', externalName);
    } catch (err) {
      console.error('Error saving badges:', err);
    }
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

      // Calculate all employee stats for comparison
      const employeeStats: { [name: string]: { today: number; month: number; total: number; bestDay: number; salesByDay: { [date: string]: number } } } = {};
      
      contracts.forEach(c => {
        const selger = c.selger || '';
        const date = parseDate(c.dato || '');
        const dateStr = date ? date.toISOString().split('T')[0] : '';
        
        if (!employeeStats[selger]) {
          employeeStats[selger] = { today: 0, month: 0, total: 0, bestDay: 0, salesByDay: {} };
        }
        
        if (date && date.getTime() === today.getTime()) {
          employeeStats[selger].today++;
        }
        if (date && date >= monthStart && date <= today) {
          employeeStats[selger].month++;
        }
        employeeStats[selger].total++;
        
        // Track sales by day to find best day
        if (dateStr) {
          employeeStats[selger].salesByDay[dateStr] = (employeeStats[selger].salesByDay[dateStr] || 0) + 1;
        } else if (selger.includes('Oliver')) {
          console.log(`⚠️ Oliver contract with no valid date:`, { dato: c.dato, parsed: date });
        }
      });
      
      // Calculate best day for each employee
      Object.keys(employeeStats).forEach(selger => {
        const salesByDay = employeeStats[selger].salesByDay;
        employeeStats[selger].bestDay = Math.max(0, ...Object.values(salesByDay));
        
        // Debug log for Oliver
        if (selger.includes('Oliver')) {
          console.log(`🔍 Oliver's salesByDay:`, salesByDay);
          console.log(`🔍 Oliver's bestDay:`, employeeStats[selger].bestDay);
        }
      });

      // Find best performers
      let bestOverall = '';
      let maxTotal = -1;
      let bestThisMonth = '';
      let maxMonth = -1;
      let bestToday = '';
      let maxToday = -1;

      Object.entries(employeeStats).forEach(([name, stats]) => {
        if (stats.total > maxTotal) {
          maxTotal = stats.total;
          bestOverall = name;
        }
        if (stats.month > maxMonth) {
          maxMonth = stats.month;
          bestThisMonth = name;
        }
        if (stats.today > maxToday) {
          maxToday = stats.today;
          bestToday = name;
        }
      });

      // Calculate badges based on definitions
      const earnedBadgesList: { badge: string; earned: boolean }[] = [];
      const externalName = user?.externalName || '';
      
      // Find matching employee in stats (might be "Name / rolle" format)
      let userStatsKey = externalName;
      if (!employeeStats[externalName]) {
        // Try to find by name prefix (handle "Name / rolle" format)
        const matchingKey = Object.keys(employeeStats).find(k => 
          k.startsWith(externalName) || k.includes(externalName)
        );
        if (matchingKey) {
          userStatsKey = matchingKey;
        }
      }
      
      const userBestDay = employeeStats[userStatsKey]?.bestDay || 0;
      
      console.log(`🔍 Looking up externalName="${externalName}" in employeeStats:`, {
        externalName,
        userStatsKey,
        found: employeeStats[userStatsKey] ? 'YES' : 'NO',
        userStats: employeeStats[userStatsKey],
        userBestDay,
        sampleKeys: Object.keys(employeeStats).slice(0, 3)
      });
      
      badgeDefinitions.forEach(def => {
        let earned = false;
        
        if (def.navn === 'BEST') {
          earned = userStatsKey !== '' && employeeStats[userStatsKey]?.total > 0 && bestOverall === userStatsKey;
        } else if (def.navn === 'MVP MÅNED') {
          earned = userStatsKey !== '' && employeeStats[userStatsKey]?.month > 0 && bestThisMonth === userStatsKey;
        } else if (def.navn === 'MVP DAG') {
          // MVP DAG: Ever had a best day (historisk) - if bestDay > 5
          earned = userBestDay >= 6;  // If they had 6+ salg on their best day
        } else if (def.navn === 'FØRSTE SALGET') {
          earned = total > 0;
        } else if (def.navn === '5 SALG') {
          // 5+ salg på EN dag (historisk best day)
          earned = userBestDay >= 5;
        } else if (def.navn === '10 SALG') {
          // 10+ salg på EN dag (historisk best day)
          earned = userBestDay >= 10;
        } else if (def.navn === '15 SALG') {
          // 15+ salg på EN dag (historisk best day)
          earned = userBestDay >= 15;
        } else if (def.navn === '20 SALG') {
          // 20+ salg på EN dag (historisk best day)
          earned = userBestDay >= 20;
        }
        
        earnedBadgesList.push({ badge: def.emoji, earned });
      });

      // Debug logging
      const earnedCount = earnedBadgesList.filter(b => b.earned).length;
      console.log(`✅ ${user?.name} badges:`, {
        earned: earnedBadgesList.filter(b => b.earned).map(b => b.badge),
        unearned: earnedBadgesList.filter(b => !b.earned).map(b => b.badge),
        earnedCount,
        salesToday,
        bestDayEver: userBestDay,
        totalSales: total,
        bestToday,
        bestThisMonth,
        bestOverall
      });
      setEarnedBadges(earnedBadgesList.map(b => b.badge));
      
      // Store earned status map for styling
      const statusMap: { [key: string]: boolean } = {};
      earnedBadgesList.forEach(b => {
        statusMap[b.badge] = b.earned;
      });
      setBadgeStatus(statusMap);
      console.log('✅ Badge Status Map:', statusMap);
      
      // Save badges to Firestore for persistence across pages
      await saveBadges(statusMap);
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading employee data:', err);
      setLoading(false);
    }
  };

  if (loading) return <div className="minside-container"><div style={{ padding: '2rem', textAlign: 'center' }}>Laster...</div></div>;

  console.log('🏅 Rendering MinSide with earnedBadges:', earnedBadges);

  return (
    <div className="minside-container">
      {/* HEADER - SHOW USER NAME + ROLE + EARNED BADGES */}
      <div className="page-header-standard minside-header-large">
        <div className="header-left">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <h1>{user?.name}</h1>
              {/* All Badges in Header - Earned and Unearned */}
              {earnedBadges.length > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {earnedBadges.map((badge, idx) => {
                    const isEarned = badgeStatus[badge] !== false; // Treat undefined as earned for backwards compat
                    return (
                      <span 
                        key={idx} 
                        style={{ 
                          fontSize: '2rem', 
                          lineHeight: '1',
                          opacity: isEarned ? 1 : 0.3,
                          filter: isEarned ? 'none' : 'grayscale(100%)',
                          transition: 'opacity 0.3s ease'
                        }} 
                        title={isEarned ? `Badge ${idx + 1} - Earned` : `Badge ${idx + 1} - Locked`}
                      >
                        {badge}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="subtitle">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="main-tabs">
        <button 
          className={`main-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Mine Stats
        </button>
        <button 
          className={`main-tab ${activeTab === 'avd' ? 'active' : ''}`}
          onClick={() => setActiveTab('avd')}
        >
          🏢 Min Avdeling
        </button>
        <button 
          className={`main-tab ${activeTab === 'project' ? 'active' : ''}`}
          onClick={() => setActiveTab('project')}
        >
          💼 Prosjekt
        </button>
      </div>



      {/* MAIN CONTENT */}
      {activeTab === 'stats' && (
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
      )}

      {activeTab === 'avd' && (
      <div className="tab-content">
        <div className="content-title">
          <h3>Avdeling: {user?.department}</h3>
          <p className="content-subtitle">Se alle kontrakter fra {user?.department}</p>
        </div>
        <p>Innhold for avdeling kommer snart...</p>
      </div>
      )}

      {activeTab === 'project' && (
      <div className="tab-content">
        <div className="content-title">
          <h3>Prosjekt: {user?.project}</h3>
          <p className="content-subtitle">Se alle kontrakter fra prosjektet ditt</p>
        </div>
        <p>Innhold for prosjekt kommer snart...</p>
      </div>
      )}

      {activeTab === 'stats' && (
      <>

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
      </>
      )}
    </div>
  );
}
