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

interface Employee {
  name: string;
  visualName: string;
  today: number;
  week: number;
  month: number;
}

export default function MobileAvdeling() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DeptStats>({ today: 0, week: 0, month: 0 });
  const [goals, setGoals] = useState<DeptGoals>({ day: 5, week: 20, month: 80 });
  const [top3, setTop3] = useState({ day: [] as Employee[], week: [] as Employee[], month: [] as Employee[] });
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

    // Load employee list for department
    let deptEmps = new Set<string>();
    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      const empDetailMap: { [key: string]: { visualName: string } } = {};
      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.avdeling === user.department) {
          deptEmps.add(data.name?.toLowerCase() || '');
          empDetailMap[data.name?.toLowerCase() || ''] = { visualName: data.visualName || data.name };
        }
      });

      // Real-time listener
      const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), () => {
        updateStats(deptEmps, empDetailMap);
      });

      const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), () => {
        updateStats(deptEmps, empDetailMap);
      });

      setLoading(false);

      return () => {
        unsubscribeLivefeed();
        unsubscribeArchive();
      };
    });
  }, [user?.department]);

  const updateStats = async (deptEmps: Set<string>, empDetailMap: { [key: string]: { visualName: string } }) => {
    if (!user?.department) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const empStats: { [key: string]: { today: number; week: number; month: number; visualName: string } } = {};

    // Initialize employees
    deptEmps.forEach((emp) => {
      empStats[emp] = {
        today: 0,
        week: 0,
        month: 0,
        visualName: empDetailMap[emp]?.visualName || emp,
      };
    });

    let dayCount = 0,
      weekCount = 0,
      monthCount = 0;

    // Count livefeed
    const livefeedSnapshot = await getDocs(collection(db, 'livefeed_sales'));
    livefeedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const userName = data.userName?.toLowerCase() || '';
      if (deptEmps.has(userName)) {
        empStats[userName].today++;
        empStats[userName].week++;
        empStats[userName].month++;
        dayCount++;
        weekCount++;
        monthCount++;
      }
    });

    // Count contracts
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
            empStats[selgerLower].week++;
            weekCount++;
          }
          if (contractDate >= startOfMonth) {
            empStats[selgerLower].month++;
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

    // Get top 3 for each period
    const empArray = Object.entries(empStats).map(([key, val]) => ({
      name: key,
      visualName: val.visualName,
      today: val.today,
      week: val.week,
      month: val.month,
    }));

    setTop3({
      day: empArray.sort((a, b) => b.today - a.today).slice(0, 3),
      week: empArray.sort((a, b) => b.week - a.week).slice(0, 3),
      month: empArray.sort((a, b) => b.month - a.month).slice(0, 3),
    });
  };

  const getPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  if (loading) return <div className="loading">Laster avdeling...</div>;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="mobile-avdeling">
      <h3>👥 {user?.department || 'AVDELING'}</h3>

      {/* I DAG */}
      <div className="period-section">
        <div className="period-title">I DAG</div>
        <div
          className="dept-stat-box"
          style={{ background: deptColor, borderColor: deptBorder }}
        >
          <div className="stat-label">Mål</div>
          <div className="stat-value">{goals.day}</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.today, goals.day)}%`,
                background: '#4db8ff',
              }}
            />
          </div>
          <div className="stat-label">Salg</div>
          <div className="stat-value">{stats.today}</div>
        </div>
        {top3.day.length > 0 && (
          <div className="top3-list">
            {top3.day.map((emp, idx) => (
              <div key={idx} className="top3-item">
                <span className="medal">{medals[idx]}</span>
                <span className="name">{emp.visualName}</span>
                <span className="count">{emp.today}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UKE */}
      <div className="period-section">
        <div className="period-title">UKE</div>
        <div
          className="dept-stat-box"
          style={{ background: deptColor, borderColor: deptBorder }}
        >
          <div className="stat-label">Mål</div>
          <div className="stat-value">{goals.week}</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.week, goals.week)}%`,
                background: '#ffd700',
              }}
            />
          </div>
          <div className="stat-label">Salg</div>
          <div className="stat-value">{stats.week}</div>
        </div>
        {top3.week.length > 0 && (
          <div className="top3-list">
            {top3.week.map((emp, idx) => (
              <div key={idx} className="top3-item">
                <span className="medal">{medals[idx]}</span>
                <span className="name">{emp.visualName}</span>
                <span className="count">{emp.week}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MÅNED */}
      <div className="period-section">
        <div className="period-title">MÅNED</div>
        <div
          className="dept-stat-box"
          style={{ background: deptColor, borderColor: deptBorder }}
        >
          <div className="stat-label">Mål</div>
          <div className="stat-value">{goals.month}</div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${getPercentage(stats.month, goals.month)}%`,
                background: '#51cf66',
              }}
            />
          </div>
          <div className="stat-label">Salg</div>
          <div className="stat-value">{stats.month}</div>
        </div>
        {top3.month.length > 0 && (
          <div className="top3-list">
            {top3.month.map((emp, idx) => (
              <div key={idx} className="top3-item">
                <span className="medal">{medals[idx]}</span>
                <span className="name">{emp.visualName}</span>
                <span className="count">{emp.month}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
