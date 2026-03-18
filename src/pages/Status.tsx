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
  const [runRates, setRunRates] = useState({
    day: 0,
    week: 0,
    month: 0,
  });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievedBadges, setAchievedBadges] = useState<string[]>([]);

  // Load LIVE data - TODAY from livefeed_sales, HISTORICAL from allente_kontraktsarkiv
  useEffect(() => {
    if (!user || !user.name) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Listener 1: livefeed_sales (TODAY only)
    const livefeedRef = collection(db, 'livefeed_sales');
    const unsubscribeLivefeed = onSnapshot(livefeedRef, (livefeedSnapshot) => {
      // Listener 2: allente_kontraktsarkiv (HISTORICAL + week/month)
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const unsubscribeArchive = onSnapshot(contractsRef, (archiveSnapshot) => {
        try {
          let btvToday = 0;
          let dthToday = 0;
          let totalWeek = 0;
          let totalMonth = 0;
          let totalRevenue = 0;

          // Process TODAY data from livefeed_sales (temp posts from 🔔 modal)
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const userName = data.userName || '';
            const product = (data.product || '').toLowerCase();
            
            if (userName !== user.name) return;
            
            if (product.includes('btv')) {
              btvToday++;
            } else if (product.includes('dth')) {
              dthToday++;
            }
          });

          // Process WEEK/MONTH data from allente_kontraktsarkiv (historical CSV uploads)
          archiveSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const selger = data.selger || '';
            const dato = data.dato || '';
            const produkt = (data.produkt || '').toLowerCase();

            // Filter by seller name
            if (selger !== user.name) return;

            // Parse date: "12/3/2026" → [12, 3, 2026]
            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);

                // WEEK counts
                if (orderDate >= startOfWeek && orderDate <= today) {
                  totalWeek++;
                }

                // MONTH counts
              if (orderDate >= startOfMonth && orderDate <= today) {
                totalMonth++;
              }

              // REVENUE (1000 kr for BTV/DTH, 800 kr for free)
              const price = produkt.includes('free') ? 800 : 1000;
              totalRevenue += price;
            }
          }
        });

        const todayCount = btvToday + dthToday;
        setTodayStats({
          date: new Date().toLocaleDateString('no-NO'),
          count: todayCount,
          revenue: todayCount * 1000, // Assume all today items are 1000 kr
        });

        // Calculate runrates
        const now = new Date();
        const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
        const dayRunRate = hoursElapsed > 0 ? Math.round((todayCount / hoursElapsed) * 8) : 0;

        setWeekStats({
          date: 'Denne uken',
          count: totalWeek,
          revenue: totalWeek * 1000, // Simplified
        });

        const weekRunRate = totalWeek > 0 ? Math.round((totalWeek / 7) * 7) : 0;

        setMonthStats({
          date: new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }),
          count: totalMonth,
          revenue: totalMonth * 1000, // Simplified
        });

        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const monthRunRate = totalMonth > 0 ? Math.round((totalMonth / today.getDate()) * daysInMonth) : 0;

        setRunRates({
          day: dayRunRate,
          week: weekRunRate,
          month: monthRunRate,
        });

          console.log('✅ LIVE STATS UPDATED:', { todayCount, totalWeek, totalMonth, btvToday, dthToday });
        } catch (err) {
          console.error('❌ Error loading stats:', err);
        }
      });

      // Cleanup inner archive listener
      return () => unsubscribeArchive();
    });

    // Cleanup outer livefeed listener
    return () => unsubscribeLivefeed();
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
