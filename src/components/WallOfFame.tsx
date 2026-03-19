import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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
    // Listen to wall_of_fame_records collection
    const unsubscribe = onSnapshot(collection(db, 'wall_of_fame_records'), (snapshot) => {
      try {
        // Load all records
        const allRecords: { [key: string]: any } = {};

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          allRecords[doc.id] = data;
        });

        console.log('📊 All Wall of Fame records:', allRecords);

        // Filter by department if specified
        let filteredRecords = allRecords;
        if (department) {
          filteredRecords = {};
          Object.entries(allRecords).forEach(([key, record]) => {
            if (record.avdeling === department) {
              filteredRecords[key] = record;
            }
          });
        }

        console.log('🔍 Filtered for', department || 'ALL', ':', filteredRecords);

        // Find best for each period
        let bestDay = { name: '-', value: 0 };
        let bestWeek = { name: '-', value: 0 };
        let bestMonth = { name: '-', value: 0 };
        let bestYear = { name: '-', value: 0 };
        let bestTotal = { name: '-', value: 0 };

        Object.values(filteredRecords).forEach((record: any) => {
          if (record.bestDay > bestDay.value) {
            bestDay = { name: record.visualName, value: record.bestDay };
          }
          if (record.bestWeek > bestWeek.value) {
            bestWeek = { name: record.visualName, value: record.bestWeek };
          }
          if (record.bestMonth > bestMonth.value) {
            bestMonth = { name: record.visualName, value: record.bestMonth };
          }
          if (record.bestYear > bestYear.value) {
            bestYear = { name: record.visualName, value: record.bestYear };
          }
          if (record.bestTotal > bestTotal.value) {
            bestTotal = { name: record.visualName, value: record.bestTotal };
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
        console.error('❌ Error reading Wall of Fame records:', err);
      }
    });

    return () => unsubscribe();
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
