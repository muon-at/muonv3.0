import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/Records.css';

export default function Records() {
  const { user } = useAuth();
  const [records, setRecords] = useState<{ [key: string]: any }>({
    bestDay: { title: 'Beste dag', value: 0, date: '-' },
    bestWeek: { title: 'Beste uke', value: 0, date: '-' },
    bestMonth: { title: 'Beste måned', value: 0, date: '-' },
    bestYear: { title: 'Beste år', value: 0, date: '-' },
    allTime: { title: 'Totalt', value: 0, date: 'All-time' },
  });

  // Load LIVE record data from allente_kontraktsarkiv
  useEffect(() => {
    const loadRecords = async () => {
      if (!user || !user.name) return;

      try {
        const contractsRef = collection(db, 'allente_kontraktsarkiv');
        const snapshot = await getDocs(contractsRef);

        // Group by user and organize by date
        const userContracts: any[] = [];
        const dailyCounts: { [key: string]: number } = {};
        const weeklyCounts: { [key: string]: number } = {};
        const monthlyCounts: { [key: string]: number } = {};
        const yearlyCounts: { [key: string]: number } = {};
        let totalCount = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const selger = data.selger || '';
          const dato = data.dato || '';

          // Filter by seller name
          if (selger !== user.name) return;

          totalCount++;
          userContracts.push(data);

          // Parse date: "12/3/2026" → [12, 3, 2026]
          if (dato && typeof dato === 'string') {
            const parts = dato.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const year = parseInt(parts[2]);
              const orderDate = new Date(year, month - 1, day);

              // Day key: "2026-03-12"
              const dayKey = orderDate.toISOString().split('T')[0];
              dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;

              // Week key: "2026-W11"
              const weekNum = Math.ceil(orderDate.getDate() / 7);
              const weekKey = `${year}-W${weekNum}`;
              weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;

              // Month key: "2026-03"
              const monthKey = `${year}-${String(month).padStart(2, '0')}`;
              monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;

              // Year key: "2026"
              const yearKey = String(year);
              yearlyCounts[yearKey] = (yearlyCounts[yearKey] || 0) + 1;
            }
          }
        });

        // Find best values
        const bestDayEntry = Object.entries(dailyCounts).reduce(
          (max, [key, val]) => (val > max[1] ? [key, val] : max),
          ['', 0]
        );
        const bestDayCount = bestDayEntry[1];
        const bestDayDate = bestDayEntry[0] ? new Date(bestDayEntry[0]).toLocaleDateString('no-NO') : '-';

        const bestWeekEntry = Object.entries(weeklyCounts).reduce(
          (max, [key, val]) => (val > max[1] ? [key, val] : max),
          ['', 0]
        );
        const bestWeekCount = bestWeekEntry[1];
        const bestWeekDate = bestWeekEntry[0] || '-';

        const bestMonthEntry = Object.entries(monthlyCounts).reduce(
          (max, [key, val]) => (val > max[1] ? [key, val] : max),
          ['', 0]
        );
        const bestMonthCount = bestMonthEntry[1];
        const bestMonthDate = bestMonthEntry[0] 
          ? new Date(bestMonthEntry[0] + '-01').toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })
          : '-';

        const bestYearEntry = Object.entries(yearlyCounts).reduce(
          (max, [key, val]) => (val > max[1] ? [key, val] : max),
          ['', 0]
        );
        const bestYearCount = bestYearEntry[1];
        const bestYearDate = bestYearEntry[0] || '-';

        setRecords({
          bestDay: { title: 'Beste dag', value: bestDayCount, date: bestDayDate },
          bestWeek: { title: 'Beste uke', value: bestWeekCount, date: bestWeekDate },
          bestMonth: { title: 'Beste måned', value: bestMonthCount, date: bestMonthDate },
          bestYear: { title: 'Beste år', value: bestYearCount, date: bestYearDate },
          allTime: { title: 'Totalt', value: totalCount, date: 'All-time' },
        });

        console.log('✅ LIVE RECORDS LOADED:', { bestDayCount, bestWeekCount, bestMonthCount, bestYearCount, totalCount });
      } catch (err) {
        console.error('❌ Error loading records:', err);
      }
    };

    loadRecords();
  }, [user?.id, user?.name]);

  if (!user) return <div className="records-container">Laster...</div>;

  return (
    <div className="records-container">
      <div className="records-content">
        <h1 className="user-header">{user?.name}</h1>

        {/* Top 3 Records */}
        <div className="records-grid-top">
          {Object.entries(records).slice(0, 3).map(([key, record]) => (
            <div key={key} className="record-plaque">
              <div className="plaque-icon">⭐</div>
              <div className="plaque-content">
                <div className="plaque-title">{record.title}</div>
                <div className="plaque-value-wreath">
                  <div className="wreath-left">🌿</div>
                  <div className="plaque-value">{record.value}</div>
                  <div className="wreath-right">🌿</div>
                </div>
                <div className="plaque-date">{record.date}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom 2 Records - Centered */}
        <div className="records-grid-bottom">
          {Object.entries(records).slice(3).map(([key, record]) => (
            <div key={key} className="record-plaque">
              <div className="plaque-icon">⭐</div>
              <div className="plaque-content">
                <div className="plaque-title">{record.title}</div>
                <div className="plaque-value-wreath">
                  <div className="wreath-left">🌿</div>
                  <div className="plaque-value">{record.value}</div>
                  <div className="wreath-right">🌿</div>
                </div>
                <div className="plaque-date">{record.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
