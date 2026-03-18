import { useState, useEffect } from 'react';
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

  // Calculate sales by department & employee
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Listen to employees for department mapping
    const employeesRef = collection(db, 'employees');
    const employeeUnsub = onSnapshot(employeesRef, (empSnapshot) => {
      const employeeMap: { [key: string]: string } = {}; // name -> department
      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        employeeMap[data.name] = data.department || 'Unknown';
      });

      // Listen to progresjon data (via contracts)
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const contractUnsub = onSnapshot(contractsRef, (contractSnapshot) => {
        // Listen to livefeed for today
        const livefeedRef = collection(db, 'livefeed_sales');
        const livefeedUnsub = onSnapshot(livefeedRef, (livefeedSnapshot) => {
          const deptStats: { [key: string]: DepartmentStats } = {
            'KRS': { name: 'KRS', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
            'OSL': { name: 'OSL', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
            'Skien': { name: 'Skien', todaySales: 0, weekSales: 0, monthSales: 0, employees: [] },
          };
          const employeeSales: { [key: string]: { today: number; week: number; month: number; dept: string } } = {};

          // Process contracts (historical)
          contractSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            let selger = data.selger || '';
            selger = selger.replace(/ \/ selger$/i, '').trim();
            const dept = employeeMap[selger] || 'Unknown';
            const dato = data.dato || '';

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

                if (dept in deptStats) {
                  // Today
                  if (orderDate >= today) {
                    deptStats[dept].todaySales += sale;
                    employeeSales[selger].today += sale;
                  }
                  // Week
                  if (orderDate >= startOfWeek && orderDate <= today) {
                    deptStats[dept].weekSales += sale;
                    employeeSales[selger].week += sale;
                  }
                  // Month
                  if (orderDate >= startOfMonth && orderDate <= today) {
                    deptStats[dept].monthSales += sale;
                    employeeSales[selger].month += sale;
                  }
                }
              }
            }
          });

          // Add livefeed (today only)
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const userName = data.userName || '';
            const dept = employeeMap[userName] || 'Unknown';

            if (!employeeSales[userName]) {
              employeeSales[userName] = { today: 0, week: 0, month: 0, dept };
            }

            if (dept in deptStats) {
              deptStats[dept].todaySales += 1;
              employeeSales[userName].today += 1;
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

          // Calculate Muon totals (KRS + OSL + Skien)
          const muonTotals = {
            todaySales: deptStats['KRS'].todaySales + deptStats['OSL'].todaySales + deptStats['Skien'].todaySales,
            weekSales: deptStats['KRS'].weekSales + deptStats['OSL'].weekSales + deptStats['Skien'].weekSales,
            monthSales: deptStats['KRS'].monthSales + deptStats['OSL'].monthSales + deptStats['Skien'].monthSales,
          };

          setDepartments(deptStats);
          setMuonTotal(muonTotals);
          setTopEmployees({ today: topToday, week: topWeek, month: topMonth });

          console.log('✅ MITT PROSJEKT UPDATED:', deptStats);
        });

        return () => {
          livefeedUnsub();
          contractUnsub();
        };
      });

      return () => contractUnsub();
    });

    return () => employeeUnsub();
  }, []);

  return (
    <div className="mitt-prosjekt-container">
      <h1>Mitt Prosjekt</h1>

      {/* Department Grid */}
      <div className="dept-grid">
        {['KRS', 'OSL', 'Skien'].map((deptName) => (
          <div key={deptName} className="dept-card">
            <h3>{deptName}</h3>
            <div className="sales-row">
              <div className="sale-item">
                <span className="label">I dag</span>
                <span className="value">{departments[deptName].todaySales}</span>
              </div>
              <div className="sale-item">
                <span className="label">Uke</span>
                <span className="value">{departments[deptName].weekSales}</span>
              </div>
              <div className="sale-item">
                <span className="label">Måned</span>
                <span className="value">{departments[deptName].monthSales}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Muon Total */}
      <div className="muon-total-card">
        <h3>🏢 Muon Totalt</h3>
        <div className="sales-row">
          <div className="sale-item">
            <span className="label">I dag</span>
            <span className="value">{muonTotal.todaySales}</span>
          </div>
          <div className="sale-item">
            <span className="label">Uke</span>
            <span className="value">{muonTotal.weekSales}</span>
          </div>
          <div className="sale-item">
            <span className="label">Måned</span>
            <span className="value">{muonTotal.monthSales}</span>
          </div>
        </div>
      </div>

      {/* Top 3 Employees */}
      <div className="top-employees-grid">
        {/* Today */}
        <div className="top-card">
          <h4>🔥 Topp 3 I dag</h4>
          {topEmployees.today.map((emp, idx) => (
            <div key={idx} className="top-employee">
              <span className="rank">{idx + 1}.</span>
              <span className="name">{emp.name}</span>
              <span className="sales">{emp.sales}</span>
            </div>
          ))}
        </div>

        {/* Week */}
        <div className="top-card">
          <h4>📈 Topp 3 Uke</h4>
          {topEmployees.week.map((emp, idx) => (
            <div key={idx} className="top-employee">
              <span className="rank">{idx + 1}.</span>
              <span className="name">{emp.name}</span>
              <span className="sales">{emp.sales}</span>
            </div>
          ))}
        </div>

        {/* Month */}
        <div className="top-card">
          <h4>🎯 Topp 3 Måned</h4>
          {topEmployees.month.map((emp, idx) => (
            <div key={idx} className="top-employee">
              <span className="rank">{idx + 1}.</span>
              <span className="name">{emp.name}</span>
              <span className="sales">{emp.sales}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
