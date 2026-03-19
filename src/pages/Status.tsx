import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, onSnapshot, addDoc } from 'firebase/firestore';
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
  const [monthEdited, setMonthEdited] = useState<boolean>(false);
  const [runRates, setRunRates] = useState({
    dayTo16: 0,
    dayTo21: 0,
    week: 0,
    month: 0,
  });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievedBadges, setAchievedBadges] = useState<string[]>([]);

  // Load data from Progresjon (same logic as dashboards)
  useEffect(() => {
    if (!user || !user.name) return;

    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      const employeeDetailMap: { [key: string]: { dept: string; externalName: string; visualName: string } } = {};

      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const dept = data.department || 'Unknown';
        const externalName = data.externalName || '';
        const visualName = data.name || '';

        if (data.name) {
          employeeDetailMap[data.name.toLowerCase().trim()] = { dept, externalName, visualName };
        }
        if (data.externalName) {
          employeeDetailMap[data.externalName.toLowerCase().trim()] = { dept, externalName, visualName };
        }
      });

      const getEmployeeDetail = (ansatt: string): { dept: string; externalName: string; visualName: string } => {
        const ansattLower = ansatt.toLowerCase().trim();
        if (employeeDetailMap[ansattLower]) return employeeDetailMap[ansattLower];
        for (const [key, detail] of Object.entries(employeeDetailMap)) {
          if (key.includes(ansattLower) || ansattLower.includes(key)) {
            return detail;
          }
        }
        return { dept: 'Unknown', externalName: '', visualName: ansatt };
      };

      const livefeedRef = collection(db, 'livefeed_sales');
      const unsubscribeLivefeed = onSnapshot(livefeedRef, (livefeedSnapshot) => {
        const contractsRef = collection(db, 'allente_kontraktsarkiv');
        const unsubscribeArchive = onSnapshot(contractsRef, (archiveSnapshot) => {
          try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const sellerStats: { [key: string]: any } = {};

            // Load from livefeed (TODAY)
            livefeedSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              const ansatt = data.userName || 'Ukjent';
              const detail = getEmployeeDetail(ansatt);

              if (!sellerStats[ansatt]) {
                sellerStats[ansatt] = {
                  ansatt: detail.visualName,
                  avdeling: detail.dept,
                  externalName: ansatt,
                  today: 0,
                  week: 0,
                  month: 0,
                };
              }
              sellerStats[ansatt].today++;
            });

            // Load from archive (HISTORICAL)
            archiveSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              let originalSelger = data.selger || 'Ukjent';
              let ansatt = originalSelger.replace(/ \/ selger$/i, '').trim();
              const detail = getEmployeeDetail(ansatt);
              const dato = data.dato || '';

              if (!sellerStats[ansatt]) {
                sellerStats[ansatt] = {
                  ansatt: detail.visualName,
                  avdeling: detail.dept,
                  externalName: originalSelger,
                  today: 0,
                  week: 0,
                  month: 0,
                };
              }

              if (dato && typeof dato === 'string') {
                const parts = dato.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0]);
                  const month = parseInt(parts[1]);
                  const year = parseInt(parts[2]);
                  const orderDate = new Date(year, month - 1, day);

                  if (orderDate >= today && orderDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
                    sellerStats[ansatt].today++;
                  }
                  if (orderDate >= startOfWeek && orderDate <= today) {
                    sellerStats[ansatt].week++;
                  }
                  if (orderDate >= startOfMonth && orderDate <= today) {
                    sellerStats[ansatt].month++;
                  }
                }
              }
            });

            // Find current user's data
            const userData = sellerStats[user.name];
            if (userData) {
              const todayCount = userData.today;
              const totalWeek = userData.week;
              const totalMonth = userData.month;

              setTodayStats({
                date: new Date().toLocaleDateString('no-NO'),
                count: todayCount,
                revenue: todayCount * 1000,
              });

              // Calculate runrates
              const now = new Date();
              const currentHour = now.getHours() + (now.getMinutes() / 60);
              const runrateTo16 = currentHour > 0 ? Math.round((todayCount / currentHour) * 6) : 0;
              const runrateTo21 = currentHour > 0 ? Math.round((todayCount / currentHour) * 10) : 0;

              const dayOfWeek = today.getDay();
              const daysCompleted = dayOfWeek === 0 ? 0 : dayOfWeek;
              const weekRunRate = daysCompleted > 0 ? Math.round((totalWeek / daysCompleted) * 5) : 0;

              setWeekStats({
                date: 'Denne uken',
                count: totalWeek,
                revenue: totalWeek * 1000,
              });

              const norwegianHolidays2026 = ['2026-01-01', '2026-04-09', '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-17', '2026-05-21', '2026-05-31', '2026-06-01', '2026-12-25', '2026-12-26'];
              let daysCompletedMonth = 0;
              for (let d = 1; d <= today.getDate(); d++) {
                const checkDate = new Date(today.getFullYear(), today.getMonth(), d);
                const dayOfWeekCheck = checkDate.getDay();
                const dateStr = checkDate.toISOString().split('T')[0];
                if (dayOfWeekCheck >= 1 && dayOfWeekCheck <= 5 && !norwegianHolidays2026.includes(dateStr)) {
                  daysCompletedMonth++;
                }
              }

              const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
              let workingDaysMonth = 0;
              for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = new Date(today.getFullYear(), today.getMonth(), d);
                const dayOfWeekCheck = checkDate.getDay();
                const dateStr = checkDate.toISOString().split('T')[0];
                if (dayOfWeekCheck >= 1 && dayOfWeekCheck <= 5 && !norwegianHolidays2026.includes(dateStr)) {
                  workingDaysMonth++;
                }
              }

              const monthRunRate = daysCompletedMonth > 0 ? Math.round((totalMonth / daysCompletedMonth) * workingDaysMonth) : 0;

              setMonthStats({
                date: new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }),
                count: totalMonth,
                revenue: totalMonth * 1000,
              });

              setRunRates({
                dayTo16: runrateTo16,
                dayTo21: runrateTo21,
                week: weekRunRate,
                month: monthRunRate,
              });

              console.log('✅ PROGRESJON STATS LOADED:', { todayCount, totalWeek, totalMonth });
            }
          } catch (err) {
            console.error('❌ Error loading stats:', err);
          }
        });

        return () => {
          unsubscribeLivefeed();
          unsubscribeArchive();
        };
      });
    });
  }, [user?.id, user?.name]);

  // Check for badge achievements and post to livefeed
  useEffect(() => {
    if (!user || todayStats.count === 0) return;

    const postAchievedBadges = async () => {
      const announceKey = `announced_badges_${user.id}`;
      const announced = JSON.parse(localStorage.getItem(announceKey) || '{}') as { [key: string]: boolean };

      const badgesToPost: { id: string; emoji: string; name: string }[] = [];

      // Check 5 SALG
      if (todayStats.count >= 5 && !announced.fem) {
        badgesToPost.push({ id: 'fem', emoji: '🚀', name: '5 SALG' });
        announced.fem = true;
      }
      // Check 10 SALG
      if (todayStats.count >= 10 && !announced.ti) {
        badgesToPost.push({ id: 'ti', emoji: '🎯', name: '10 SALG' });
        announced.ti = true;
      }
      // Check 15 SALG
      if (todayStats.count >= 15 && !announced.femten) {
        badgesToPost.push({ id: 'femten', emoji: '🔥', name: '15 SALG' });
        announced.femten = true;
      }
      // Check 20 SALG
      if (todayStats.count >= 20 && !announced.tjue) {
        badgesToPost.push({ id: 'tjue', emoji: '💎', name: '20 SALG' });
        announced.tjue = true;
      }
      // Check FØRSTE
      if (todayStats.count >= 1 && !announced.forste) {
        badgesToPost.push({ id: 'forste', emoji: '🎓', name: 'FØRSTE SALGET' });
        announced.forste = true;
      }

      // Post new badges to livefeed
      for (const badge of badgesToPost) {
        try {
          await addDoc(collection(db, 'livefeed_sales'), {
            userId: user.id,
            userName: user.name,
            userDepartment: user.department || 'Ukjent',
            product: `${badge.emoji} ${badge.name}`,
            productPrice: 0,
            gifUrl: 'BADGE_ACHIEVEMENT',
            timestamp: new Date(),
            userRole: user.role || 'employee',
            isBadgePost: true,
          });
          console.log(`✅ Badge posted: ${user.name} - ${badge.name}`);
        } catch (err) {
          console.error('❌ Error posting badge:', err);
        }
      }

      // Save announced badges
      if (badgesToPost.length > 0) {
        localStorage.setItem(announceKey, JSON.stringify(announced));
      }
    };

    postAchievedBadges();
  }, [user?.id, todayStats.count]);

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

        console.log('✅ Badges loaded:', namedBadges.length, 'badges');
        console.log('📊 Today stats count:', todayStats.count);
        console.log('🎖️ Achieved badges:', achievedList);
        console.log('📋 All badges:', namedBadges.map(b => `${b.navn}(verdi:${b.verdi})`));
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
      setMonthEdited(true); // Mark month as edited
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
                disabled={!monthEdited}
                style={{ opacity: monthEdited ? 1 : 0.4, cursor: monthEdited ? 'pointer' : 'not-allowed' }}
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
                  <span>→ 16:00: {runRates.dayTo16} | → 21:00: {runRates.dayTo21}</span>
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
                disabled={!monthEdited}
                style={{ opacity: monthEdited ? 1 : 0.4, cursor: monthEdited ? 'pointer' : 'not-allowed' }}
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
            {badges.length > 0 && (
              <>
                {badges.map((badge) => {
                  const isAchieved = achievedBadges.includes(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`badge-item ${isAchieved ? 'achieved' : 'dimmed'}`}
                      title={badge.beskrivelse}
                    >
                      <div className="badge-emoji">{badge.emoji}</div>
                      <div className="badge-name">{badge.navn}</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          {/* Debug: Show stats */}
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#ccc', textAlign: 'center' }}>
            <p>Salg i dag: {todayStats.count} | Badges: {badges.length} | Achieved: {achievedBadges.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
