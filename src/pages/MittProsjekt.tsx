import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MittProsjekt.css';

interface DepartmentStats {
  name: string;
  todaySales: number;
  weekSales: number;
  monthSales: number;
  employees: { name: string; sales: number }[];
}

interface TopEmployee {
  name: string;
  sales: number;
  department: string;
}

export default function MittProsjekt() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'status';
  const [departments, setDepartments] = useState<{ [key: string]: DepartmentStats }>({
    'KRS': { name: 'KRS', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
    'OSL': { name: 'OSL', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
    'Skien': { name: 'Skien', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
  });
  const [muonTotal, setMuonTotal] = useState({ todaySales: 0, weekSales: 0, monthSales: 0 });
  const [topEmployees, setTopEmployees] = useState<{ today: TopEmployee[]; week: TopEmployee[]; month: TopEmployee[] }>({
    today: [],
    week: [],
    month: [],
  });

  // Simplified: Read directly from contracts with avdeling field
  useEffect(() => {
    const contractsRef = collection(db, 'allente_kontraktsarkiv');
    const unsubscribe = onSnapshot(contractsRef, (snapshot) => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const deptStats: { [key: string]: DepartmentStats } = {
          'KRS': { name: 'KRS', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
          'OSL': { name: 'OSL', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
          'Skien': { name: 'Skien', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
        };
        const employeeSales: { [key: string]: { today: number; week: number; month: number; dept: string } } = {};

        // Process contracts
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          let ansatt = (data.selger || '').replace(/ \/ selger$/i, '').trim();
          const avdeling = data.avdeling || 'OSL';
          const dato = data.dato || '';

          if (dato && typeof dato === 'string' && ansatt) {
            const parts = dato.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const year = parseInt(parts[2]);
              const orderDate = new Date(year, month - 1, day);

              if (!employeeSales[ansatt]) {
                employeeSales[ansatt] = { today: 0, week: 0, month: 0, dept: avdeling };
              }

              const sale = 1; // 1 contract = 1 sale

              // Today
              if (orderDate >= today) {
                if (avdeling in deptStats) deptStats[avdeling].todaySales += sale;
                employeeSales[ansatt].today += sale;
              }
              // Week
              if (orderDate >= startOfWeek && orderDate <= today) {
                if (avdeling in deptStats) deptStats[avdeling].weekSales += sale;
                employeeSales[ansatt].week += sale;
              }
              // Month
              if (orderDate >= startOfMonth && orderDate <= today) {
                if (avdeling in deptStats) deptStats[avdeling].monthSales += sale;
                employeeSales[ansatt].month += sale;
              }
            }
          }
        });

        // Build top 3 employees for each period
        const employeeList = Object.entries(employeeSales).map(([name, stats]) => ({
          name,
          dept: stats.dept,
          today: stats.today,
          week: stats.week,
          month: stats.month,
        }));

        const topToday = employeeList
          .sort((a, b) => b.today - a.today)
          .slice(0, 3)
          .map(e => ({ name: e.name, sales: e.today, department: e.dept }));

        const topWeek = employeeList
          .sort((a, b) => b.week - a.week)
          .slice(0, 3)
          .map(e => ({ name: e.name, sales: e.week, department: e.dept }));

        const topMonth = employeeList
          .sort((a, b) => b.month - a.month)
          .slice(0, 3)
          .map(e => ({ name: e.name, sales: e.month, department: e.dept }));

        // Calculate Muon totals (sum of all 3 departments)
        const muonTotals = {
          todaySales: deptStats['KRS'].todaySales + deptStats['OSL'].todaySales + deptStats['Skien'].todaySales,
          weekSales: deptStats['KRS'].weekSales + deptStats['OSL'].weekSales + deptStats['Skien'].weekSales,
          monthSales: deptStats['KRS'].monthSales + deptStats['OSL'].monthSales + deptStats['Skien'].monthSales,
        };

        setDepartments(deptStats);
        setMuonTotal(muonTotals);
        setTopEmployees({ today: topToday, week: topWeek, month: topMonth });

        console.log('✅ MITT PROSJEKT UPDATED (from contracts):', deptStats);
        console.log('📊 Muon Totals:', muonTotals);
      } catch (err) {
        console.error('Error in Mitt Prosjekt:', err);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ marginLeft: '135px', paddingLeft: '10px', paddingRight: '340px', paddingTop: '2rem', paddingBottom: '2rem', background: '#1a1a1a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '2rem', color: '#e2e8f0' }}>Mitt Prosjekt</h1>

      {/* Department Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '3rem' }}>
        {['KRS', 'OSL', 'Skien'].map((dept) => (
          <div key={dept} style={{ background: '#2d3748', borderRadius: '12px', padding: '2rem', border: '1px solid #4b5563' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#e2e8f0' }}>{dept}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>I dag</p>
                <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#4db8ff' }}>{departments[dept]?.todaySales || 0}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Uke</p>
                <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ffd700' }}>{departments[dept]?.weekSales || 0}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Måned</p>
                <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ffd700' }}>{departments[dept]?.monthSales || 0}</p>
              </div>
            </div>

            {/* Top 3 for this department */}
            {activeTab === 'status' && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #4b5563' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#b0b0b0', marginBottom: '1rem' }}>Topp 3 denne måneden</p>
                {topEmployees.month
                  .filter(emp => emp.department === dept)
                  .slice(0, 3)
                  .map((emp, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #374151' }}>
                      <span style={{ fontSize: '0.85rem', color: '#d0d0d0' }}>{emp.name}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#10b981' }}>{emp.sales}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Muon Total */}
      <div style={{ background: '#2d3748', borderRadius: '12px', padding: '2rem', border: '2px solid #667eea', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '1.5rem', color: '#667eea' }}>MUON TOTALT</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          <div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>I dag</p>
            <p style={{ fontSize: '3rem', fontWeight: '700', color: '#4db8ff' }}>{muonTotal.todaySales}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Uke</p>
            <p style={{ fontSize: '3rem', fontWeight: '700', color: '#ffd700' }}>{muonTotal.weekSales}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Måned</p>
            <p style={{ fontSize: '3rem', fontWeight: '700', color: '#ffd700' }}>{muonTotal.monthSales}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
