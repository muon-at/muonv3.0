import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/WallOfFame.css';

interface Record {
  title: string;
  value: number;
  employee: string;
  date: string;
  emoji: string;
}

interface Props {
  department?: string; // If provided, filter by department. If not, show all departments
  title?: string;
}

export default function WallOfFame({ department, title = 'WALL OF FAME' }: Props) {
  const [records, setRecords] = useState<Record[]>([
    { title: 'FLEST SALG PÅ 1 DAG', value: 0, employee: '-', date: '-', emoji: '☀️' },
    { title: 'FLEST SALG PÅ 1 UKE', value: 0, employee: '-', date: '-', emoji: '📅' },
    { title: 'FLEST SALG PÅ 1 MÅNED', value: 0, employee: '-', date: '-', emoji: '📊' },
    { title: 'FLEST SALG PÅ I ÅR', value: 0, employee: '-', date: '-', emoji: '🎯' },
    { title: 'FLEST SALG PÅ TOTALT', value: 0, employee: '-', date: '-', emoji: '🏆' },
  ]);



  useEffect(() => {
    const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), (livefeedSnapshot) => {
      const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), async (archiveSnapshot) => {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const startOfYear = new Date(today.getFullYear(), 0, 1);
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());

          // Collect all employees from both sources
          const employees = new Map<string, { day: number; week: number; month: number; year: number; total: number; dept: string }>();

          // TODAY from livefeed
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const userName = data.userName || '';
            if (!userName) return;

            if (!employees.has(userName)) {
              employees.set(userName, { day: 0, week: 0, month: 0, year: 0, total: 0, dept: '' });
            }
            const emp = employees.get(userName)!;
            emp.day++;
            emp.week++;
            emp.month++;
            emp.year++;
            emp.total++;
          });

          // HISTORICAL from contracts
          archiveSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            let selger = data.selger || '';
            const dato = data.dato || '';

            // Deduplicate: strip "/ selger" suffix
            selger = selger.replace(/ \/ selger$/i, '').trim();
            if (!selger) return;

            if (!employees.has(selger)) {
              employees.set(selger, { day: 0, week: 0, month: 0, year: 0, total: 0, dept: '' });
            }
            const emp = employees.get(selger)!;

            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);

                // Week
                if (orderDate >= startOfWeek && orderDate <= today) {
                  emp.week++;
                }

                // Month
                if (orderDate >= startOfMonth && orderDate <= today) {
                  emp.month++;
                }

                // Year
                if (orderDate >= startOfYear && orderDate <= today) {
                  emp.year++;
                }

                // Total
                emp.total++;
              }
            }
          });

          // Fetch department info for all employees
          try {
            const peopleSnap = await getDocs(collection(db, 'employees'));
            const deptMap = new Map<string, string>();
            
            console.log('👥 People collection docs:', peopleSnap.size);
            
            peopleSnap.docs.forEach((doc) => {
              const data = doc.data();
              const visual = data.name || '';
              const externalName = data.externalName || '';
              const dept = data.avdeling || '';
              
              console.log(`📍 ${visual} => ${dept}`);
              
              deptMap.set(visual.toLowerCase().trim(), dept);
              deptMap.set(externalName.toLowerCase().trim(), dept);
            });

            // Update dept in employees map
            employees.forEach((emp, name) => {
              const foundDept = deptMap.get(name.toLowerCase().trim());
              emp.dept = foundDept || 'Unknown';
              console.log(`✅ ${name} => ${emp.dept}`);
            });
          } catch (err) {
            console.error('❌ Error fetching people:', err);
          }

          // Filter by department if specified
          let filteredEmployees = Array.from(employees.entries());
          console.log('🔍 Total employees:', filteredEmployees.length);
          console.log('🔍 Filtering by department:', department);
          
          if (department) {
            filteredEmployees = filteredEmployees.filter(([name, emp]) => {
              const matches = emp.dept === department;
              if (matches) console.log(`✅ ${name} in ${emp.dept}`);
              return matches;
            });
            console.log('📊 Filtered employees:', filteredEmployees.length);
          }

          // Find best records
          const bestDay = filteredEmployees.reduce((max, [name, emp]) => emp.day > max.value ? { name, value: emp.day } : max, { name: '-', value: 0 });
          const bestWeek = filteredEmployees.reduce((max, [name, emp]) => emp.week > max.value ? { name, value: emp.week } : max, { name: '-', value: 0 });
          const bestMonth = filteredEmployees.reduce((max, [name, emp]) => emp.month > max.value ? { name, value: emp.month } : max, { name: '-', value: 0 });
          const bestYear = filteredEmployees.reduce((max, [name, emp]) => emp.year > max.value ? { name, value: emp.year } : max, { name: '-', value: 0 });
          const bestTotal = filteredEmployees.reduce((max, [name, emp]) => emp.total > max.value ? { name, value: emp.total } : max, { name: '-', value: 0 });

          setRecords([
            { 
              title: 'FLEST SALG PÅ 1 DAG', 
              value: bestDay.value, 
              employee: bestDay.name,
              date: bestDay.name !== '-' ? new Date().toLocaleDateString('no-NO') : '-',
              emoji: '☀️' 
            },
            { 
              title: 'FLEST SALG PÅ 1 UKE', 
              value: bestWeek.value, 
              employee: bestWeek.name,
              date: bestWeek.name !== '-' ? `Uke ${Math.ceil(new Date().getDate() / 7)}` : '-',
              emoji: '📅' 
            },
            { 
              title: 'FLEST SALG PÅ 1 MÅNED', 
              value: bestMonth.value, 
              employee: bestMonth.name,
              date: bestMonth.name !== '-' ? new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' }) : '-',
              emoji: '📊' 
            },
            { 
              title: 'FLEST SALG PÅ I ÅR', 
              value: bestYear.value, 
              employee: bestYear.name,
              date: bestYear.name !== '-' ? new Date().getFullYear().toString() : '-',
              emoji: '🎯' 
            },
            { 
              title: 'FLEST SALG PÅ TOTALT', 
              value: bestTotal.value, 
              employee: bestTotal.name,
              date: bestTotal.name !== '-' ? 'All-time' : '-',
              emoji: '🏆' 
            },
          ]);

          console.log('📊 Wall of Fame updated:', { 
            bestDay: `${bestDay.name} (${bestDay.value})`,
            bestWeek: `${bestWeek.name} (${bestWeek.value})`,
            bestMonth: `${bestMonth.name} (${bestMonth.value})`,
            bestYear: `${bestYear.name} (${bestYear.value})`,
            bestTotal: `${bestTotal.name} (${bestTotal.value})`,
            department,
            filteredCount: filteredEmployees.length,
          });
        } catch (err) {
          console.error('❌ Error calculating Wall of Fame:', err);
        }
      });

      return () => unsubscribeArchive();
    });

    return () => unsubscribeLivefeed();
  }, [department]);

  return (
    <div className="wall-of-fame-container">
      <h2 className="wall-of-fame-title">{title}</h2>
      
      <div className="records-grid">
        {records.map((record, idx) => (
          <div key={idx} className="record-box">
            <div className="record-emoji">{record.emoji}</div>
            <h3 className="record-title">{record.title}</h3>
            <div className="record-employee">{record.employee}</div>
            <div className="record-value">{record.value} salg</div>
            <div className="record-date">{record.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
