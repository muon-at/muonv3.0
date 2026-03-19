import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import WallOfFame from '../components/WallOfFame';

const DEPT_COLORS: { [key: string]: string } = {
  KRS: '#4db8ff',
  OSL: '#ff6b6b',
  Skien: '#51cf66',
};

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

  const top3TodayAll = [...progresjonData].sort((a, b) => (b.today || 0) - (a.today || 0)).slice(0, 3);
  const top3WeekAll = [...progresjonData].sort((a, b) => (b.week || 0) - (a.week || 0)).slice(0, 3);
  const top3MonthAll = [...progresjonData].sort((a, b) => (b.month || 0) - (a.month || 0)).slice(0, 3);

  const medals = ['🥇', '🥈', '🥉'];

  const ProgressBar = ({ current, goal, color }: { current: number; goal: number; color: string }) => {
    const percent = Math.min((current / goal) * 100, 100);
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ background: '#1f2937', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ background: color, height: '100%', width: `${percent}%`, transition: 'width 0.3s' }} />
        </div>
        <p style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.2rem' }}>{current} / {goal}</p>
      </div>
    );
  };

  return (
    <div style={{ marginLeft: '135px', paddingRight: '340px', paddingTop: 0, paddingBottom: '0.75rem', paddingLeft: 0, background: '#1a1a1a', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      {/* ORANGE HEADER WITH ALLENTE LOGO */}
      <div style={{ background: '#FF6B00', padding: '1.2rem 1rem', marginBottom: '1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#fff', margin: 0, letterSpacing: '0.05em' }}>allente</h1>
      </div>

      <div style={{ paddingLeft: '1rem', paddingRight: 0 }}>
        {/* MUON SUMMARY AT TOP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {/* DAG */}
          <div style={{ background: '#1f3a52', padding: '0.8rem', borderRadius: '8px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.3rem' }}>I DAG</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#4db8ff' }}>{muonToday}</p>
            <ProgressBar current={muonToday} goal={muonGoals.day} color="#4db8ff" />
          </div>

          {/* IEKE */}
          <div style={{ background: '#1f3a52', padding: '0.8rem', borderRadius: '8px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.3rem' }}>IEKE</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffd700' }}>{muonWeek}</p>
            <ProgressBar current={muonWeek} goal={muonGoals.week} color="#ffd700" />
            <p style={{ fontSize: '0.65rem', color: '#d4a05a', marginTop: '0.3rem' }}>Runrate: {daysCompleted > 0 ? Math.round((muonWeek / daysCompleted) * 5) : 0}</p>
          </div>

          {/* MÅNED */}
          <div style={{ background: '#1f3a52', padding: '0.8rem', borderRadius: '8px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.3rem' }}>MÅNED</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#51cf66' }}>{muonMonth}</p>
            <ProgressBar current={muonMonth} goal={muonGoals.month} color="#51cf66" />
            <p style={{ fontSize: '0.65rem', color: '#78c969', marginTop: '0.3rem' }}>Runrate: {daysCompletedMonth > 0 ? Math.round((muonMonth / daysCompletedMonth) * workingDaysMonth) : 0}</p>
          </div>
        </div>

      {/* DEPARTMENTS BREAKDOWN - 3 SECTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem', flex: 1, minHeight: 0 }}>
        {/* DAG SECTION */}
        <div style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', border: '1px solid #4b5563', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', color: '#4db8ff' }}>I DAG</h3>
          {depts.map(dept => (
            <div key={`day-${dept}`} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#1f2937', borderRadius: '6px', borderLeft: `3px solid ${DEPT_COLORS[dept]}` }}>
              <p style={{ fontSize: '0.7rem', color: DEPT_COLORS[dept], fontWeight: '700' }}>{dept}</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '700', color: '#4db8ff' }}>{deptStats[dept].today}</p>
              <p style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Mål: {allGoals[dept]?.day || 5}</p>
            </div>
          ))}
        </div>

        {/* IEKE SECTION */}
        <div style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', border: '1px solid #4b5563', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', color: '#ffd700' }}>IEKE</h3>
          {depts.map(dept => (
            <div key={`week-${dept}`} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#1f2937', borderRadius: '6px', borderLeft: `3px solid ${DEPT_COLORS[dept]}` }}>
              <p style={{ fontSize: '0.7rem', color: DEPT_COLORS[dept], fontWeight: '700' }}>{dept}</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffd700' }}>{deptStats[dept].week}</p>
              <p style={{ fontSize: '0.65rem', color: '#d4a05a' }}>Runrate: {daysCompleted > 0 ? Math.round((deptStats[dept].week / daysCompleted) * 5) : 0}</p>
            </div>
          ))}
        </div>

        {/* MÅNED SECTION */}
        <div style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', border: '1px solid #4b5563', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', color: '#51cf66' }}>MÅNED</h3>
          {depts.map(dept => (
            <div key={`month-${dept}`} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#1f2937', borderRadius: '6px', borderLeft: `3px solid ${DEPT_COLORS[dept]}` }}>
              <p style={{ fontSize: '0.7rem', color: DEPT_COLORS[dept], fontWeight: '700' }}>{dept}</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '700', color: '#51cf66' }}>{deptStats[dept].month}</p>
              <p style={{ fontSize: '0.65rem', color: '#78c969' }}>Runrate: {daysCompletedMonth > 0 ? Math.round((deptStats[dept].month / daysCompletedMonth) * workingDaysMonth) : 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TOP 3 - 3 COLUMNS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'I DAG', data: top3TodayAll, color: '#4db8ff' },
          { label: 'IEKE', data: top3WeekAll, color: '#ffd700' },
          { label: 'MÅNED', data: top3MonthAll, color: '#51cf66' },
        ].map(({ label, data, color }) => (
          <div key={label} style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', border: '1px solid #4b5563', height: 'fit-content' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', color }}>🏆 {label}</h3>
            {data.map((emp, idx) => (
              <div key={emp.ansatt} style={{ marginBottom: '0.3rem', fontSize: '0.65rem' }}>
                <p style={{ fontWeight: '700', color: DEPT_COLORS[emp.avdeling] || '#e2e8f0' }}>
                  {medals[idx]} {emp.ansatt}
                </p>
                <p style={{ color: color, fontSize: '0.6rem', marginTop: '0.05rem' }}>
                  {label === 'I DAG' ? emp.today : label === 'IEKE' ? emp.week : emp.month} salg
                </p>
              </div>
            ))}
          </div>
        ))}
        </div>

      {/* WALL OF FAME - ALL DEPARTMENTS */}
      <WallOfFame title="WALL OF FAME - MUON" />
      </div>
    </div>
  );
}
