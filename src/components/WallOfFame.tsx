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
    // First load employee details
    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      const employeeDetailMap: { [key: string]: { dept: string; visualName: string } } = {};

      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const name = data.name || '';
        const visualName = data.visualName || name;
        const dept = data.avdeling || '';
        if (name) {
          employeeDetailMap[name.toLowerCase()] = { dept, visualName };
        }
      });

      console.log('👥 Employee map:', employeeDetailMap);

      // Now set up listeners
      const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), (livefeedSnapshot) => {
        const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), (archiveSnapshot) => {
          try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfYear = new Date(today.getFullYear(), 0, 1);

            // Calculate stats per seller
            const sellerStats: { [key: string]: { day: number; week: number; month: number; year: number; total: number; dept: string; display: string } } = {};

            // Load today's livefeed
            livefeedSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              const userName = data.userName || '';
              const empDetails = employeeDetailMap[userName.toLowerCase()] || { dept: 'unknown', visualName: userName };

              if (!sellerStats[userName]) {
                sellerStats[userName] = { day: 0, week: 0, month: 0, year: 0, total: 0, dept: empDetails.dept, display: empDetails.visualName };
              }
              sellerStats[userName].day += 1;
              sellerStats[userName].week += 1;
              sellerStats[userName].month += 1;
              sellerStats[userName].year += 1;
              sellerStats[userName].total += 1;
            });

            console.log('📊 Stats after livefeed:', sellerStats);

            // Load contracts
            archiveSnapshot.docs.forEach((doc) => {
              const data = doc.data();
              let selger = data.selger || '';
              const dato = data.dato || '';

              // Strip "/ selger" suffix (from Records.tsx)
              selger = selger.replace(/ \/ selger$/i, '').trim();

              const empDetails = employeeDetailMap[selger.toLowerCase()] || { dept: 'unknown', visualName: selger };

              if (!sellerStats[selger]) {
                sellerStats[selger] = { day: 0, week: 0, month: 0, year: 0, total: 0, dept: empDetails.dept, display: empDetails.visualName };
              }

              sellerStats[selger].total += 1;

              // Parse date: "12/3/2026" → [12, 3, 2026]
              if (dato && typeof dato === 'string') {
                const parts = dato.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0]);
                  const month = parseInt(parts[1]);
                  const year = parseInt(parts[2]);
                  const contractDate = new Date(year, month - 1, day);
                  contractDate.setHours(0, 0, 0, 0);

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

            console.log('📊 Final sellerStats:', sellerStats);

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
            let bestDay = { name: '-', value: 0, display: '-' };
            let bestWeek = { name: '-', value: 0, display: '-' };
            let bestMonth = { name: '-', value: 0, display: '-' };
            let bestYear = { name: '-', value: 0, display: '-' };
            let bestTotal = { name: '-', value: 0, display: '-' };

            Object.entries(filteredStats).forEach(([seller, stats]) => {
              if (stats.day > bestDay.value) {
                bestDay = { name: seller, value: stats.day, display: stats.display };
              }
              if (stats.week > bestWeek.value) {
                bestWeek = { name: seller, value: stats.week, display: stats.display };
              }
              if (stats.month > bestMonth.value) {
                bestMonth = { name: seller, value: stats.month, display: stats.display };
              }
              if (stats.year > bestYear.value) {
                bestYear = { name: seller, value: stats.year, display: stats.display };
              }
              if (stats.total > bestTotal.value) {
                bestTotal = { name: seller, value: stats.total, display: stats.display };
              }
            });

            console.log('🏆 Best Records:', { bestDay, bestWeek, bestMonth, bestYear, bestTotal });

            setRecords([
              { title: 'FLEST SALG PÅ 1 DAG', value: bestDay.value, employee: bestDay.display, emoji: '☀️' },
              { title: 'FLEST SALG PÅ 1 UKE', value: bestWeek.value, employee: bestWeek.display, emoji: '📅' },
              { title: 'FLEST SALG PÅ 1 MÅNED', value: bestMonth.value, employee: bestMonth.display, emoji: '📊' },
              { title: 'FLEST SALG PÅ I ÅR', value: bestYear.value, employee: bestYear.display, emoji: '🎯' },
              { title: 'FLEST SALG PÅ TOTALT', value: bestTotal.value, employee: bestTotal.display, emoji: '🏆' },
            ]);
          } catch (err) {
            console.error('❌ Error calculating Wall of Fame:', err);
          }
        });

        return () => unsubscribeArchive();
      });

      return () => unsubscribeLivefeed();
    });
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
