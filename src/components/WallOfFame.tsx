import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/WallOfFame.css';

interface ProgresjonRow {
  ansatt: string;
  avdeling: string;
  dag: number;
  uke: number;
  måned: number;
  totalt: number;
}

interface Record {
  title: string;
  value: number;
  employee: string;
  emoji: string;
}

interface Props {
  department?: string; // If provided, filter by department. If not, show all
  title?: string;
}

export default function WallOfFame({ department, title = 'WALL OF FAME' }: Props) {
  const [records, setRecords] = useState<Record[]>([
    { title: 'FLEST SALG PÅ 1 DAG', value: 0, employee: '-', emoji: '☀️' },
    { title: 'FLEST SALG PÅ 1 UKE', value: 0, employee: '-', emoji: '📅' },
    { title: 'FLEST SALG PÅ 1 MÅNED', value: 0, employee: '-', emoji: '📊' },
    { title: 'FLEST SALG PÅ I ÅR', value: 0, employee: '-', emoji: '🎯' },
    { title: 'FLEST SALG PÅ TOTALT', value: 0, employee: '-', emoji: '🏆' },
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

          // Fetch employees for name mapping
          const empSnapshot = await getDocs(collection(db, 'employees'));
          const employeeDetailMap: { [key: string]: { dept: string; visualName: string } } = {};

          empSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const dept = data.department || 'Unknown';
            const visualName = data.name || '';

            if (data.name) {
              employeeDetailMap[data.name.toLowerCase().trim()] = { dept, visualName };
            }
            if (data.externalName) {
              employeeDetailMap[data.externalName.toLowerCase().trim()] = { dept, visualName };
            }
          });

          const getEmployeeDetail = (ansatt: string): { dept: string; visualName: string } => {
            const ansattLower = ansatt.toLowerCase().trim();
            if (employeeDetailMap[ansattLower]) return employeeDetailMap[ansattLower];
            for (const [key, detail] of Object.entries(employeeDetailMap)) {
              if (key.includes(ansattLower) || ansattLower.includes(key)) {
                return detail;
              }
            }
            return { dept: 'Unknown', visualName: ansatt };
          };

          // Build Progresjon-style data from livefeed + archive
          const sellerStats: { [key: string]: ProgresjonRow } = {};

          // TODAY from livefeed
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const ansatt = data.userName || 'Ukjent';
            const detail = getEmployeeDetail(ansatt);

            if (!sellerStats[ansatt]) {
              sellerStats[ansatt] = {
                ansatt: detail.visualName,
                avdeling: detail.dept,
                dag: 0,
                uke: 0,
                måned: 0,
                totalt: 0,
              };
            }
            sellerStats[ansatt].dag++;
            sellerStats[ansatt].uke++;
            sellerStats[ansatt].måned++;
            sellerStats[ansatt].totalt++;
          });

          // HISTORICAL from archive
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
                dag: 0,
                uke: 0,
                måned: 0,
                totalt: 0,
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
                  sellerStats[ansatt].dag++;
                }
                if (orderDate >= startOfWeek && orderDate <= today) {
                  sellerStats[ansatt].uke++;
                }
                if (orderDate >= startOfMonth && orderDate <= today) {
                  sellerStats[ansatt].måned++;
                }
                if (orderDate >= startOfYear && orderDate <= today) {
                  // Year already counted in totalt
                }

                sellerStats[ansatt].totalt++;
              }
            }
          });

          // Convert to array and filter by department if specified
          let progresjonList = Object.values(sellerStats);
          
          if (department) {
            progresjonList = progresjonList.filter(row => row.avdeling === department);
          }

          console.log('📊 Progresjon data:', { 
            total: Object.values(sellerStats).length,
            filtered: progresjonList.length,
            department: department || 'ALL',
          });

          // Find best records
          const bestDay = progresjonList.reduce((max, row) => row.dag > max.value ? { employee: row.ansatt, value: row.dag } : max, { employee: '-', value: 0 });
          const bestWeek = progresjonList.reduce((max, row) => row.uke > max.value ? { employee: row.ansatt, value: row.uke } : max, { employee: '-', value: 0 });
          const bestMonth = progresjonList.reduce((max, row) => row.måned > max.value ? { employee: row.ansatt, value: row.måned } : max, { employee: '-', value: 0 });
          
          // Year: approximate as month data (could be improved with year-specific tracking)
          const bestYear = progresjonList.reduce((max, row) => row.måned > max.value ? { employee: row.ansatt, value: row.måned } : max, { employee: '-', value: 0 });
          
          const bestTotal = progresjonList.reduce((max, row) => row.totalt > max.value ? { employee: row.ansatt, value: row.totalt } : max, { employee: '-', value: 0 });

          setRecords([
            { 
              title: 'FLEST SALG PÅ 1 DAG', 
              value: bestDay.value, 
              employee: bestDay.employee,
              emoji: '☀️' 
            },
            { 
              title: 'FLEST SALG PÅ 1 UKE', 
              value: bestWeek.value, 
              employee: bestWeek.employee,
              emoji: '📅' 
            },
            { 
              title: 'FLEST SALG PÅ 1 MÅNED', 
              value: bestMonth.value, 
              employee: bestMonth.employee,
              emoji: '📊' 
            },
            { 
              title: 'FLEST SALG PÅ I ÅR', 
              value: bestYear.value, 
              employee: bestYear.employee,
              emoji: '🎯' 
            },
            { 
              title: 'FLEST SALG PÅ TOTALT', 
              value: bestTotal.value, 
              employee: bestTotal.employee,
              emoji: '🏆' 
            },
          ]);

          console.log('🏆 Wall of Fame records:', { bestDay, bestWeek, bestMonth, bestYear, bestTotal });
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
          </div>
        ))}
      </div>
    </div>
  );
}
