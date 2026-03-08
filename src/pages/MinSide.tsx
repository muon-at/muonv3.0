import { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
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
  const [progressData, setProgressData] = useState({
    dailyProgress: 0,
    dailyGoal: 0,
    weeklyProgress: 0,
    weeklyGoalValue: 0,
    monthlyProgress: 0,
    monthlyGoalValue: 0,
  });

  const [runRates, setRunRates] = useState({
    dailyTo16: 0,
    dailyTo21: 0,
    weekly: 0,
    monthly: 0,
  });

  // Load saved goals from Firestore
  const loadSavedGoals = async () => {
    try {
      const externalName = user?.externalName || user?.name || '';
      if (!externalName) return;
      
      const goalsRef = doc(db, 'employee_goals', externalName);
      const goalsDoc = await getDoc(goalsRef);
      
      if (goalsDoc.exists()) {
        const data = goalsDoc.data();
        if (data.weeklyGoal) setWeeklyGoal(data.weeklyGoal);
        if (data.monthlyGoal) setMonthlyGoal(data.monthlyGoal);
        console.log('✅ Goals loaded from Firestore:', data);
      }
    } catch (err) {
      console.error('Error loading goals:', err);
    }
  };

  useEffect(() => {
    loadEmployeeData();
    loadSavedGoals();
    // Load cached badges from Firestore
    loadCachedBadges();
  }, [user]);

  // Count working days (weekdays only, no weekends)
  const countWorkingDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let count = 0;
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++; // Skip Sunday (0) and Saturday (6)
    }
    return count;
  };

  // Count working days from start of month to today
  const countWorkingDaysThisMonth = (date: Date) => {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    
    let count = 0;
    for (let d = new Date(monthStart); d <= date; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  // Calculate run rates
  const calculateRunRates = (
    emojiCount: number,
    salesWeekly: number,
    salesMonthly: number
  ) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0); // 09:00
    const hoursWorked = Math.max(0, (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60));
    
    // Daily to 16:00 (6 working hours: 9-10, 10-11, 11-12, 12-13, 14-15, 15-16)
    const dailyTo16 = hoursWorked > 0 ? (emojiCount / hoursWorked) * 6 : 0;
    
    // Daily to 21:00 (10 working hours: 9-10, 10-11, 11-12, 12-13, 14-15, 15-16, 16-17, 17-18, 18-19, 19-21)
    const dailyTo21 = hoursWorked > 0 ? (emojiCount / hoursWorked) * 10 : 0;
    
    // Weekly: (today's emoji + week sales) / 5 days (hardcoded for consistency, allows testing on any day)
    const totalSalesWeek = emojiCount + salesWeekly;
    const weekly = totalSalesWeek / 5;
    
    // Monthly: (today's emoji + month sales) / actual working days in month (excluding weekends)
    const workingDaysMonth = countWorkingDaysThisMonth(now);
    const totalWorkingDaysInMonth = countWorkingDaysInMonth(now);
    const totalSalesMonth = emojiCount + salesMonthly;
    const monthly = workingDaysMonth > 0 ? (totalSalesMonth / workingDaysMonth) * totalWorkingDaysInMonth : 0;
    
    return {
      dailyTo16: Math.round(dailyTo16 * 100) / 100,
      dailyTo21: Math.round(dailyTo21 * 100) / 100,
      weekly: Math.round(weekly * 100) / 100,
      monthly: Math.round(monthly * 100) / 100,
    };
  };

  // Update progress data when goals change
  useEffect(() => {
    setProgressData(prev => ({
      ...prev,
      dailyGoal: weeklyGoal > 0 ? Math.ceil(weeklyGoal / 5) : 0,
      weeklyGoalValue: weeklyGoal,
      monthlyGoalValue: monthlyGoal,
    }));
  }, [weeklyGoal, monthlyGoal]);

  // Update run rates every minute (real-time tracking)
  useEffect(() => {
    const timer = setInterval(() => {
      const rates = calculateRunRates(
        progressData.dailyProgress,
        progressData.weeklyProgress - progressData.dailyProgress,
        progressData.monthlyProgress - progressData.dailyProgress
      );
      setRunRates(rates);
    }, 60000); // Update every minute
    
    // Calculate immediately on load
    const rates = calculateRunRates(
      progressData.dailyProgress,
      progressData.weeklyProgress - progressData.dailyProgress,
      progressData.monthlyProgress - progressData.dailyProgress
    );
    setRunRates(rates);
    
    return () => clearInterval(timer);
  }, [progressData]);

  const loadCachedBadges = async () => {
    try {
      const externalName = user?.externalName || '';
      if (!externalName) return;
      
      // Load badges from user_earned_badges collection (cached from last calculation)
      const badgeDocRef = doc(db, 'user_earned_badges', externalName);
      const badgeSnapshot = await getDoc(badgeDocRef);
      
      if (badgeSnapshot.exists()) {
        const badgeData = badgeSnapshot.data();
        const userEarnedBadges = badgeData.badges || [];
        const statusMap = badgeData.badgeMap || {};
        
        setEarnedBadges(userEarnedBadges);
        setBadgeStatus(statusMap);
      }
    } catch (err) {
      console.error('Error loading cached badges:', err);
    }
  };

  const saveBadges = async (badgeMap: { [key: string]: boolean }) => {
    try {
      const externalName = user?.externalName || '';
      if (!externalName) return;
      
      // Save earned badges to user_earned_badges collection
      const earnedBadges = Object.keys(badgeMap).filter(emoji => badgeMap[emoji]);
      const badgesRef = doc(db, 'user_earned_badges', externalName);
      await setDoc(badgesRef, { 
        badges: earnedBadges, 
        badgeMap: badgeMap,
        updatedAt: new Date() 
      });
    } catch (err) {
      console.error('Error saving badges:', err);
    }
  };

  // Load emoji counts for today
  const loadEmojiCountsForToday = async () => {
    try {
      const today = new Date();
      const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const emojiCountsRef = doc(db, 'emoji_counts_daily', dateKey);
      const emojiDoc = await getDoc(emojiCountsRef);
      
      if (emojiDoc.exists()) {
        const data = emojiDoc.data();
        const counts = data.counts || {};
        
        // Get current user's name (try both externalName and full name)
        const userName = user?.name || '';
        const userEmojis = counts[userName] || { '🔔': 0, '💎': 0 };
        
        console.log('📊 Emoji counts for', userName, ':', userEmojis);
        
        // Return sum of 🔔 (1 pt) + 💎 (1 pt)
        return (userEmojis['🔔'] || 0) + (userEmojis['💎'] || 0);
      }
      return 0;
    } catch (err) {
      console.error('Error loading emoji counts:', err);
      return 0;
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
      const yearStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year

      // Load emoji counts for today (🔔 + 💎)
      const emojiCountToday = await loadEmojiCountsForToday();

      const salesThisWeek = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= weekStart && date <= today;
      }).length;

      const salesThisMonth = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= monthStart && date <= today;
      }).length;

      const salesThisYear = employeeContracts.filter(c => {
        const date = parseDate(c.dato || '');
        return date && date >= yearStart && date <= today;
      }).length;

      const total = employeeContracts.length;

      // Calculate best day (highest number of contracts on any single date)
      const dayMap: { [key: string]: number } = {};
      employeeContracts.forEach(c => {
        const dateStr = c.dato || '';
        if (dateStr) {
          dayMap[dateStr] = (dayMap[dateStr] || 0) + 1;
        }
      });
      const bestDay = Math.max(0, ...Object.values(dayMap));
      console.log('📅 Best day for', user?.name, ':', bestDay, 'contracts');

      // Calculate progress data for bars
      const dailyGoalCalc = weeklyGoal > 0 ? Math.ceil(weeklyGoal / 5) : 0;
      
      setProgressData({
        dailyProgress: emojiCountToday,
        dailyGoal: dailyGoalCalc,
        weeklyProgress: salesThisWeek,
        weeklyGoalValue: weeklyGoal,
        monthlyProgress: salesThisMonth,
        monthlyGoalValue: monthlyGoal,
      });

      setStats([
        { value: bestDay, label: 'Dag', color: '#E8956E', icon: '📊' },
        { value: salesThisWeek, label: 'Uke', color: '#E8956E', icon: '📈' },
        { value: salesThisMonth, label: 'Måned', color: '#E8956E', icon: '🎯' },
        { value: salesThisYear, label: 'År', color: '#5B7FFF', icon: '📅' },
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
        }
      });
      
      // Calculate best day for each employee
      Object.keys(employeeStats).forEach(selger => {
        const salesByDay = employeeStats[selger].salesByDay;
        employeeStats[selger].bestDay = Math.max(0, ...Object.values(salesByDay));
        

      });

      // Find best performers
      let bestOverall = '';
      let maxTotal = -1;
      let bestThisMonth = '';
      let maxMonth = -1;

      Object.entries(employeeStats).forEach(([name, stats]) => {
        if (stats.total > maxTotal) {
          maxTotal = stats.total;
          bestOverall = name;
        }
        if (stats.month > maxMonth) {
          maxMonth = stats.month;
          bestThisMonth = name;
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

      // Badge calculation complete
      setEarnedBadges(earnedBadgesList.map(b => b.badge));
      
      // Store earned status map for styling
      const statusMap: { [key: string]: boolean } = {};
      earnedBadgesList.forEach(b => {
        statusMap[b.badge] = b.earned;
      });
      setBadgeStatus(statusMap);
      console.log('✅ Badge Status Map:', statusMap);
      
      // Save badges to Firestore for all employees to see on their Min Side
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
                    const isEarned = badgeStatus[badge] !== false;
                    // Find badge definition to get name
                    const badgeDef = badgeDefinitions.find(b => b.emoji === badge);
                    const badgeName = badgeDef?.navn || `Badge ${idx + 1}`;
                    const tooltipText = `${badge} ${badgeName}${isEarned ? '' : ' (locked)'}`;
                    
                    return (
                      <span 
                        key={idx} 
                        style={{ 
                          fontSize: '2rem', 
                          lineHeight: '1',
                          opacity: isEarned ? 1 : 0.3,
                          filter: isEarned ? 'none' : 'grayscale(100%)',
                          transition: 'opacity 0.3s ease',
                          cursor: 'pointer'
                        }} 
                        title={tooltipText}
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
          className={`main-tab ${activeTab === 'target' ? 'active' : ''}`}
          onClick={() => setActiveTab('target')}
        >
          🎯 Mål
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



      {/* MAIN CONTENT - STATS TAB */}
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

        {/* PROGRESS BARS */}
        <div className="progress-section">
          <div className="progress-item">
            <div className="progress-label">
              <span>Dagens Mål</span>
              <span>{progressData.dailyGoal > 0 ? Math.round((progressData.dailyProgress / progressData.dailyGoal) * 100) : 0}%</span>
            </div>
            <div className="progress-bar blue">
              <div className="progress-fill" style={{ width: `${progressData.dailyGoal > 0 ? Math.min((progressData.dailyProgress / progressData.dailyGoal) * 100, 100) : 0}%` }}></div>
            </div>
            <div className="progress-text">{progressData.dailyProgress} / {progressData.dailyGoal} <span className="checkmark">{progressData.dailyProgress >= progressData.dailyGoal ? '✓ Mål nådd' : ''}</span></div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>Ukes Mål</span>
              <span>{progressData.weeklyGoalValue > 0 ? Math.round((progressData.weeklyProgress / progressData.weeklyGoalValue) * 100) : 0}%</span>
            </div>
            <div className="progress-bar green">
              <div className="progress-fill" style={{ width: `${progressData.weeklyGoalValue > 0 ? Math.min((progressData.weeklyProgress / progressData.weeklyGoalValue) * 100, 100) : 0}%` }}></div>
            </div>
            <div className="progress-text">{progressData.weeklyProgress} / {progressData.weeklyGoalValue} <span className="checkmark">{progressData.weeklyProgress >= progressData.weeklyGoalValue ? '✓ Mål nådd' : ''}</span></div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>Måneds Mål</span>
              <span>{progressData.monthlyGoalValue > 0 ? Math.round((progressData.monthlyProgress / progressData.monthlyGoalValue) * 100) : 0}%</span>
            </div>
            <div className="progress-bar orange">
              <div className="progress-fill" style={{ width: `${progressData.monthlyGoalValue > 0 ? Math.min((progressData.monthlyProgress / progressData.monthlyGoalValue) * 100, 100) : 0}%` }}></div>
            </div>
            <div className="progress-text">{progressData.monthlyProgress} / {progressData.monthlyGoalValue} <span className="checkmark">{progressData.monthlyProgress >= progressData.monthlyGoalValue ? '✓ Mål nådd' : ''}</span></div>
          </div>
        </div>

        {/* RUN RATE BOXES */}
        <div className="runrate-section">
          {/* Box 1: Daily Run Rates */}
          <div className="runrate-box">
            <div className="runrate-label">Dagens Runrate</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-time">→ 16:00</span>
                <span className="runrate-value">{runRates.dailyTo16.toFixed(1)}</span>
                <span className="runrate-unit">salg/dag</span>
              </div>
              <div className="runrate-divider">|</div>
              <div className="runrate-metric">
                <span className="runrate-time">→ 21:00</span>
                <span className="runrate-value">{runRates.dailyTo21.toFixed(1)}</span>
                <span className="runrate-unit">salg/dag</span>
              </div>
            </div>
          </div>

          {/* Box 2: Weekly Run Rate */}
          <div className="runrate-box">
            <div className="runrate-label">Ukes Runrate</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-value">{runRates.weekly.toFixed(1)}</span>
                <span className="runrate-unit">salg/uke</span>
              </div>
            </div>
          </div>

          {/* Box 3: Monthly Run Rate */}
          <div className="runrate-box">
            <div className="runrate-label">Månedens Runrate</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-value">{runRates.monthly.toFixed(1)}</span>
                <span className="runrate-unit">salg/måned</span>
              </div>
            </div>
          </div>
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

      {activeTab === 'target' && (
      <div className="tab-content">
        <div className="goals-header" style={{ marginBottom: '2rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🎯</span>
          <div>
            <h3>Mine Mål</h3>
            <p>Ukesmål & Månedsmål</p>
          </div>
        </div>

        <div className="goals-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
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

        <button 
          className="edit-goals-btn" 
          onClick={async () => {
            if (showGoalEdit) {
              // Save mode: save and close
              try {
                const externalName = user?.externalName || user?.name || '';
                if (externalName) {
                  const goalsRef = doc(db, 'employee_goals', externalName);
                  await setDoc(goalsRef, {
                    weeklyGoal,
                    monthlyGoal,
                    updatedAt: new Date(),
                  }, { merge: true });
                  console.log('✅ Goals saved:', { weeklyGoal, monthlyGoal });
                }
              } catch (err) {
                console.error('❌ Error saving goals:', err);
              }
              setShowGoalEdit(false);
            } else {
              // Edit mode: open
              setShowGoalEdit(true);
            }
          }}
        >
          {showGoalEdit ? 'Lagre' : 'Endre mål'}
        </button>

        {showGoalEdit && (
          <div className="goal-edit-form">
            <input 
              type="number" 
              value={weeklyGoal} 
              onChange={(e) => setWeeklyGoal(parseInt(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              placeholder="Ukesmål"
              autoFocus
            />
            <input 
              type="number" 
              value={monthlyGoal} 
              onChange={(e) => setMonthlyGoal(parseInt(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              placeholder="Månedsmål"
            />
          </div>
        )}
      </div>
      )}


    </div>
  );
}
