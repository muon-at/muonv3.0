import { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProsjektStats {
  today: number;
  week: number;
  month: number;
}

interface ProsjektGoals {
  day: number;
  week: number;
  month: number;
}

export default function MobileProsjekt() {
  const [stats, setStats] = useState<ProsjektStats>({ today: 0, week: 0, month: 0 });
  const [goals, setGoals] = useState<ProsjektGoals>({ day: 15, week: 60, month: 240 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load all department goals and sum them
    getDocs(collection(db, 'department_goals')).then((snapshot) => {
      let totalDay = 0,
        totalWeek = 0,
        totalMonth = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        totalDay += data.day || 5;
        totalWeek += data.week || 20;
        totalMonth += data.month || 80;
      });

      setGoals({
        day: totalDay || 15,
        week: totalWeek || 60,
        month: totalMonth || 240,
      });
    });

    // Real-time listener
    const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), () => {
      updateStats();
    });

    const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), () => {
      updateStats();
    });

    setLoading(false);

    return () => {
      unsubscribeLivefeed();
      unsubscribeArchive();
    };
  }, []);

  const updateStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const livefeedSnapshot = await getDocs(collection(db, 'livefeed_sales'));
    const contractsSnapshot = await getDocs(collection(db, 'allente_kontraktsarkiv'));

    let dayCount = 0,
      weekCount = 0,
      monthCount = 0;

    // Count livefeed
    livefeedSnapshot.docs.forEach(() => {
      dayCount++;
      weekCount++;
      monthCount++;
    });

    // Count contracts
    contractsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.dato) {
        const [day, month, year] = data.dato.split('/').map(Number);
        if (day && month && year) {
          const contractDate = new Date(year, month - 1, day);
          contractDate.setHours(0, 0, 0, 0);

          if (contractDate >= startOfWeek) weekCount++;
          if (contractDate >= startOfMonth) monthCount++;
        }
      }
    });

    setStats({
      today: dayCount,
      week: weekCount,
      month: monthCount,
    });
  };

  const getPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  if (loading) return <div className="loading">Laster prosjekt...</div>;

  return (
    <div className="mobile-prosjekt">
      <h3>🏢 MITT PROSJEKT</h3>

      <div className="progress-cards">
        {/* TODAY */}
        <div className="progress-card">
          <div className="label">I DAG</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.today, goals.day)}%`,
                background: '#4db8ff',
              }}
            />
          </div>
          <div className="values">
            <span className="current">{stats.today}</span>
            <span className="target">/ {goals.day}</span>
          </div>
        </div>

        {/* WEEK */}
        <div className="progress-card">
          <div className="label">UKE</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.week, goals.week)}%`,
                background: '#ffd700',
              }}
            />
          </div>
          <div className="values">
            <span className="current">{stats.week}</span>
            <span className="target">/ {goals.week}</span>
          </div>
        </div>

        {/* MONTH */}
        <div className="progress-card">
          <div className="label">MÅNED</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.month, goals.month)}%`,
                background: '#51cf66',
              }}
            />
          </div>
          <div className="values">
            <span className="current">{stats.month}</span>
            <span className="target">/ {goals.month}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
