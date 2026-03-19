import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/WallOfFame.css';

interface ProgresjonRow {
  ansatt: string;
  avdeling: string;
  dag: number;
  uke: number;
  måned: number;
}

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
    // Listen to Progresjon (DAY/WEEK/MONTH)
    const unsubscribeProgresjon = onSnapshot(collection(db, 'allente_progresjon'), (progSnapshot) => {
      // Listen to Contracts (YEAR/TOTAL)
      const unsubscribeContracts = onSnapshot(collection(db, 'allente_kontraktsarkiv'), (contractSnapshot) => {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Load Progresjon data
          const progresjonList: ProgresjonRow[] = [];
          progSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            progresjonList.push({
              ansatt: data.ansatt || '',
              avdeling: data.avdeling || '',
              dag: data.dag || 0,
              uke: data.uke || 0,
              måned: data.måned || 0,
            });
          });

          // Filter by department if specified
          let filteredProgresjon = progresjonList;
          if (department) {
            filteredProgresjon = progresjonList.filter(p => p.avdeling === department);
          }

          // Find best for DAY/WEEK/MONTH from Progresjon
          const bestDay = filteredProgresjon.reduce((max, p) => p.dag > max.dag ? p : max, filteredProgresjon[0] || { ansatt: '-', avdeling: '', dag: 0, uke: 0, måned: 0 });
          const bestWeek = filteredProgresjon.reduce((max, p) => p.uke > max.uke ? p : max, filteredProgresjon[0] || { ansatt: '-', avdeling: '', dag: 0, uke: 0, måned: 0 });
          const bestMonth = filteredProgresjon.reduce((max, p) => p.måned > max.måned ? p : max, filteredProgresjon[0] || { ansatt: '-', avdeling: '', dag: 0, uke: 0, måned: 0 });

          // Calculate YEAR and TOTAL from contracts
          const yearCounts: { [key: string]: number } = {};
          const totalCounts: { [key: string]: number } = {};
          const deptMap: { [key: string]: string } = {}; // Map seller name to department

          // First, build dept map from Progresjon
          filteredProgresjon.forEach(p => {
            deptMap[p.ansatt.toLowerCase()] = p.avdeling;
          });

          contractSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            let seller = data.selger || '';
            const dato = data.dato || '';

            // Strip "/ selger" suffix
            seller = seller.replace(/ \/ selger$/i, '').trim();

            // TOTAL count (all time)
            totalCounts[seller] = (totalCounts[seller] || 0) + 1;

            // YEAR count
            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const year = parseInt(parts[2]);
                if (year === today.getFullYear()) {
                  yearCounts[seller] = (yearCounts[seller] || 0) + 1;
                }
              }
            }
          });

          // Find best for YEAR and TOTAL
          let bestYearSeller = '-';
          let bestYearCount = 0;
          Object.entries(yearCounts).forEach(([seller, count]) => {
            // Check if seller is in filtered list (same department)
            const isInDept = filteredProgresjon.some(p => p.ansatt.toLowerCase() === seller.toLowerCase());
            if (isInDept && count > bestYearCount) {
              bestYearCount = count;
              bestYearSeller = seller;
            }
          });

          let bestTotalSeller = '-';
          let bestTotalCount = 0;
          Object.entries(totalCounts).forEach(([seller, count]) => {
            // Check if seller is in filtered list (same department)
            const isInDept = filteredProgresjon.some(p => p.ansatt.toLowerCase() === seller.toLowerCase());
            if (isInDept && count > bestTotalCount) {
              bestTotalCount = count;
              bestTotalSeller = seller;
            }
          });

          setRecords([
            { title: 'FLEST SALG PÅ 1 DAG', value: bestDay.dag, employee: bestDay.ansatt, emoji: '☀️' },
            { title: 'FLEST SALG PÅ 1 UKE', value: bestWeek.uke, employee: bestWeek.ansatt, emoji: '📅' },
            { title: 'FLEST SALG PÅ 1 MÅNED', value: bestMonth.måned, employee: bestMonth.ansatt, emoji: '📊' },
            { title: 'FLEST SALG PÅ I ÅR', value: bestYearCount, employee: bestYearSeller, emoji: '🎯' },
            { title: 'FLEST SALG PÅ TOTALT', value: bestTotalCount, employee: bestTotalSeller, emoji: '🏆' },
          ]);

          console.log('🏆 Wall of Fame updated:', { bestDay, bestWeek, bestMonth, bestYear: { bestYearSeller, bestYearCount }, bestTotal: { bestTotalSeller, bestTotalCount }, department });
        } catch (err) {
          console.error('❌ Error calculating Wall of Fame:', err);
        }
      });

      return () => unsubscribeContracts();
    });

    return () => unsubscribeProgresjon();
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
