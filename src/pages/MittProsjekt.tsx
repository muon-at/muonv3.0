import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';

export default function MittProsjekt() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progresjonData, setProgresjonData] = useState<any[]>([]);
  const [allGoals, setAllGoals] = useState<{ [key: string]: { day: number; week: number; month: number } }>({
    KRS: { day: 5, week: 20, month: 80 },
    OSL: { day: 5, week: 20, month: 80 },
    Skien: { day: 5, week: 20, month: 80 },
  });

  const getWorkingDaysInMonth = (date: Date): number => {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const norwegianHolidays2026 = ['2026-01-01', '2026-04-09', '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-17', '2026-05-21', '2026-05-31', '2026-06-01', '2026-12-25', '2026-12-26'];
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const checkDate = new Date(date.getFullYear(), date.getMonth(), d);
      const dayOfWeek = checkDate.getDay();
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !norwegianHolidays2026.includes(dateStr)) {
        workingDays++;
      }
    }
    return workingDays;
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Load all department goals
    getDocs(collection(db, 'department_goals')).then((snap) => {
      const goalsMap: { [key: string]: { day: number; week: number; month: number } } = {
        KRS: { day: 5, week: 20, month: 80 },
        OSL: { day: 5, week: 20, month: 80 },
        Skien: { day: 5, week: 20, month: 80 },
      };
      snap.docs.forEach((doc) => {
        const data = doc.data();
        goalsMap[doc.id] = { day: data.day || 5, week: data.week || 20, month: data.month || 80 };
      });
      setAllGoals(goalsMap);
    });

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

            const progresjonList = Object.values(sellerStats).sort((a, b) => b.week - a.week);
            setProgresjonData(progresjonList);
            setLoading(false);
          } catch (err) {
            console.error('MittProsjekt error:', err);
            setLoading(false);
          }
        });

        return () => {
          unsubscribeLivefeed();
          unsubscribeArchive();
        };
      });
    });
  }, [user]);

  if (loading) {
    return <div style={{ padding: '2rem', color: '#999' }}>Laster...</div>;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const dayOfWeek = today.getDay();
  const daysCompleted = dayOfWeek === 0 ? 0 : dayOfWeek;
  const workingDaysMonth = getWorkingDaysInMonth(today);
  let daysCompletedMonth = 0;
  const norwegianHolidays2026 = ['2026-01-01', '2026-04-09', '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-17', '2026-05-21', '2026-05-31', '2026-06-01', '2026-12-25', '2026-12-26'];
  for (let d = 1; d <= today.getDate(); d++) {
    const checkDate = new Date(today.getFullYear(), today.getMonth(), d);
    const dayOfWeekCheck = checkDate.getDay();
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dayOfWeekCheck >= 1 && dayOfWeekCheck <= 5 && !norwegianHolidays2026.includes(dateStr)) {
      daysCompletedMonth++;
    }
  }

  // Department stats
  const depts = ['KRS', 'OSL', 'Skien'];
  const deptStats: { [key: string]: { today: number; week: number; month: number } } = {};
  depts.forEach(dept => {
    deptStats[dept] = {
      today: progresjonData.filter(r => r.avdeling === dept).reduce((s, r) => s + (r.today || 0), 0),
      week: progresjonData.filter(r => r.avdeling === dept).reduce((s, r) => s + (r.week || 0), 0),
      month: progresjonData.filter(r => r.avdeling === dept).reduce((s, r) => s + (r.month || 0), 0),
    };
  });

  const muonToday = progresjonData.reduce((s, r) => s + (r.today || 0), 0);
  const muonWeek = progresjonData.reduce((s, r) => s + (r.week || 0), 0);
  const muonMonth = progresjonData.reduce((s, r) => s + (r.month || 0), 0);

  const muonGoals = {
    day: (allGoals.KRS?.day || 5) + (allGoals.OSL?.day || 5) + (allGoals.Skien?.day || 5),
    week: (allGoals.KRS?.week || 20) + (allGoals.OSL?.week || 20) + (allGoals.Skien?.week || 20),
    month: (allGoals.KRS?.month || 80) + (allGoals.OSL?.month || 80) + (allGoals.Skien?.month || 80),
  };

  // Top 3 global
  const top3TodayAll = [...progresjonData].sort((a, b) => (b.today || 0) - (a.today || 0)).slice(0, 3);
  const top3WeekAll = [...progresjonData].sort((a, b) => (b.week || 0) - (a.week || 0)).slice(0, 3);
  const top3MonthAll = [...progresjonData].sort((a, b) => (b.month || 0) - (a.month || 0)).slice(0, 3);

  // Department rankings
  const deptRankingToday = [...depts].map(d => ({ dept: d, sales: deptStats[d].today })).sort((a, b) => b.sales - a.sales);
  const deptRankingWeek = [...depts].map(d => ({ dept: d, sales: deptStats[d].week })).sort((a, b) => b.sales - a.sales);
  const deptRankingMonth = [...depts].map(d => ({ dept: d, sales: deptStats[d].month })).sort((a, b) => b.sales - a.sales);

  const medals = ['🥇', '🥈', '🥉'];

  const ProgressBar = ({ current, goal, color }: { current: number; goal: number; color: string }) => {
    const percent = Math.min((current / goal) * 100, 100);
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ background: '#1f2937', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ background: color, height: '100%', width: `${percent}%`, transition: 'width 0.3s' }} />
        </div>
        <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>{current} / {goal}</p>
      </div>
    );
  };

  return (
    <div style={{ marginLeft: '135px', paddingRight: '340px', paddingTop: '1rem', paddingBottom: '1rem', paddingLeft: '1.5rem', background: '#1a1a1a', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '1rem' }}>Mitt Prosjekt</h1>

      {/* DAY */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#4db8ff' }}>📊 I DAG</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {depts.map(dept => (
            <div key={dept} style={{ background: '#2d3748', padding: '1rem', borderRadius: '10px', border: '1px solid #4b5563' }}>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>{dept}</p>
              <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#4db8ff' }}>{deptStats[dept].today}</p>
              <ProgressBar current={deptStats[dept].today} goal={allGoals[dept]?.day || 5} color="#4db8ff" />
            </div>
          ))}
          <div style={{ background: '#1f3a52', padding: '1rem', borderRadius: '10px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>MUON</p>
            <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#5a67d8' }}>{muonToday}</p>
            <ProgressBar current={muonToday} goal={muonGoals.day} color="#5a67d8" />
          </div>
        </div>
      </div>

      {/* WEEK */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#ffd700' }}>📊 IEKE</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {depts.map(dept => (
            <div key={`week-${dept}`} style={{ background: '#2d3748', padding: '1rem', borderRadius: '10px', border: '1px solid #4b5563' }}>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>{dept}</p>
              <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffd700' }}>{deptStats[dept].week}</p>
              <p style={{ fontSize: '0.7rem', color: '#d4a05a', marginTop: '0.5rem' }}>Runrate: {daysCompleted > 0 ? Math.round((deptStats[dept].week / daysCompleted) * 5) : 0}</p>
            </div>
          ))}
          <div style={{ background: '#1f3a52', padding: '1rem', borderRadius: '10px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>MUON</p>
            <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#5a67d8' }}>{muonWeek}</p>
            <p style={{ fontSize: '0.7rem', color: '#7ca3c0', marginTop: '0.5rem' }}>Runrate: {daysCompleted > 0 ? Math.round((muonWeek / daysCompleted) * 5) : 0}</p>
          </div>
        </div>
      </div>

      {/* MONTH */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#51cf66' }}>📊 MÅNED</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          {depts.map(dept => (
            <div key={`month-${dept}`} style={{ background: '#2d3748', padding: '1rem', borderRadius: '10px', border: '1px solid #4b5563' }}>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>{dept}</p>
              <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#51cf66' }}>{deptStats[dept].month}</p>
              <p style={{ fontSize: '0.7rem', color: '#78c969', marginTop: '0.5rem' }}>Runrate: {daysCompletedMonth > 0 ? Math.round((deptStats[dept].month / daysCompletedMonth) * workingDaysMonth) : 0}</p>
            </div>
          ))}
          <div style={{ background: '#1f3a52', padding: '1rem', borderRadius: '10px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>MUON</p>
            <p style={{ fontSize: '1.8rem', fontWeight: '700', color: '#5a67d8' }}>{muonMonth}</p>
            <p style={{ fontSize: '0.7rem', color: '#7ca3c0', marginTop: '0.5rem' }}>Runrate: {daysCompletedMonth > 0 ? Math.round((muonMonth / daysCompletedMonth) * workingDaysMonth) : 0}</p>
          </div>
        </div>
      </div>

      {/* TOP 3 + RANKINGS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', flex: 1, minHeight: 0 }}>
        {/* TOP 3 */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem' }}>🏆 Top 3</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', height: '100%' }}>
            {[
              { label: 'I DAG', data: top3TodayAll, color: '#4db8ff' },
              { label: 'UKE', data: top3WeekAll, color: '#ffd700' },
              { label: 'MÅNED', data: top3MonthAll, color: '#51cf66' },
            ].map(({ label, data, color }) => (
              <div key={label} style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', border: '1px solid #4b5563', height: 'fit-content' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color }}>{label}</h3>
                {data.map((emp, idx) => (
                  <div key={emp.ansatt} style={{ marginBottom: '0.4rem', fontSize: '0.7rem' }}>
                    <p style={{ fontWeight: '700', color: '#e2e8f0' }}>{medals[idx]} {emp.ansatt.substring(0, 10)}</p>
                    <p style={{ color: color, fontSize: '0.65rem' }}>{label === 'I DAG' ? emp.today : label === 'UKE' ? emp.week : emp.month} salg</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* RANKINGS */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem' }}>🥇 Avdeling</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', height: '100%' }}>
            {[
              { label: 'I DAG', data: deptRankingToday, color: '#4db8ff' },
              { label: 'UKE', data: deptRankingWeek, color: '#ffd700' },
              { label: 'MÅNED', data: deptRankingMonth, color: '#51cf66' },
            ].map(({ label, data, color }) => (
              <div key={label} style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', border: '1px solid #4b5563', height: 'fit-content' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color }}>{label}</h3>
                {data.map((d, idx) => (
                  <div key={d.dept} style={{ marginBottom: '0.4rem', fontSize: '0.7rem' }}>
                    <p style={{ fontWeight: '700', color: '#e2e8f0' }}>{medals[idx]} {d.dept}</p>
                    <p style={{ color: color, fontSize: '0.65rem' }}>{d.sales} salg</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
