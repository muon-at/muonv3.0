import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';

export default function MittProsjekt() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progresjonData, setProgresjonData] = useState<any[]>([]);

  // Calculate working days in month (mon-fri minus norwegian holidays)
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

            // Process livefeed
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

            // Process contracts
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

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const daysCompleted = Math.floor((today.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const workingDaysMonth = getWorkingDaysInMonth(today);
  const daysCompletedMonth = Math.floor((today.getTime() - new Date(today.getFullYear(), today.getMonth(), 1).getTime()) / (1000 * 60 * 60 * 24)) + 1;

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

  // Runrates Muon
  const muonRunrateTo16 = currentHour > 0 ? Math.round((muonToday / currentHour) * 6) : 0;
  const muonRunrateTo21 = currentHour > 0 ? Math.round((muonToday / currentHour) * 10) : 0;

  // Top 3 global
  const top3TodayAll = [...progresjonData].sort((a, b) => (b.today || 0) - (a.today || 0)).slice(0, 3);
  const top3WeekAll = [...progresjonData].sort((a, b) => (b.week || 0) - (a.week || 0)).slice(0, 3);
  const top3MonthAll = [...progresjonData].sort((a, b) => (b.month || 0) - (a.month || 0)).slice(0, 3);

  // Department rankings (excluding Muon)
  const deptRankingToday = [...depts]
    .map(d => ({ dept: d, sales: deptStats[d].today }))
    .sort((a, b) => b.sales - a.sales);
  const deptRankingWeek = [...depts]
    .map(d => ({ dept: d, sales: deptStats[d].week }))
    .sort((a, b) => b.sales - a.sales);
  const deptRankingMonth = [...depts]
    .map(d => ({ dept: d, sales: deptStats[d].month }))
    .sort((a, b) => b.sales - a.sales);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ marginLeft: '135px', paddingRight: '340px', paddingTop: '2rem', paddingBottom: '2rem', paddingLeft: '1.5rem', background: '#1a1a1a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '3rem' }}>Mitt Prosjekt</h1>

      {/* SALES GRID - ALL DEPARTMENTS + MUON */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '4rem' }}>
        {depts.map(dept => (
          <div key={dept} style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>{dept} - I DAG</p>
            <p style={{ fontSize: '2.2rem', fontWeight: '700', color: '#4db8ff', marginBottom: '0.5rem' }}>{deptStats[dept].today}</p>
            <p style={{ fontSize: '0.75rem', color: '#7ca3c0', marginBottom: '0.2rem' }}>Uke: {deptStats[dept].week}</p>
            <p style={{ fontSize: '0.75rem', color: '#7ca3c0' }}>Måned: {deptStats[dept].month}</p>
          </div>
        ))}

        {/* Muon Total */}
        <div style={{ background: '#1f3a52', padding: '1.5rem', borderRadius: '12px', border: '2px solid #5a67d8' }}>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>MUON TOTAL - I DAG</p>
          <p style={{ fontSize: '2.2rem', fontWeight: '700', color: '#5a67d8', marginBottom: '0.5rem' }}>{muonToday}</p>
          <p style={{ fontSize: '0.7rem', color: '#7ca3c0' }}>→ 16:00: {muonRunrateTo16}</p>
          <p style={{ fontSize: '0.7rem', color: '#7ca3c0' }}>→ 21:00: {muonRunrateTo21}</p>
        </div>
      </div>

      {/* WEEK STATS */}
      <div style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#ffd700' }}>📊 Denne Uken</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {depts.map(dept => (
            <div key={`week-${dept}`} style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>{dept}</p>
              <p style={{ fontSize: '2.2rem', fontWeight: '700', color: '#ffd700', marginBottom: '0.5rem' }}>{deptStats[dept].week}</p>
              <p style={{ fontSize: '0.75rem', color: '#d4a05a' }}>Runrate: {daysCompleted > 0 ? Math.round((deptStats[dept].week / daysCompleted) * 5) : 0}</p>
            </div>
          ))}
          <div style={{ background: '#1f3a52', padding: '1.5rem', borderRadius: '12px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>MUON</p>
            <p style={{ fontSize: '2.2rem', fontWeight: '700', color: '#5a67d8', marginBottom: '0.5rem' }}>{muonWeek}</p>
            <p style={{ fontSize: '0.75rem', color: '#7ca3c0' }}>Runrate: {daysCompleted > 0 ? Math.round((muonWeek / daysCompleted) * 5) : 0}</p>
          </div>
        </div>
      </div>

      {/* MONTH STATS */}
      <div style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#51cf66' }}>📊 Denne Måneden</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {depts.map(dept => (
            <div key={`month-${dept}`} style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>{dept}</p>
              <p style={{ fontSize: '2.2rem', fontWeight: '700', color: '#51cf66', marginBottom: '0.5rem' }}>{deptStats[dept].month}</p>
              <p style={{ fontSize: '0.75rem', color: '#78c969' }}>Runrate: {daysCompletedMonth > 0 ? Math.round((deptStats[dept].month / daysCompletedMonth) * workingDaysMonth) : 0}</p>
            </div>
          ))}
          <div style={{ background: '#1f3a52', padding: '1.5rem', borderRadius: '12px', border: '2px solid #5a67d8' }}>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.3rem' }}>MUON</p>
            <p style={{ fontSize: '2.2rem', fontWeight: '700', color: '#5a67d8', marginBottom: '0.5rem' }}>{muonMonth}</p>
            <p style={{ fontSize: '0.75rem', color: '#7ca3c0' }}>Runrate: {daysCompletedMonth > 0 ? Math.round((muonMonth / daysCompletedMonth) * workingDaysMonth) : 0}</p>
          </div>
        </div>
      </div>

      {/* TOP 3 EMPLOYEES */}
      <div style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '2rem' }}>🏆 Top 3 Ansatte</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          {/* Today */}
          <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#4db8ff' }}>I DAG</h3>
            {top3TodayAll.map((emp, idx) => (
              <div key={emp.ansatt} style={{ marginBottom: '0.8rem' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                  {medals[idx]} {emp.ansatt}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#4db8ff' }}>{emp.today} salg • {emp.avdeling}</p>
              </div>
            ))}
          </div>

          {/* Week */}
          <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#ffd700' }}>UKE</h3>
            {top3WeekAll.map((emp, idx) => (
              <div key={emp.ansatt} style={{ marginBottom: '0.8rem' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                  {medals[idx]} {emp.ansatt}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#ffd700' }}>{emp.week} salg • {emp.avdeling}</p>
              </div>
            ))}
          </div>

          {/* Month */}
          <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#51cf66' }}>MÅNED</h3>
            {top3MonthAll.map((emp, idx) => (
              <div key={emp.ansatt} style={{ marginBottom: '0.8rem' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                  {medals[idx]} {emp.ansatt}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#51cf66' }}>{emp.month} salg • {emp.avdeling}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DEPARTMENT RANKINGS */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '2rem' }}>🥇 Avdeling Ranking</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          {/* Today */}
          <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#4db8ff' }}>I DAG</h3>
            {deptRankingToday.map((d, idx) => (
              <div key={d.dept} style={{ marginBottom: '0.8rem' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                  {medals[idx]} {d.dept}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#4db8ff' }}>{d.sales} salg</p>
              </div>
            ))}
          </div>

          {/* Week */}
          <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#ffd700' }}>UKE</h3>
            {deptRankingWeek.map((d, idx) => (
              <div key={d.dept} style={{ marginBottom: '0.8rem' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                  {medals[idx]} {d.dept}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#ffd700' }}>{d.sales} salg</p>
              </div>
            ))}
          </div>

          {/* Month */}
          <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#51cf66' }}>MÅNED</h3>
            {deptRankingMonth.map((d, idx) => (
              <div key={d.dept} style={{ marginBottom: '0.8rem' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                  {medals[idx]} {d.dept}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#51cf66' }}>{d.sales} salg</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
