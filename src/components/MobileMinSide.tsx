import { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';

interface SalesStats {
  today: number;
  week: number;
  month: number;
}

interface Targets {
  day: number;
  week: number;
  month: number;
}

export default function MobileMinSide() {
  const { user } = useAuth();
  const [stats, setStats] = useState<SalesStats>({ today: 0, week: 0, month: 0 });
  const [targets, setTargets] = useState<Targets>({ day: 5, week: 25, month: 100 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.name) return;

    // Load targets
    getDocs(collection(db, 'user_targets')).then((snapshot) => {
      snapshot.forEach((doc) => {
        if (doc.id === user.id) {
          const data = doc.data();
          setTargets({
            day: data.day || 5,
            week: data.week || 25,
            month: data.month || 100,
          });
        }
      });
    });

    // Real-time listener on livefeed + contracts
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
  }, [user?.id, user?.name]);

  const updateStats = async () => {
    if (!user?.name) return;

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
    livefeedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.userName === user.name) {
        dayCount++;
        weekCount++;
        monthCount++;
      }
    });

    // Count contracts
    contractsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      let selger = (data.selger || '').replace(/ \/ selger$/i, '').trim();

      if (selger.toLowerCase() === user.name.toLowerCase() && data.dato) {
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

  if (loading) return <div className="loading">Laster Min Side...</div>;

  return (
    <div className="mobile-minside">
      <h3>📊 MIN SIDE</h3>

      <div className="progress-cards">
        {/* TODAY */}
        <div className="progress-card">
          <div className="label">I DAG</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.today, targets.day)}%`,
                background: '#4db8ff',
              }}
            />
          </div>
          <div className="values">
            <span className="current">{stats.today}</span>
            <span className="target">/ {targets.day}</span>
          </div>
        </div>

        {/* WEEK */}
        <div className="progress-card">
          <div className="label">UKE</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.week, targets.week)}%`,
                background: '#ffd700',
              }}
            />
          </div>
          <div className="values">
            <span className="current">{stats.week}</span>
            <span className="target">/ {targets.week}</span>
          </div>
        </div>

        {/* MONTH */}
        <div className="progress-card">
          <div className="label">MÅNED</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.month, targets.month)}%`,
                background: '#51cf66',
              }}
            />
          </div>
          <div className="values">
            <span className="current">{stats.month}</span>
            <span className="target">/ {targets.month}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
