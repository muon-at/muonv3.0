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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [salesData, setSalesData] = useState<SalesData>({});
  const [muonTotal, setMuonTotal] = useState({ day: 0, week: 0, month: 0 });
  const [deptRanking, setDeptRanking] = useState<any[]>([]);

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
          const deptArray = Object.entries(deptStats).map(([dept, stats]) => ({
            dept,
            ...stats,
          })).sort((a, b) => b.day - a.day);
          setDeptRanking(deptArray);
        });

        return () => unsubscribeArchive();
      });

      return () => unsubscribeLivefeed();
    });
  }, [department]);

  // Auto-play slides
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 6);
    }, 20000); // 20 seconds per slide

    return () => clearInterval(interval);
  }, [isPlaying]);

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

  const slides = [
    // Slide 1: Top 3 KRS today
    <div key={1} style={{ padding: '2rem', textAlign: 'center', height: '100%' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#4db8ff' }}>TOP 3 {department} - I DAG</h2>
      {getTop3('today').map((emp, idx) => (
        <div key={idx} style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>
          <span style={{ marginRight: '1rem' }}>{medals[idx]}</span>
          <span style={{ color: '#e2e8f0' }}>{emp.visualName}</span>
          <span style={{ marginLeft: '1rem', color: '#22c55e', fontWeight: 'bold' }}>{emp.count} salg</span>
        </div>
      ))}
    </div>,

    // Slide 2: Status KRS
    <div key={2} style={{ padding: '2rem', height: '100%' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#4db8ff', textAlign: 'center' }}>STATUS {department}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {[
          { period: 'I DAG', value: Object.values(salesData).filter(s => s.dept === department).reduce((sum, s) => sum + s.today, 0), goal: 5 },
          { period: 'IEKE', value: Object.values(salesData).filter(s => s.dept === department).reduce((sum, s) => sum + s.week, 0), goal: 20 },
          { period: 'MÅNED', value: Object.values(salesData).filter(s => s.dept === department).reduce((sum, s) => sum + s.month, 0), goal: 80 },
        ].map((item, idx) => (
          <div key={idx} style={{ background: '#1f3a52', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '1.2rem', color: '#9ca3af', marginBottom: '1rem' }}>{item.period}</p>
            <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#4db8ff', marginBottom: '0.5rem' }}>{item.value}</p>
            <p style={{ fontSize: '1rem', color: '#b0b0b0' }}>/ {item.goal}</p>
          </div>
        ))}
      </div>
    </div>,

    // Slide 3: Top 3 KRS week
    <div key={3} style={{ padding: '2rem', textAlign: 'center', height: '100%' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#ffd700' }}>TOP 3 {department} - UKEN</h2>
      {getTop3('week').map((emp, idx) => (
        <div key={idx} style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>
          <span style={{ marginRight: '1rem' }}>{medals[idx]}</span>
          <span style={{ color: '#e2e8f0' }}>{emp.visualName}</span>
          <span style={{ marginLeft: '1rem', color: '#22c55e', fontWeight: 'bold' }}>{emp.count} salg</span>
        </div>
      ))}
    </div>,

    // Slide 4: Status MUON
    <div key={4} style={{ padding: '2rem', height: '100%' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#51cf66', textAlign: 'center' }}>STATUS MUON</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {[
          { period: 'I DAG', value: muonTotal.day, goal: 15 },
          { period: 'IEKE', value: muonTotal.week, goal: 60 },
          { period: 'MÅNED', value: muonTotal.month, goal: 240 },
        ].map((item, idx) => (
          <div key={idx} style={{ background: '#1a3a2a', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '1.2rem', color: '#9ca3af', marginBottom: '1rem' }}>{item.period}</p>
            <p style={{ fontSize: '3rem', fontWeight: 'bold', color: '#51cf66', marginBottom: '0.5rem' }}>{item.value}</p>
            <p style={{ fontSize: '1rem', color: '#b0b0b0' }}>/ {item.goal}</p>
          </div>
        ))}
      </div>
    </div>,

    // Slide 5: Top 3 KRS month
    <div key={5} style={{ padding: '2rem', textAlign: 'center', height: '100%' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#f87171' }}>TOP 3 {department} - MÅNEDEN</h2>
      {getTop3('month').map((emp, idx) => (
        <div key={idx} style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>
          <span style={{ marginRight: '1rem' }}>{medals[idx]}</span>
          <span style={{ color: '#e2e8f0' }}>{emp.visualName}</span>
          <span style={{ marginLeft: '1rem', color: '#22c55e', fontWeight: 'bold' }}>{emp.count} salg</span>
        </div>
      ))}
    </div>,

    // Slide 6: Department ranking + Top 5 MUON
    <div key={6} style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', height: '100%' }}>
      <div>
        <h3 style={{ fontSize: '1.8rem', color: '#4db8ff', marginBottom: '1.5rem', textAlign: 'center' }}>RANGERING DAG</h3>
        {deptRanking.map((dept, idx) => (
          <div key={idx} style={{ marginBottom: '1rem', fontSize: '1.3rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#e2e8f0' }}>{idx + 1}. {dept.dept}</span>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{dept.day}</span>
          </div>
        ))}
      </div>
      <div>
        <h3 style={{ fontSize: '1.8rem', color: '#ffd700', marginBottom: '1.5rem', textAlign: 'center' }}>TOP 5 MUON</h3>
        {getTop5Muon().map((emp, idx) => (
          <div key={idx} style={{ marginBottom: '1rem', fontSize: '1.3rem', textAlign: 'center' }}>
            <span style={{ color: '#e2e8f0' }}>
              🔥 {emp.visualName} 🔥
            </span>
            <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.1rem' }}>{emp.count} salg</div>
          </div>
        ))}
      </div>
    </div>,
  ];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Slide content */}
      <div style={{ flex: 1, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {slides[currentSlide]}
      </div>

      {/* Play button */}
      <div style={{ position: 'absolute', top: '100px', right: '2rem', zIndex: 100 }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            padding: '0.75rem 1.5rem',
            background: isPlaying ? '#22c55e' : '#4b5563',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isPlaying ? '#16a34a' : '#5a67d8')}
          onMouseLeave={(e) => (e.currentTarget.style.background = isPlaying ? '#22c55e' : '#4b5563')}
        >
          {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
      </div>

      {/* Slide counter */}
      <div style={{ position: 'absolute', bottom: '4rem', right: '2rem', color: '#9ca3af', fontSize: '0.9rem', zIndex: 100 }}>
        Slide {currentSlide + 1} / 6
      </div>
    </div>
  );
}
