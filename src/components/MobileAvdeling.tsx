import { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';

interface DeptStats {
  today: number;
  week: number;
  month: number;
}

interface DeptGoals {
  day: number;
  week: number;
  month: number;
}

export default function MobileAvdeling() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DeptStats>({ today: 0, week: 0, month: 0 });
  const [goals, setGoals] = useState<DeptGoals>({ day: 5, week: 20, month: 80 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.department) {
      setLoading(false);
      return;
    }

    // Load department goals
    getDocs(collection(db, 'department_goals')).then((snapshot) => {
      snapshot.forEach((doc) => {
        if (doc.id === user.department) {
          const data = doc.data();
          setGoals({
            day: data.day || 5,
            week: data.week || 20,
            month: data.month || 80,
          });
        }
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
  }, [user?.department]);

  const updateStats = async () => {
    if (!user?.department) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const empSnapshot = await getDocs(collection(db, 'employees'));
    const deptEmps = new Set<string>();

    empSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.avdeling === user.department) {
        deptEmps.add(data.name?.toLowerCase() || '');
      }
    });

    const livefeedSnapshot = await getDocs(collection(db, 'livefeed_sales'));
    const contractsSnapshot = await getDocs(collection(db, 'allente_kontraktsarkiv'));

    let dayCount = 0,
      weekCount = 0,
      monthCount = 0;

    // Count livefeed
    livefeedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (deptEmps.has(data.userName?.toLowerCase() || '')) {
        dayCount++;
        weekCount++;
        monthCount++;
      }
    });

    // Count contracts
    contractsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      let selger = (data.selger || '').replace(/ \/ selger$/i, '').trim();

      if (deptEmps.has(selger.toLowerCase()) && data.dato) {
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

  if (loading) return <div className="loading">Laster avdeling...</div>;

  return (
    <div className="mobile-avdeling">
      <h3>👥 {user?.department || 'AVDELING'}</h3>

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
