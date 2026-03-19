import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/WallOfFame.css';

interface Record {
  title: string;
  value: number;
  employee: string;
  emoji: string;
}

interface Props {
  department?: string;
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

          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());

          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

          const startOfYear = new Date(today.getFullYear(), 0, 1);

          // Get employee details for department mapping
          const empSnapshot = await getDocs(collection(db, 'employees'));
          const employeeMap: { [key: string]: string } = {}; // userName → department
          empSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userName && data.avdeling) {
              employeeMap[data.userName.toLowerCase()] = data.avdeling;
            }
          });

          // Calculate stats per seller
          const sellerStats: { [key: string]: { day: number; week: number; month: number; year: number; total: number; dept: string } } = {};

          // Load today's livefeed
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const userName = data.userName || '';
            const dept = employeeMap[userName.toLowerCase()] || 'unknown';

            if (!sellerStats[userName]) {
              sellerStats[userName] = { day: 0, week: 0, month: 0, year: 0, total: 0, dept };
            }
            sellerStats[userName].day += 1;
            sellerStats[userName].week += 1;
            sellerStats[userName].month += 1;
            sellerStats[userName].year += 1;
            sellerStats[userName].total += 1;
          });

          // Load contracts
          archiveSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            let selger = data.selger || '';
            const dato = data.dato || '';

            // Strip "/ selger" suffix
            selger = selger.replace(/ \/ selger$/i, '').trim();

            const dept = employeeMap[selger.toLowerCase()] || 'unknown';

            if (!sellerStats[selger]) {
              sellerStats[selger] = { day: 0, week: 0, month: 0, year: 0, total: 0, dept };
            }

            // Check date for week/month/year calculations
            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const contractDate = new Date(year, month - 1, day);
                contractDate.setHours(0, 0, 0, 0);

                sellerStats[selger].total += 1;

                if (contractDate >= startOfYear) {
                  sellerStats[selger].year += 1;
                }

                if (contractDate >= startOfMonth) {
                  sellerStats[selger].month += 1;
                }

                if (contractDate >= startOfWeek) {
                  sellerStats[selger].week += 1;
                }
              }
            }
          });

          console.log('📊 All sellerStats:', sellerStats);

          // Filter by department if specified
          let filteredStats = sellerStats;
          if (department) {
            filteredStats = {};
            Object.entries(sellerStats).forEach(([seller, stats]) => {
              if (stats.dept === department) {
                filteredStats[seller] = stats;
              }
            });
          }

          console.log('🔍 Filtered for', department || 'ALL', ':', filteredStats);

          // Find best for each period
          let bestDay = { name: '-', value: 0 };
          let bestWeek = { name: '-', value: 0 };
          let bestMonth = { name: '-', value: 0 };
          let bestYear = { name: '-', value: 0 };
          let bestTotal = { name: '-', value: 0 };

          Object.entries(filteredStats).forEach(([seller, stats]) => {
            if (stats.day > bestDay.value) {
              bestDay = { name: seller, value: stats.day };
            }
            if (stats.week > bestWeek.value) {
              bestWeek = { name: seller, value: stats.week };
            }
            if (stats.month > bestMonth.value) {
              bestMonth = { name: seller, value: stats.month };
            }
            if (stats.year > bestYear.value) {
              bestYear = { name: seller, value: stats.year };
            }
            if (stats.total > bestTotal.value) {
              bestTotal = { name: seller, value: stats.total };
            }
          });

          console.log('🏆 Best Records:', { bestDay, bestWeek, bestMonth, bestYear, bestTotal });

          setRecords([
            { title: 'FLEST SALG PÅ 1 DAG', value: bestDay.value, employee: bestDay.name, emoji: '☀️' },
            { title: 'FLEST SALG PÅ 1 UKE', value: bestWeek.value, employee: bestWeek.name, emoji: '📅' },
            { title: 'FLEST SALG PÅ 1 MÅNED', value: bestMonth.value, employee: bestMonth.name, emoji: '📊' },
            { title: 'FLEST SALG PÅ I ÅR', value: bestYear.value, employee: bestYear.name, emoji: '🎯' },
            { title: 'FLEST SALG PÅ TOTALT', value: bestTotal.value, employee: bestTotal.name, emoji: '🏆' },
          ]);
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
            <div className="record-value">{record.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
