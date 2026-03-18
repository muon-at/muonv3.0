import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/Status.css';

interface Target {
  day: number;
  week: number;
  month: number;
}

interface DailyStat {
  date: string;
  count: number;
  revenue: number;
}

interface Badge {
  id: string;
  emoji: string;
  navn: string;
  verdi: number;
  beskrivelse: string;
}

export default function Status() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<Target>({
    day: 5,
    week: 25,
    month: 100,
  });
  const [todayStats, setTodayStats] = useState<DailyStat>({
    date: new Date().toLocaleDateString('no-NO'),
    count: 0,
    revenue: 0,
  });
  const [weekStats, setWeekStats] = useState<DailyStat>({
    date: 'Denne uken',
    count: 0,
    revenue: 0,
  });
  const [monthStats, setMonthStats] = useState<DailyStat>({
    date: 'Denne måneden',
    count: 0,
    revenue: 0,
  });
  const [editingTarget, setEditingTarget] = useState<'day' | 'week' | 'month' | null>(null);
  const [tempValue, setTempValue] = useState<number>(0);
  const [runRates, setRunRates] = useState({
    day: 0,
    week: 0,
    month: 0,
  });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievedBadges, setAchievedBadges] = useState<string[]>([]);

  // Load data from Progresjon/livefeed - Runs on mount AND every time page is visited
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfToday = today.getTime();
      const startOfTomorrow = new Date(today);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const endOfToday = startOfTomorrow.getTime();

      try {
        // Get today's stats
        const todayQuery = query(
          collection(db, 'livefeed_sales'),
          where('timestamp', '>=', startOfToday),
          where('timestamp', '<', endOfToday),
          where('userId', '==', user.id)
        );
        const todaySnap = await getDocs(todayQuery);
        const todayCount = todaySnap.size;
        const todayRevenue = todaySnap.docs.reduce((sum, doc) => sum + (doc.data().productPrice || 0), 0);
        setTodayStats({
          date: new Date().toLocaleDateString('no-NO'),
          count: todayCount,
          revenue: todayRevenue,
        });

        // Calculate runrates
        const now = new Date();
        const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
        const dayRunRate = hoursElapsed > 0 ? Math.round((todayCount / hoursElapsed) * 8) : 0;
        
        // Get week stats (simplified - last 7 days)
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        const weekQuery = query(
          collection(db, 'livefeed_sales'),
          where('timestamp', '>=', weekStart.getTime()),
          where('userId', '==', user.id)
        );
        const weekSnap = await getDocs(weekQuery);
        const weekCount = weekSnap.size;
        const weekRevenue = weekSnap.docs.reduce((sum, doc) => sum + (doc.data().productPrice || 0), 0);
        const weekRunRate = weekCount > 0 ? Math.round((weekCount / 7) * 7) : 0;
        setWeekStats({
          date: 'Denne uken',
          count: weekCount,
          revenue: weekRevenue,
        });

        // Get month stats
        const monthStart = new Date(today);
        monthStart.setDate(1);
        const monthQuery = query(
          collection(db, 'livefeed_sales'),
          where('timestamp', '>=', monthStart.getTime()),
          where('userId', '==', user.id)
        );
        const monthSnap = await getDocs(monthQuery);
        const monthCount = monthSnap.size;
        const monthRevenue = monthSnap.docs.reduce((sum, doc) => sum + (doc.data().productPrice || 0), 0);
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const monthRunRate = monthCount > 0 ? Math.round((monthCount / today.getDate()) * daysInMonth) : 0;
        setMonthStats({
          date: new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }),
          count: monthCount,
          revenue: monthRevenue,
        });

        setRunRates({
          day: dayRunRate,
          week: weekRunRate,
          month: monthRunRate,
        });
      } catch (err) {
        console.error('Error loading stats:', err);
      }
    };

    loadStats();
  }, [user?.id]);

  // Load badges from Firestore - Option B: emoji as field, not doc ID
  useEffect(() => {
    const loadBadges = async () => {
      try {
        const badgesSnap = await getDocs(collection(db, 'allente_badges'));
        const badgesList: Badge[] = [];
        const achievedList: string[] = [];

        // Test data - fallback for now
        const testBadges: Badge[] = [
          { id: 'gold', emoji: '🥇', navn: 'Gold', verdi: 5, beskrivelse: 'Gjøre 5 salg på en dag' },
          { id: 'trophy', emoji: '🏆', navn: 'Trophy', verdi: 10, beskrivelse: 'Gjøre 10 salg på en dag' },
          { id: 'fire', emoji: '🔥', navn: 'On Fire', verdi: 20, beskrivelse: 'Gjøre 20 salg på en dag' },
          { id: 'star', emoji: '⭐', navn: 'Star', verdi: 50, beskrivelse: 'Gjøre 50 salg på en dag' },
        ];

        // If Firestore has badges, use those. Otherwise use test data.
        if (badgesSnap.size > 0) {
          badgesSnap.forEach((doc) => {
            const data = doc.data();
            badgesList.push({
              id: doc.id,
              emoji: data.emoji || '🏅', // Expect emoji field
              navn: data.navn || '',
              verdi: data.verdi || 0,
              beskrivelse: data.beskrivelse || '',
            });
          });
        } else {
          badgesList.push(...testBadges);
        }

        // Filter: Only badges with navn (name) set
        const namedBadges = badgesList.filter((badge) => badge.navn && badge.navn.trim().length > 0);

        // Sort by verdi (ascending)
        namedBadges.sort((a, b) => a.verdi - b.verdi);

        // Check which badges are achieved
        namedBadges.forEach((badge) => {
          if (todayStats.count >= badge.verdi) {
            achievedList.push(badge.id);
          }
        });

        setBadges(namedBadges);
        setAchievedBadges(achievedList);

        console.log('✅ Badges loaded:', namedBadges.length, 'badges with names');
        console.log('🎖️ Achieved:', achievedList);
      } catch (err) {
        console.error('❌ Error loading badges:', err);
      }
    };

    loadBadges();
  }, [todayStats.count]);

  // Load user targets from Firestore
  useEffect(() => {
    const loadTargets = async () => {
      if (!user) return;

      try {
        const snapshot = await getDocs(collection(db, 'user_targets'));
        let found = false;
        
        snapshot.forEach((doc) => {
          if (doc.id === user.id) {
            const data = doc.data();
            setTargets({
              day: data.day || 5,
              week: data.week || 25,
              month: data.month || 100,
            });
            console.log('✅ Targets loaded from Firestore');
            found = true;
          }
        });

        if (!found) {
          console.log('ℹ️ No targets saved - using defaults');
        }
      } catch (err) {
        console.error('❌ Error loading targets:', err);
      }
    };

    loadTargets();
  }, [user?.id]);

  const handleTargetEdit = (type: 'day' | 'week' | 'month') => {
    setEditingTarget(type);
    setTempValue(targets[type]);
  };

  const saveTarget = async (type: 'day' | 'week' | 'month') => {
    if (!user) return;

    let newTargets = { ...targets };

    if (type === 'month') {
      // Auto-calculate day and week from month
      const workdaysInMonth = 22; // Approximate
      const dayTarget = Math.round(tempValue / workdaysInMonth);
      const weekTarget = dayTarget * 5;
      newTargets = {
        day: dayTarget,
        week: weekTarget,
        month: tempValue,
      };
    } else {
      newTargets = {
        ...targets,
        [type]: tempValue,
      };
    }

    // Save to Firestore
    try {
      const targetRef = doc(db, 'user_targets', user.id);
      await setDoc(targetRef, {
        ...newTargets,
        updatedAt: new Date().toISOString(),
      });
      console.log('✅ Targets saved to Firestore');
    } catch (err) {
      console.error('❌ Error saving targets:', err);
    }

    setTargets(newTargets);
    setEditingTarget(null);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  if (!user) return <div className="status-container">Laster...</div>;

  return (
    <div className="status-container">
      <div className="status-content">
        <h1 className="user-header">{user?.name}</h1>

        {/* Progress Bars */}
        <div className="progress-section">
          {/* Today */}
          <div className="progress-item">
            <div className="progress-header">
              <div>
                <h3>I dag</h3>
                <p className="progress-current">{todayStats.count} av {targets.day}</p>
              </div>
              <button 
                className="edit-btn"
                onClick={() => handleTargetEdit('day')}
              >
                Endre
              </button>
            </div>
            {editingTarget === 'day' ? (
              <div className="edit-input">
                <input
                  type="number"
                  value={tempValue}
                  onChange={(e) => setTempValue(Number(e.target.value))}
                />
                <button onClick={() => saveTarget('day')}>Lagre</button>
                <button onClick={() => setEditingTarget(null)}>Avbryt</button>
              </div>
            ) : (
              <>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage(todayStats.count, targets.day)}%` }}
                  ></div>
                </div>
                <div className="progress-meta">
                  <span>Runrate: {runRates.day}</span>
                  <span>{todayStats.revenue} kr</span>
                </div>
              </>
            )}
          </div>

          {/* Week */}
          <div className="progress-item">
            <div className="progress-header">
              <div>
                <h3>Denne uken</h3>
                <p className="progress-current">{weekStats.count} av {targets.week}</p>
              </div>
              <button 
                className="edit-btn"
                onClick={() => handleTargetEdit('week')}
              >
                Endre
              </button>
            </div>
            {editingTarget === 'week' ? (
              <div className="edit-input">
                <input
                  type="number"
                  value={tempValue}
                  onChange={(e) => setTempValue(Number(e.target.value))}
                />
                <button onClick={() => saveTarget('week')}>Lagre</button>
                <button onClick={() => setEditingTarget(null)}>Avbryt</button>
              </div>
            ) : (
              <>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage(weekStats.count, targets.week)}%` }}
                  ></div>
                </div>
                <div className="progress-meta">
                  <span>Runrate: {runRates.week}</span>
                  <span>{weekStats.revenue} kr</span>
                </div>
              </>
            )}
          </div>

          {/* Month */}
          <div className="progress-item">
            <div className="progress-header">
              <div>
                <h3>Denne måneden</h3>
                <p className="progress-current">{monthStats.count} av {targets.month}</p>
              </div>
              <button 
                className="edit-btn"
                onClick={() => handleTargetEdit('month')}
              >
                Endre
              </button>
            </div>
            {editingTarget === 'month' ? (
              <div className="edit-input">
                <input
                  type="number"
                  value={tempValue}
                  onChange={(e) => setTempValue(Number(e.target.value))}
                />
                <button onClick={() => saveTarget('month')}>Lagre</button>
                <button onClick={() => setEditingTarget(null)}>Avbryt</button>
              </div>
            ) : (
              <>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage(monthStats.count, targets.month)}%` }}
                  ></div>
                </div>
                <div className="progress-meta">
                  <span>Runrate: {runRates.month}</span>
                  <span>{monthStats.revenue} kr</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Badges Section */}
        <div className="badges-section">
          <div className="badges-container">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`badge-item ${achievedBadges.includes(badge.id) ? 'achieved' : 'dimmed'}`}
                title={badge.beskrivelse}
              >
                <div className="badge-emoji">{badge.emoji}</div>
                <div className="badge-name">{badge.navn}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
