import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';

interface Goals {
  day: number;
  week: number;
  month: number;
}

export default function AvdelingDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progresjonData, setProgresjonData] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goals>({ day: 5, week: 20, month: 80 });
  const [editingGoals, setEditingGoals] = useState<Goals | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);

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
    if (!user?.department) {
      setLoading(false);
      return;
    }

    // Load goals from Firestore
    getDocs(collection(db, 'department_goals')).then((snap) => {
      const doc = snap.docs.find(d => d.id === user.department);
      if (doc) {
        const data = doc.data();
        setGoals({ day: data.day || 5, week: data.week || 20, month: data.month || 80 });
      }
    });

    // Fetch employees for masterfil mapping
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

              if (detail.dept !== user.department) return;

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

              if (detail.dept !== user.department) return;

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

  const handleSaveGoals = async () => {
    if (!editingGoals || !user?.department) return;
    try {
      const goalsRef = doc(db, 'department_goals', user.department);
      await setDoc(goalsRef, editingGoals);
      setGoals(editingGoals);
      setEditingGoals(null);
      setShowGoalModal(false);
    } catch (err) {
      console.error('Error saving goals:', err);
    }
  };

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

  const deptTodayTotal = progresjonData.reduce((s, r) => s + (r.today || 0), 0);
  const deptWeekTotal = progresjonData.reduce((s, r) => s + (r.week || 0), 0);
  const deptMonthTotal = progresjonData.reduce((s, r) => s + (r.month || 0), 0);

  const runrateTo16 = currentHour > 0 ? Math.round((deptTodayTotal / currentHour) * 6) : 0;
  const runrateTo21 = currentHour > 0 ? Math.round((deptTodayTotal / currentHour) * 10) : 0;

  // Progress bar helper
  const ProgressBar = ({ current, goal, color }: { current: number; goal: number; color: string }) => {
    const percent = Math.min((current / goal) * 100, 100);
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ background: '#1f2937', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ background: color, height: '100%', width: `${percent}%`, transition: 'width 0.3s' }} />
        </div>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
          {current} / {goal}
        </p>
      </div>
    );
  };

  const canEditGoals = user?.role === 'owner' || user?.role === 'teamleder';

  return (
    <div style={{ marginLeft: '135px', paddingRight: '340px', paddingTop: '1rem', paddingBottom: '1rem', paddingLeft: '1.5rem', background: '#1a1a1a', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Min Avdeling: {user.department}</h1>
        {canEditGoals && (
          <button
            onClick={() => {
              setEditingGoals(goals);
              setShowGoalModal(true);
            }}
            style={{ padding: '0.5rem 1rem', background: '#5a67d8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ⚙️ Endre Mål
          </button>
        )}
      </div>

      {/* SALG STATISTICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Today */}
        <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>SALG I DAG</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#4db8ff', marginBottom: '0.5rem' }}>{deptTodayTotal}</p>
          <ProgressBar current={deptTodayTotal} goal={goals.day} color="#4db8ff" />
          <p style={{ fontSize: '0.75rem', color: '#7ca3c0', marginTop: '0.5rem' }}>→ 16:00: {runrateTo16}</p>
          <p style={{ fontSize: '0.75rem', color: '#7ca3c0' }}>→ 21:00: {runrateTo21}</p>
        </div>

        {/* Week */}
        <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>SALG DENNE UKE</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#ffd700', marginBottom: '0.5rem' }}>{deptWeekTotal}</p>
          <ProgressBar current={deptWeekTotal} goal={goals.week} color="#ffd700" />
          <p style={{ fontSize: '0.75rem', color: '#d4a05a', marginTop: '0.5rem' }}>Runrate: {daysCompleted > 0 ? Math.round((deptWeekTotal / daysCompleted) * 5) : 0}</p>
        </div>

        {/* Month */}
        <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>SALG DENNE MÅNEDEN</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#51cf66', marginBottom: '0.5rem' }}>{deptMonthTotal}</p>
          <ProgressBar current={deptMonthTotal} goal={goals.month} color="#51cf66" />
          <p style={{ fontSize: '0.75rem', color: '#78c969', marginTop: '0.5rem' }}>Runrate: {daysCompletedMonth > 0 ? Math.round((deptMonthTotal / daysCompletedMonth) * workingDaysMonth) : 0}</p>
        </div>
      </div>

      {/* TOP 3 BY PERIOD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', flex: 1 }}>
        {/* Top 3 Today */}
        <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#4db8ff' }}>🏆 Top 3 I DAG</h3>
          {[...progresjonData].sort((a, b) => (b.today || 0) - (a.today || 0)).slice(0, 3).map((emp, idx) => (
            <div key={emp.ansatt} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #404040' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                {['🥇', '🥈', '🥉'][idx]} {emp.ansatt}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#4db8ff', fontWeight: '600' }}>{emp.today} salg</p>
            </div>
          ))}
        </div>

        {/* Top 3 Week */}
        <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#ffd700' }}>🏆 Top 3 UKE</h3>
          {[...progresjonData].sort((a, b) => (b.week || 0) - (a.week || 0)).slice(0, 3).map((emp, idx) => (
            <div key={emp.ansatt} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #404040' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                {['🥇', '🥈', '🥉'][idx]} {emp.ansatt}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#ffd700', fontWeight: '600' }}>{emp.week} salg</p>
            </div>
          ))}
        </div>

        {/* Top 3 Month */}
        <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '1px solid #4b5563', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: '#51cf66' }}>🏆 Top 3 MÅNED</h3>
          {[...progresjonData].sort((a, b) => (b.month || 0) - (a.month || 0)).slice(0, 3).map((emp, idx) => (
            <div key={emp.ansatt} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #404040' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e2e8f0' }}>
                {['🥇', '🥈', '🥉'][idx]} {emp.ansatt}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#51cf66', fontWeight: '600' }}>{emp.month} salg</p>
            </div>
          ))}
        </div>
      </div>

      {/* GOAL MODAL */}
      {showGoalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#2d3748', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>Endre Mål for {user.department}</h2>
            
            {editingGoals && (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.9rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>Mål I DAG</label>
                  <input
                    type="number"
                    value={editingGoals.day}
                    onChange={(e) => setEditingGoals({ ...editingGoals, day: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', background: '#1f2937', border: '1px solid #4b5563', color: '#e2e8f0', borderRadius: '6px', fontSize: '1rem' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.9rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>Mål IEKE</label>
                  <input
                    type="number"
                    value={editingGoals.week}
                    onChange={(e) => setEditingGoals({ ...editingGoals, week: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', background: '#1f2937', border: '1px solid #4b5563', color: '#e2e8f0', borderRadius: '6px', fontSize: '1rem' }}
                  />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ fontSize: '0.9rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>Mål MÅNED</label>
                  <input
                    type="number"
                    value={editingGoals.month}
                    onChange={(e) => setEditingGoals({ ...editingGoals, month: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.75rem', background: '#1f2937', border: '1px solid #4b5563', color: '#e2e8f0', borderRadius: '6px', fontSize: '1rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={handleSaveGoals}
                    style={{ flex: 1, padding: '0.75rem', background: '#5a67d8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Lagre
                  </button>
                  <button
                    onClick={() => setShowGoalModal(false)}
                    style={{ flex: 1, padding: '0.75rem', background: '#404040', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
