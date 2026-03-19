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

  const deptColorMap = {
    KRS: '#1a3a52',
    OSL: '#1a3a2a',
    Skien: '#3a2a1a',
  };

  const deptBorderMap = {
    KRS: '#4db8ff',
    OSL: '#51cf66',
    Skien: '#ffa94d',
  };

  const deptColor = deptColorMap[user?.department as keyof typeof deptColorMap] || '#1f2937';
  const deptBorder = deptBorderMap[user?.department as keyof typeof deptBorderMap] || '#333';

  useEffect(() => {
    if (!user?.department) {
      setLoading(false);
      return;
    }

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

    let deptEmps = new Set<string>();
    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.avdeling === user.department) {
          deptEmps.add(data.name?.toLowerCase() || '');
        }
      });

      const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), () => {
        updateStats(deptEmps);
      });

      const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), () => {
        updateStats(deptEmps);
      });

      setLoading(false);

      return () => {
        unsubscribeLivefeed();
        unsubscribeArchive();
      };
    });
  }, [user?.department]);

  const updateStats = async (deptEmps: Set<string>) => {
    if (!user?.department) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let dayCount = 0,
      weekCount = 0,
      monthCount = 0;

    const livefeedSnapshot = await getDocs(collection(db, 'livefeed_sales'));
    livefeedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const userName = data.userName?.toLowerCase() || '';
      if (deptEmps.has(userName)) {
        dayCount++;
        weekCount++;
        monthCount++;
      }
    });

    const contractsSnapshot = await getDocs(collection(db, 'allente_kontraktsarkiv'));
    contractsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      let selger = (data.selger || '').replace(/ \/ selger$/i, '').trim();
      const selgerLower = selger.toLowerCase();

      if (deptEmps.has(selgerLower) && data.dato) {
        const [day, month, year] = data.dato.split('/').map(Number);
        if (day && month && year) {
          const contractDate = new Date(year, month - 1, day);
          contractDate.setHours(0, 0, 0, 0);

          if (contractDate >= startOfWeek) {
            weekCount++;
          }
          if (contractDate >= startOfMonth) {
            monthCount++;
          }
        }
      }
    });

    setStats({
      today: dayCount,
      week: weekCount,
      month: monthCount,
    });
  };

  if (loading) return <div className="loading">Laster avdeling...</div>;

  return (
    <div className="mobile-avdeling-compact">
      <h3>👥 {user?.department || 'AVDELING'}</h3>

      <div className="avdeling-compact-content">
        {/* I DAG */}
        <div className="avdeling-period">
          <div className="period-label">I DAG</div>
          <div
            className="avdeling-stat-compact"
            style={{ background: deptColor, borderColor: deptBorder }}
          >
            <div className="cbox-dept">Mål: {goals.day}</div>
            <div className="cbox-value">{stats.today}</div>
          </div>
        </div>

        {/* UKE */}
        <div className="avdeling-period">
          <div className="period-label">UKE</div>
          <div
            className="avdeling-stat-compact"
            style={{ background: deptColor, borderColor: deptBorder }}
          >
            <div className="cbox-dept">Mål: {goals.week}</div>
            <div className="cbox-value">{stats.week}</div>
          </div>
        </div>

        {/* MÅNED */}
        <div className="avdeling-period">
          <div className="period-label">MÅNED</div>
          <div
            className="avdeling-stat-compact"
            style={{ background: deptColor, borderColor: deptBorder }}
          >
            <div className="cbox-dept">Mål: {goals.month}</div>
            <div className="cbox-value">{stats.month}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
