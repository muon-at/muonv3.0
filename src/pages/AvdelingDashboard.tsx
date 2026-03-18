import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';

interface DepartmentStats {
  todaySales: number;
  weekSales: number;
  monthSales: number;
}

interface TopEmployee {
  name: string;
  sales: number;
  department: string;
}

export default function AvdelingDashboard() {
  const { user } = useAuth();
  const [deptStats, setDeptStats] = useState<DepartmentStats>({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
  });
  const [topEmployees, setTopEmployees] = useState({
    today: [] as TopEmployee[],
    week: [] as TopEmployee[],
    month: [] as TopEmployee[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.department) {
      setLoading(false);
      return;
    }

    // Listen to employees for department mapping
    const employeesRef = collection(db, 'employees');
    const employeeUnsub = onSnapshot(employeesRef, (empSnapshot) => {
      const employeeMap: { [key: string]: string } = {}; // name -> department
      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        employeeMap[data.name] = data.department || 'Unknown';
      });

      // Listen to contracts
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const contractUnsub = onSnapshot(contractsRef, (contractSnapshot) => {
        // Listen to livefeed for today
        const livefeedRef = collection(db, 'livefeed_sales');
        const livefeedUnsub = onSnapshot(livefeedRef, (livefeedSnapshot) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

          const employeeSales: { [key: string]: { today: number; week: number; month: number; dept: string } } = {};
          let deptTodaySales = 0;
          let deptWeekSales = 0;
          let deptMonthSales = 0;

          // Process contracts (historical)
          contractSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            let selger = data.selger || '';
            selger = selger.replace(/ \/ selger$/i, '').trim();
            const dept = employeeMap[selger];
            const dato = data.dato || '';

            // Only count if selger is in this user's department
            if (dept !== user.department) return;

            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);

                if (!employeeSales[selger]) {
                  employeeSales[selger] = { today: 0, week: 0, month: 0, dept };
                }

                // Count sales
                const sale = 1; // 1 contract = 1 sale

                // Today
                if (orderDate >= today) {
                  deptTodaySales += sale;
                  employeeSales[selger].today += sale;
                }
                // Week
                if (orderDate >= startOfWeek && orderDate <= today) {
                  deptWeekSales += sale;
                  employeeSales[selger].week += sale;
                }
                // Month
                if (orderDate >= startOfMonth && orderDate <= today) {
                  deptMonthSales += sale;
                  employeeSales[selger].month += sale;
                }
              }
            }
          });

          // Add livefeed (today only)
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const userName = data.userName || '';
            const dept = employeeMap[userName];

            // Only count if in this user's department
            if (dept !== user.department) return;

            if (!employeeSales[userName]) {
              employeeSales[userName] = { today: 0, week: 0, month: 0, dept };
            }

            deptTodaySales += 1;
            employeeSales[userName].today += 1;
          });

          // Build top 3 employees for each period
          const allEmployees = Object.entries(employeeSales).map(([name, stats]) => ({
            name,
            department: stats.dept,
            today: stats.today,
            week: stats.week,
            month: stats.month,
          }));

          const topToday: TopEmployee[] = allEmployees
            .sort((a, b) => b.today - a.today)
            .slice(0, 3)
            .map(e => ({ name: e.name, sales: e.today, department: e.department }));

          const topWeek: TopEmployee[] = allEmployees
            .sort((a, b) => b.week - a.week)
            .slice(0, 3)
            .map(e => ({ name: e.name, sales: e.week, department: e.department }));

          const topMonth: TopEmployee[] = allEmployees
            .sort((a, b) => b.month - a.month)
            .slice(0, 3)
            .map(e => ({ name: e.name, sales: e.month, department: e.department }));

          setDeptStats({
            todaySales: deptTodaySales,
            weekSales: deptWeekSales,
            monthSales: deptMonthSales,
          });
          setTopEmployees({ today: topToday, week: topWeek, month: topMonth });
          setLoading(false);

          console.log(`✅ MIN AVDELING (${user.department}) UPDATED`);
        });

        return () => livefeedUnsub();
      });

      return () => contractUnsub();
    });

    return () => employeeUnsub();
  }, [user?.id, user?.department]);

  if (loading) {
    return <div style={{ padding: '2rem', color: '#e2e8f0' }}>Laster...</div>;
  }

  if (!user || !user.department) {
    return <div style={{ padding: '2rem', color: '#e2e8f0' }}>Ingen avdeling satt</div>;
  }

  return (
    <div style={{ padding: '2rem', marginRight: '330px', color: '#e2e8f0' }}>
      <h1 style={{ marginBottom: '2rem', color: '#e2e8f0' }}>Min Avdeling: {user.department}</h1>

      {/* Department Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {/* Salg I dag */}
        <div style={{
          backgroundColor: '#2d3748',
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.85rem', color: '#b0b0b0', marginBottom: '0.5rem' }}>Salg I dag</span>
          <span style={{ fontSize: '2.5rem', color: '#90ee90', fontWeight: 'bold' }}>{deptStats.todaySales}</span>
        </div>

        {/* Salg Denne uken */}
        <div style={{
          backgroundColor: '#2d3748',
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.85rem', color: '#b0b0b0', marginBottom: '0.5rem' }}>Salg Denne uken</span>
          <span style={{ fontSize: '2.5rem', color: '#90ee90', fontWeight: 'bold' }}>{deptStats.weekSales}</span>
        </div>

        {/* Salg Denne måneden */}
        <div style={{
          backgroundColor: '#2d3748',
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.85rem', color: '#b0b0b0', marginBottom: '0.5rem' }}>Salg Denne måneden</span>
          <span style={{ fontSize: '2.5rem', color: '#90ee90', fontWeight: 'bold' }}>{deptStats.monthSales}</span>
        </div>
      </div>

      {/* Top Employees Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
      }}>
        {/* Top Today */}
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', color: '#5a67d8', marginBottom: '1rem', textAlign: 'center' }}>Top 3 I dag</h3>
          {topEmployees.today.length === 0 ? (
            <p style={{ color: '#b0b0b0', fontSize: '0.9rem' }}>Ingen salg i dag</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topEmployees.today.map((emp, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: '#2d3748',
                  borderRadius: '4px',
                }}>
                  <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
                    {idx + 1}. {emp.name}
                  </span>
                  <span style={{ color: '#90ee90', fontWeight: 'bold' }}>{emp.sales}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Week */}
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', color: '#5a67d8', marginBottom: '1rem', textAlign: 'center' }}>Top 3 Uke</h3>
          {topEmployees.week.length === 0 ? (
            <p style={{ color: '#b0b0b0', fontSize: '0.9rem' }}>Ingen salg denne uken</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topEmployees.week.map((emp, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: '#2d3748',
                  borderRadius: '4px',
                }}>
                  <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
                    {idx + 1}. {emp.name}
                  </span>
                  <span style={{ color: '#90ee90', fontWeight: 'bold' }}>{emp.sales}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Month */}
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', color: '#5a67d8', marginBottom: '1rem', textAlign: 'center' }}>Top 3 Måned</h3>
          {topEmployees.month.length === 0 ? (
            <p style={{ color: '#b0b0b0', fontSize: '0.9rem' }}>Ingen salg denne måneden</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {topEmployees.month.map((emp, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: '#2d3748',
                  borderRadius: '4px',
                }}>
                  <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
                    {idx + 1}. {emp.name}
                  </span>
                  <span style={{ color: '#90ee90', fontWeight: 'bold' }}>{emp.sales}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
