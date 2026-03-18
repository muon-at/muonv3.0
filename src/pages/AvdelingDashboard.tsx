import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';

export default function AvdelingDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progresjonData, setProgresjonData] = useState<any[]>([]);
  const cacheRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.department) {
      setLoading(false);
      return;
    }

    // Fetch employees for masterfil mapping
    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      const employeeDetailMap: { [key: string]: { dept: string; externalName: string } } = {};
      const employeeMapLower: { [key: string]: string } = {};

      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const dept = data.department || 'Unknown';
        const externalName = data.externalName || '';

        if (data.name) {
          employeeDetailMap[data.name] = { dept, externalName };
          employeeMapLower[data.name.toLowerCase().trim()] = dept;
        }
        if (data.externalName) {
          employeeDetailMap[data.externalName] = { dept, externalName };
          employeeMapLower[data.externalName.toLowerCase().trim()] = dept;
        }
      });

      const getEmployeeDetail = (ansatt: string): { dept: string; externalName: string } => {
        if (employeeDetailMap[ansatt]) return employeeDetailMap[ansatt];
        const ansattLower = ansatt.toLowerCase().trim();
        for (const [key, detail] of Object.entries(employeeDetailMap)) {
          if (key.toLowerCase().trim() === ansattLower) return detail;
        }
        for (const [key, detail] of Object.entries(employeeDetailMap)) {
          const keyLower = key.toLowerCase().trim();
          if (keyLower.includes(ansattLower) || ansattLower.includes(keyLower)) {
            return detail;
          }
        }
        return { dept: 'Unknown', externalName: '' };
      };

      // Listen to contracts + livefeed
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

            // Process today posts from livefeed
            livefeedSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              const ansatt = data.userName || 'Ukjent';
              const detail = getEmployeeDetail(ansatt);

              if (detail.dept !== user.department) return;

              if (!sellerStats[ansatt]) {
                sellerStats[ansatt] = {
                  ansatt,
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

              if (detail.dept !== user.department) return;

              const dato = data.dato || '';

              if (!sellerStats[ansatt]) {
                sellerStats[ansatt] = {
                  ansatt,
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

                  // Today
                  if (orderDate >= today && orderDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
                    sellerStats[ansatt].today++;
                  }
                  // Week
                  if (orderDate >= startOfWeek && orderDate <= today) {
                    sellerStats[ansatt].week++;
                  }
                  // Month
                  if (orderDate >= startOfMonth && orderDate <= today) {
                    sellerStats[ansatt].month++;
                  }
                }
              }
            });

            const progresjonList = Object.values(sellerStats)
              .sort((a, b) => b.week - a.week);

            cacheRef.current = progresjonList;
            setProgresjonData(progresjonList);
            setLoading(false);
          } catch (err) {
            console.error('AvdelingDashboard error:', err);
            setLoading(false);
          }
        });

        return () => {
          unsubscribeLivefeed();
          unsubscribeArchive();
        };
      });
    });
  }, [user?.department]);

  if (loading) {
    return <div style={{ padding: '2rem', color: '#999' }}>Laster...</div>;
  }

  if (!user?.department) {
    return <div style={{ padding: '2rem', color: '#999' }}>Ingen avdeling funnet</div>;
  }

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const daysCompleted = Math.floor((today.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const deptTodayTotal = progresjonData.reduce((s, r) => s + (r.today || 0), 0);
  const deptWeekTotal = progresjonData.reduce((s, r) => s + (r.week || 0), 0);
  const deptMonthTotal = progresjonData.reduce((s, r) => s + (r.month || 0), 0);

  // Runrates
  const runrateTo16 = currentHour > 0 ? Math.round((deptTodayTotal / currentHour) * 6) : 0;
  const runrateTo21 = currentHour > 0 ? Math.round((deptTodayTotal / currentHour) * 10) : 0;
  const runrateWeek = daysCompleted > 0 ? Math.round((deptWeekTotal / daysCompleted) * 5) : 0;

  // Top 3 by period
  const top3Today = [...progresjonData].sort((a, b) => (b.today || 0) - (a.today || 0)).slice(0, 3);
  const top3Week = [...progresjonData].sort((a, b) => (b.week || 0) - (a.week || 0)).slice(0, 3);
  const top3Month = [...progresjonData].sort((a, b) => (b.month || 0) - (a.month || 0)).slice(0, 3);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ marginLeft: '135px', paddingRight: '340px', paddingTop: '2rem', paddingBottom: '2rem', paddingLeft: '1.5rem', background: '#1a1a1a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '3rem' }}>Min Avdeling: {user.department}</h1>

      {/* SALG STATISTICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '4rem' }}>
        {/* Today */}
        <div style={{ background: '#2d3748', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>SALG I DAG</p>
          <p style={{ fontSize: '3rem', fontWeight: '700', color: '#4db8ff', marginBottom: '1rem' }}>{deptTodayTotal}</p>
          <p style={{ fontSize: '0.85rem', color: '#7ca3c0' }}>→ 16:00: {runrateTo16}</p>
          <p style={{ fontSize: '0.85rem', color: '#7ca3c0' }}>→ 21:00: {runrateTo21}</p>
        </div>

        {/* Week */}
        <div style={{ background: '#2d3748', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>SALG DENNE UKEN</p>
          <p style={{ fontSize: '3rem', fontWeight: '700', color: '#ffd700', marginBottom: '1rem' }}>{deptWeekTotal}</p>
          <p style={{ fontSize: '0.85rem', color: '#d4a05a' }}>Runrate: {runrateWeek} (5 dager)</p>
        </div>

        {/* Month */}
        <div style={{ background: '#2d3748', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>SALG DENNE MÅNEDEN</p>
          <p style={{ fontSize: '3rem', fontWeight: '700', color: '#51cf66', marginBottom: '1rem' }}>{deptMonthTotal}</p>
          <p style={{ fontSize: '0.85rem', color: '#78c969' }}>Dager så langt: {Math.floor((today.getTime() - new Date(today.getFullYear(), today.getMonth(), 1).getTime()) / (1000 * 60 * 60 * 24)) + 1}</p>
        </div>
      </div>

      {/* TOP 3 BY PERIOD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
        {/* Top 3 Today */}
        <div style={{ background: '#2d3748', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1.5rem', color: '#4db8ff' }}>🏆 Top 3 I DAG</h3>
          {top3Today.map((emp, idx) => (
            <div key={emp.ansatt} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #404040' }}>
              <p style={{ fontSize: '1rem', fontWeight: '700', color: '#e2e8f0' }}>
                {medals[idx]} {emp.ansatt}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#4db8ff', fontWeight: '600' }}>{emp.today} salg</p>
            </div>
          ))}
        </div>

        {/* Top 3 Week */}
        <div style={{ background: '#2d3748', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1.5rem', color: '#ffd700' }}>🏆 Top 3 IEKE</h3>
          {top3Week.map((emp, idx) => (
            <div key={emp.ansatt} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #404040' }}>
              <p style={{ fontSize: '1rem', fontWeight: '700', color: '#e2e8f0' }}>
                {medals[idx]} {emp.ansatt}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#ffd700', fontWeight: '600' }}>{emp.week} salg</p>
            </div>
          ))}
        </div>

        {/* Top 3 Month */}
        <div style={{ background: '#2d3748', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1.5rem', color: '#51cf66' }}>🏆 Top 3 MÅNED</h3>
          {top3Month.map((emp, idx) => (
            <div key={emp.ansatt} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #404040' }}>
              <p style={{ fontSize: '1rem', fontWeight: '700', color: '#e2e8f0' }}>
                {medals[idx]} {emp.ansatt}
              </p>
              <p style={{ fontSize: '0.9rem', color: '#51cf66', fontWeight: '600' }}>{emp.month} salg</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
