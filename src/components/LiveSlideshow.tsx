import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface EmployeeDetail {
  dept: string;
  visualName: string;
}

interface SalesData {
  [key: string]: {
    today: number;
    week: number;
    month: number;
    dept: string;
    visualName: string;
  };
}

interface Props {
  department: string; // 'KRS', 'OSL', 'Skien'
}

export default function LiveSlideshow({ department }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [salesData, setSalesData] = useState<SalesData>({});
  const [muonTotal, setMuonTotal] = useState({ day: 0, week: 0, month: 0 });
  const [deptRanking, setDeptRanking] = useState<any[]>([]);
  const [goals, setGoals] = useState({ day: 5, week: 20, month: 80 });

  // Auto-play
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 6);
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // Load employee details and calculate sales
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get employee map
    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      const employeeDetailMap: { [key: string]: EmployeeDetail } = {};

      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const name = data.name || '';
        const visualName = data.visualName || name;
        const dept = data.avdeling || '';
        if (name) {
          employeeDetailMap[name.toLowerCase()] = { dept, visualName };
        }
      });

      // Load goals
      getDocs(collection(db, 'department_goals')).then((goalsSnapshot) => {
        goalsSnapshot.docs.forEach((doc) => {
          if (doc.id === department) {
            const data = doc.data();
            setGoals({
              day: data.day || 5,
              week: data.week || 20,
              month: data.month || 80,
            });
          }
        });
      });

      // Listen to livefeed
      const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), (livefeedSnapshot) => {
        // Listen to contracts
        const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), (archiveSnapshot) => {
          const stats: SalesData = {};
          let muonDay = 0, muonWeek = 0, muonMonth = 0;
          const deptStats: { [key: string]: { day: number; week: number; month: number } } = {
            'KRS': { day: 0, week: 0, month: 0 },
            'OSL': { day: 0, week: 0, month: 0 },
            'Skien': { day: 0, week: 0, month: 0 },
          };

          // Process livefeed
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const userName = data.userName || '';
            const empDetails = employeeDetailMap[userName.toLowerCase()] || { dept: 'unknown', visualName: userName };

            if (!stats[userName]) {
              stats[userName] = { today: 0, week: 0, month: 0, dept: empDetails.dept, visualName: empDetails.visualName };
            }

            stats[userName].today += 1;
            stats[userName].week += 1;
            stats[userName].month += 1;

            muonDay += 1;
            muonWeek += 1;
            muonMonth += 1;

            if (empDetails.dept in deptStats) {
              deptStats[empDetails.dept].day += 1;
              deptStats[empDetails.dept].week += 1;
              deptStats[empDetails.dept].month += 1;
            }
          });

          // Process contracts
          archiveSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            let selger = data.selger || '';
            const dato = data.dato || '';

            selger = selger.replace(/ \/ selger$/i, '').trim();
            const empDetails = employeeDetailMap[selger.toLowerCase()] || { dept: 'unknown', visualName: selger };

            if (!stats[selger]) {
              stats[selger] = { today: 0, week: 0, month: 0, dept: empDetails.dept, visualName: empDetails.visualName };
            }

            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const contractDate = new Date(year, month - 1, day);
                contractDate.setHours(0, 0, 0, 0);

                if (contractDate >= startOfMonth) {
                  stats[selger].month += 1;
                  muonMonth += 1;
                  if (empDetails.dept in deptStats) {
                    deptStats[empDetails.dept].month += 1;
                  }
                }

                if (contractDate >= startOfWeek) {
                  stats[selger].week += 1;
                  muonWeek += 1;
                  if (empDetails.dept in deptStats) {
                    deptStats[empDetails.dept].week += 1;
                  }
                }
              }
            }
          });

          setSalesData(stats);
          setMuonTotal({ day: muonDay, week: muonWeek, month: muonMonth });

          // Create department ranking
          const deptArray = Object.entries(deptStats)
            .map(([dept, stats]) => ({
              dept,
              ...stats,
            }))
            .sort((a, b) => b.day - a.day);
          setDeptRanking(deptArray);
        });

        return () => unsubscribeArchive();
      });

      return () => unsubscribeLivefeed();
    });
  }, [department]);

  // Get top 3 for department by period
  const getTop3 = (period: 'today' | 'week' | 'month'): Array<{ name: string; count: number; visualName: string }> => {
    return Object.entries(salesData)
      .filter(([, stats]) => stats.dept === department)
      .map(([name, stats]) => ({
        name,
        visualName: stats.visualName,
        count: period === 'today' ? stats.today : period === 'week' ? stats.week : stats.month,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  };

  // Get top 5 from all departments
  const getTop5Muon = (): Array<{ name: string; count: number; visualName: string; dept: string }> => {
    return Object.entries(salesData)
      .map(([name, stats]) => ({
        name,
        visualName: stats.visualName,
        dept: stats.dept,
        count: stats.today,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const medals = ['🥇', '🥈', '🥉'];
  const deptTotal = Object.values(salesData)
    .filter((s) => s.dept === department)
    .reduce((sum, s) => ({ today: sum.today + s.today, week: sum.week + s.week, month: sum.month + s.month }), { today: 0, week: 0, month: 0 });

  const slides = [
    // Slide 1: Top 3 KRS today
    <div key={1} style={{ padding: '3rem', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ fontSize: '4rem', marginBottom: '3rem', color: '#4db8ff', fontWeight: '900' }}>TOP 3 {department}</h2>
      <h3 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#9ca3af' }}>I DAG</h3>
      {getTop3('today').map((emp, idx) => (
        <div key={idx} style={{ marginBottom: '2rem', fontSize: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
          <span style={{ marginRight: '1rem', fontSize: '3rem' }}>{medals[idx]}</span>
          <span style={{ color: '#e2e8f0' }}>{emp.visualName}</span>
          <span style={{ marginLeft: '1rem', color: '#22c55e', fontWeight: 'bold', fontSize: '2rem' }}>{emp.count}</span>
        </div>
      ))}
    </div>,

    // Slide 2: Status KRS
    <div key={2} style={{ padding: '3rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ fontSize: '4rem', marginBottom: '2rem', color: '#4db8ff', textAlign: 'center', fontWeight: '900' }}>STATUS {department}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
        {[
          { period: 'I DAG', value: deptTotal.today, goal: goals.day },
          { period: 'UKE', value: deptTotal.week, goal: goals.week },
          { period: 'MÅNED', value: deptTotal.month, goal: goals.month },
        ].map((item, idx) => (
          <div key={idx} style={{ background: '#1f3a52', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '1rem', fontWeight: '600' }}>{item.period}</p>
            <p style={{ fontSize: '4rem', fontWeight: 'bold', color: '#4db8ff', marginBottom: '0.5rem' }}>{item.value}</p>
            <p style={{ fontSize: '1.5rem', color: '#b0b0b0' }}>/ {item.goal}</p>
          </div>
        ))}
      </div>
    </div>,

    // Slide 3: Top 3 KRS week
    <div key={3} style={{ padding: '3rem', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ fontSize: '4rem', marginBottom: '3rem', color: '#ffd700', fontWeight: '900' }}>TOP 3 {department}</h2>
      <h3 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#9ca3af' }}>UKE</h3>
      {getTop3('week').map((emp, idx) => (
        <div key={idx} style={{ marginBottom: '2rem', fontSize: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
          <span style={{ marginRight: '1rem', fontSize: '3rem' }}>{medals[idx]}</span>
          <span style={{ color: '#e2e8f0' }}>{emp.visualName}</span>
          <span style={{ marginLeft: '1rem', color: '#22c55e', fontWeight: 'bold', fontSize: '2rem' }}>{emp.count}</span>
        </div>
      ))}
    </div>,

    // Slide 4: Status MUON
    <div key={4} style={{ padding: '3rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ fontSize: '4rem', marginBottom: '2rem', color: '#51cf66', textAlign: 'center', fontWeight: '900' }}>STATUS MUON</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
        {[
          { period: 'I DAG', value: muonTotal.day, goal: 15 },
          { period: 'UKE', value: muonTotal.week, goal: 60 },
          { period: 'MÅNED', value: muonTotal.month, goal: 240 },
        ].map((item, idx) => (
          <div key={idx} style={{ background: '#1a3a2a', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '1rem', fontWeight: '600' }}>{item.period}</p>
            <p style={{ fontSize: '4rem', fontWeight: 'bold', color: '#51cf66', marginBottom: '0.5rem' }}>{item.value}</p>
            <p style={{ fontSize: '1.5rem', color: '#b0b0b0' }}>/ {item.goal}</p>
          </div>
        ))}
      </div>
    </div>,

    // Slide 5: Top 3 KRS month
    <div key={5} style={{ padding: '3rem', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ fontSize: '4rem', marginBottom: '3rem', color: '#f87171', fontWeight: '900' }}>TOP 3 {department}</h2>
      <h3 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#9ca3af' }}>MÅNED</h3>
      {getTop3('month').map((emp, idx) => (
        <div key={idx} style={{ marginBottom: '2rem', fontSize: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
          <span style={{ marginRight: '1rem', fontSize: '3rem' }}>{medals[idx]}</span>
          <span style={{ color: '#e2e8f0' }}>{emp.visualName}</span>
          <span style={{ marginLeft: '1rem', color: '#22c55e', fontWeight: 'bold', fontSize: '2rem' }}>{emp.count}</span>
        </div>
      ))}
    </div>,

    // Slide 6: Department ranking + Top 5 MUON
    <div key={6} style={{ padding: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', height: '100%', alignContent: 'center' }}>
      <div>
        <h3 style={{ fontSize: '2.5rem', color: '#4db8ff', marginBottom: '2rem', textAlign: 'center', fontWeight: '900' }}>RANGERING</h3>
        {deptRanking.map((dept, idx) => (
          <div key={idx} style={{ marginBottom: '1.5rem', fontSize: '2rem', display: 'flex', justifyContent: 'space-between', padding: '1rem' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{idx + 1}. {dept.dept}</span>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{dept.day}</span>
          </div>
        ))}
      </div>
      <div>
        <h3 style={{ fontSize: '2.5rem', color: '#ffd700', marginBottom: '2rem', textAlign: 'center', fontWeight: '900' }}>TOP 5 MUON</h3>
        {getTop5Muon().map((emp, idx) => (
          <div key={idx} style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ color: '#e2e8f0', fontSize: '1.8rem', fontWeight: 'bold' }}>
              🔥 {emp.visualName} 🔥
            </div>
            <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.5rem' }}>{emp.count}</div>
          </div>
        ))}
      </div>
    </div>,
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000000' }}>
      {/* Slide content */}
      <div style={{ flex: 1, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {slides[currentSlide]}
      </div>

      {/* Slide counter */}
      <div style={{ position: 'absolute', bottom: '4rem', right: '2rem', color: '#9ca3af', fontSize: '1rem', zIndex: 100 }}>
        Slide {currentSlide + 1} / 6
      </div>
    </div>
  );
}
