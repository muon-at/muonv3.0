import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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

  // Load data from Progresjon/livefeed
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
    const interval = setInterval(loadStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [user]);

  const handleTargetEdit = (type: 'day' | 'week' | 'month') => {
    setEditingTarget(type);
    setTempValue(targets[type]);
  };

  const saveTarget = (type: 'day' | 'week' | 'month') => {
    if (type === 'month') {
      // Auto-calculate day and week from month
      const workdaysInMonth = 22; // Approximate
      const dayTarget = Math.round(tempValue / workdaysInMonth);
      const weekTarget = dayTarget * 5;
      setTargets({
        day: dayTarget,
        week: weekTarget,
        month: tempValue,
      });
    } else {
      setTargets({
        ...targets,
        [type]: tempValue,
      });
    }
    setEditingTarget(null);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  if (!user) return <div className="status-container">Laster...</div>;

  return (
    <div className="status-container">
      <div className="status-content">
        <h1>📊 STATUS</h1>

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
      </div>
    </div>
  );
}
