import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/Records.css';

// Helper: get ISO date string
const getISODate = (date: Date) => date.toISOString().split('T')[0];

export default function Records() {
  const { user } = useAuth();
  const [records, setRecords] = useState<{ [key: string]: any }>({
    bestDay: { title: 'Beste dag', value: 0, date: '-' },
    bestWeek: { title: 'Beste uke', value: 0, date: '-' },
    bestMonth: { title: 'Beste måned', value: 0, date: '-' },
    bestYear: { title: 'Beste år', value: 0, date: '-' },
    allTime: { title: 'Totalt', value: 0, date: 'All-time' },
  });

  // Load LIVE record data - TODAY from livefeed_sales, HISTORICAL from allente_kontraktsarkiv
  useEffect(() => {
    if (!user || !user.name) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Listener 1: livefeed_sales (TODAY only)
    const livefeedRef = collection(db, 'livefeed_sales');
    const unsubscribeLivefeed = onSnapshot(livefeedRef, (livefeedSnapshot) => {
      // Listener 2: allente_kontraktsarkiv (HISTORICAL)
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const unsubscribeArchive = onSnapshot(contractsRef, (archiveSnapshot) => {
        try {
          // TODAY count from livefeed_sales
          let todayCount = 0;
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userName === user.name) {
              todayCount++;
            }
          });

          // Historical aggregations from archive
          const dailyCounts: { [key: string]: number } = {};
          const weeklyCounts: { [key: string]: number } = {};
          const monthlyCounts: { [key: string]: number } = {};
          const yearlyCounts: { [key: string]: number } = {};
          let allTimeCount = 0;

          archiveSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            let selger = data.selger || '';
            const dato = data.dato || '';

            // Deduplicate: strip "/ selger" suffix
            selger = selger.replace(/ \/ selger$/i, '').trim();

            // Filter by seller name
            if (selger !== user.name) return;

            allTimeCount++;

            // Parse date: "12/3/2026" → [12, 3, 2026]
            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);

                // Day key: "2026-03-12"
                const dayKey = getISODate(orderDate);
                dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;

                // Week key: ISO week number
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

          // THIS WEEK count from livefeed
          let thisWeekLiveCount = 0;
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userName === user.name) {
              thisWeekLiveCount++;
            }
          });

          // THIS MONTH count from livefeed
          let thisMonthLiveCount = 0;
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userName === user.name) {
              thisMonthLiveCount++;
            }
          });

          // Find best historical values
          const bestDayEntry = Object.entries(dailyCounts).reduce(
            (max, [key, val]) => (val > max[1] ? [key, val] : max),
            ['', 0] as [string, number]
          );

          // BEST DAY: max(historical best, today's livefeed)
          const bestDayCount = Math.max(bestDayEntry[1], todayCount);
          const bestDayDate = bestDayCount === todayCount && todayCount > 0 
            ? new Date().toLocaleDateString('no-NO')
            : (bestDayEntry[0] ? new Date(bestDayEntry[0]).toLocaleDateString('no-NO') : '-');

          const bestWeekEntry = Object.entries(weeklyCounts).reduce(
            (max, [key, val]) => (val > max[1] ? [key, val] : max),
            ['', 0] as [string, number]
          );

          // THIS WEEK from archive
          const thisWeekArchiveCount = Object.entries(weeklyCounts)
            .filter(([key]) => {
              const [, weekStr] = key.split('-W');
              const weekNum = Math.ceil(today.getDate() / 7);
              return weekStr === String(weekNum);
            })
            .reduce((sum, [, val]) => sum + val, 0);

          // BEST WEEK: max(historical best, this week's total)
          const thisWeekTotal = thisWeekLiveCount + thisWeekArchiveCount;
          const bestWeekCount = Math.max(bestWeekEntry[1], thisWeekTotal);
          const bestWeekDate = bestWeekCount === thisWeekTotal && thisWeekTotal > 0 
            ? 'Denne uken' 
            : (bestWeekEntry[0] || '-');

          const bestMonthEntry = Object.entries(monthlyCounts).reduce(
            (max, [key, val]) => (val > max[1] ? [key, val] : max),
            ['', 0] as [string, number]
          );

          // THIS MONTH from archive
          const thisMonthArchiveCount = Object.entries(monthlyCounts)
            .filter(([key]) => {
              const [year, month] = key.split('-');
              return year === String(today.getFullYear()) && month === String(today.getMonth() + 1).padStart(2, '0');
            })
            .reduce((sum, [, val]) => sum + val, 0);

          // BEST MONTH: max(historical best, this month's total)
          const thisMonthTotal = thisMonthLiveCount + thisMonthArchiveCount;
          const bestMonthCount = Math.max(bestMonthEntry[1], thisMonthTotal);
          const bestMonthDate = bestMonthCount === thisMonthTotal && thisMonthTotal > 0
            ? new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })
            : (bestMonthEntry[0] 
              ? new Date(bestMonthEntry[0] + '-01').toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })
              : '-');

          const bestYearEntry = Object.entries(yearlyCounts).reduce(
            (max, [key, val]) => (val > max[1] ? [key, val] : max),
            ['', 0] as [string, number]
          );

          const bestYearCount = bestYearEntry[1];
          const bestYearDate = bestYearEntry[0] || '-';

          // Update state
          setRecords({
            bestDay: { title: 'Beste dag', value: bestDayCount, date: bestDayDate },
            bestWeek: { title: 'Beste uke', value: bestWeekCount, date: bestWeekDate },
            bestMonth: { title: 'Beste måned', value: bestMonthCount, date: bestMonthDate },
            bestYear: { title: 'Beste år', value: bestYearCount, date: bestYearDate },
            allTime: { title: 'Totalt', value: allTimeCount, date: 'All-time' },
          });

          console.log('✅ RECORDS UPDATED (dual-source):', { bestDayCount, bestWeekCount, bestMonthCount });
        } catch (err) {
          console.error('❌ Error loading records:', err);
        }
      });

      return unsubscribeArchive;
    });

    return unsubscribeLivefeed;
  }, [user?.id, user?.name]);

  return (
    <div className="records-container">
      <h1 style={{
        fontSize: '3.5rem',
        fontWeight: 900,
        textAlign: 'center',
        color: '#e2e8f0',
        marginBottom: '2rem',
        margin: '0 108px 2rem 0'
      }}>
        {user?.name}
      </h1>

      {/* Top 3 - Grid layout */}
      <div className="records-grid-top">
        {['bestDay', 'bestWeek', 'bestMonth'].map((key) => (
          <div key={key} className="record-plaque">
            <div className="plaque-icon">🏆</div>
            <div className="plaque-value">{records[key as keyof typeof records].value}</div>
            <div className="plaque-title">{records[key as keyof typeof records].title}</div>
            <div className="plaque-date">{records[key as keyof typeof records].date}</div>
            <svg className="plaque-wreath" viewBox="0 0 100 100">
              <path d="M50,10 Q60,20 65,35 Q70,50 65,65 Q60,80 50,90 Q40,80 35,65 Q30,50 35,35 Q40,20 50,10" 
                    fill="none" stroke="#d4af37" strokeWidth="2" opacity="0.6" />
            </svg>
          </div>
        ))}
      </div>

      {/* Bottom 2 - Centered layout */}
      <div className="records-grid-bottom">
        {['bestYear', 'allTime'].map((key) => (
          <div key={key} className="record-plaque">
            <div className="plaque-icon">🏆</div>
            <div className="plaque-value">{records[key as keyof typeof records].value}</div>
            <div className="plaque-title">{records[key as keyof typeof records].title}</div>
            <div className="plaque-date">{records[key as keyof typeof records].date}</div>
            <svg className="plaque-wreath" viewBox="0 0 100 100">
              <path d="M50,10 Q60,20 65,35 Q70,50 65,65 Q60,80 50,90 Q40,80 35,65 Q30,50 35,35 Q40,20 50,10" 
                    fill="none" stroke="#d4af37" strokeWidth="2" opacity="0.6" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
