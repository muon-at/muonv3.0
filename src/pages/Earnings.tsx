import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/authContext';
import '../styles/Earnings.css';

interface EarningsData {
  day: number;
  week: number;
  month: number;
}

interface EarningsRunRate {
  day: number;
  week: number;
  month: number;
}

export default function Earnings() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsData>({
    day: 0,
    week: 0,
    month: 0,
  });
  const [runRates, setRunRates] = useState<EarningsRunRate>({
    day: 0,
    week: 0,
    month: 0,
  });
  const [prevMonth, setPrevMonth] = useState<number>(0);

  // Get working days in month (for runrate calculation)
  const getWorkingDaysInMonth = (date: Date): number => {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const norwegianHolidays2026 = ['2026-01-01', '2026-04-09', '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-17', '2026-05-21', '2026-05-31', '2026-06-01', '2026-12-25', '2026-12-26'];
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const checkDate = new Date(date.getFullYear(), date.getMonth(), d);
      const dayOfWeek = checkDate.getDay();
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !norwegianHolidays2026.includes(dateStr)) {
        workingDays++;
      }
    }
    return workingDays;
  };

  // Same dual-listener pattern as Status.tsx
  useEffect(() => {
    if (!user || !user.name) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Previous month
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Listen to livefeed (TODAY data)
    const livefeedRef = collection(db, 'livefeed_sales');
    const unsubscribeLivefeed = onSnapshot(livefeedRef, (livefeedSnapshot) => {
      // Listen to contracts (WEEK/MONTH/PREV MONTH data)
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const unsubscribeArchive = onSnapshot(contractsRef, (archiveSnapshot) => {
        try {
          let dayCount = 0;
          let weekCount = 0;
          let monthCount = 0;
          let prevMonthCount = 0;

          // COUNT TODAY from livefeed (each sale = 1 count)
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userName === user.name && data.product) {
              dayCount++;
            }
          });

          // COUNT WEEK/MONTH/PREV from contracts
          archiveSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const selger = (data.selger || '').toLowerCase().trim();
            const userName = user.name.toLowerCase().trim();
            
            if (selger !== userName) return;

            const dato = data.dato || '';
            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);

                // Count for WEEK
                if (orderDate >= startOfWeek && orderDate <= today) {
                  weekCount++;
                }

                // Count for MONTH
                if (orderDate >= startOfMonth && orderDate <= today) {
                  monthCount++;
                }

                // Count for PREVIOUS MONTH
                if (orderDate >= startOfPrevMonth && orderDate <= endOfPrevMonth) {
                  prevMonthCount++;
                }
              }
            }
          });

          // Calculate revenue (1000kr per sale, matching Progresjon logic)
          const dayRevenue = dayCount * 1000;
          const weekRevenue = (weekCount + dayCount) * 1000; // Include today
          const monthRevenue = (monthCount + dayCount) * 1000; // Include today
          const prevMonthRevenue = prevMonthCount * 1000;

          // Calculate runrates
          const now = new Date();
          const currentHour = now.getHours() + (now.getMinutes() / 60);
          const dayRunRate = currentHour > 0 ? Math.round((dayRevenue / currentHour) * 6) : 0;

          const dayOfWeek = today.getDay();
          const daysCompleted = dayOfWeek === 0 ? 0 : dayOfWeek;
          const weekRunRate = daysCompleted > 0 ? Math.round((weekRevenue / daysCompleted) * 5) : 0;

          const norwegianHolidays2026 = ['2026-01-01', '2026-04-09', '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-17', '2026-05-21', '2026-05-31', '2026-06-01', '2026-12-25', '2026-12-26'];
          let daysCompletedMonth = 0;
          for (let d = 1; d <= today.getDate(); d++) {
            const checkDate = new Date(today.getFullYear(), today.getMonth(), d);
            const dayOfWeekCheck = checkDate.getDay();
            const dateStr = checkDate.toISOString().split('T')[0];
            if (dayOfWeekCheck >= 1 && dayOfWeekCheck <= 5 && !norwegianHolidays2026.includes(dateStr)) {
              daysCompletedMonth++;
            }
          }
          
          const workingDaysMonth = getWorkingDaysInMonth(today);
          const monthRunRate = daysCompletedMonth > 0 ? Math.round((monthRevenue / daysCompletedMonth) * workingDaysMonth) : 0;

          setEarnings({
            day: dayRevenue,
            week: weekRevenue,
            month: monthRevenue,
          });

          setRunRates({
            day: dayRunRate,
            week: weekRunRate,
            month: monthRunRate,
          });

          setPrevMonth(prevMonthRevenue);

          console.log('💰 Earnings (counts):', { dayCount, weekCount: weekCount + dayCount, monthCount: monthCount + dayCount, prevMonthCount });
          console.log('💰 Earnings (revenue):', { dayRevenue, weekRevenue, monthRevenue, prevMonthRevenue });
        } catch (err) {
          console.error('❌ Error calculating earnings:', err);
        }
      });

      return () => unsubscribeArchive();
    });

    return () => unsubscribeLivefeed();
  }, [user?.id, user?.name]);

  if (!user) return <div className="earnings-container">Laster...</div>;

  return (
    <div className="earnings-container">
      <div className="earnings-content">
        <h1 className="user-header">{user?.name}</h1>

        {/* Earnings Cards - 3 side by side */}
        <div className="earnings-grid">
          {/* Day */}
          <div className="earnings-card">
            <h3>I DAG</h3>
            <p className="earnings-amount">{earnings.day.toLocaleString('no-NO')} kr</p>
            <p className="runrate">Runrate: {runRates.day.toLocaleString('no-NO')} kr</p>
          </div>

          {/* Week */}
          <div className="earnings-card">
            <h3>DENNE UKEN</h3>
            <p className="earnings-amount">{earnings.week.toLocaleString('no-NO')} kr</p>
            <p className="runrate">Runrate: {runRates.week.toLocaleString('no-NO')} kr</p>
          </div>

          {/* Month */}
          <div className="earnings-card">
            <h3>DENNE MÅNEDEN</h3>
            <p className="earnings-amount">{earnings.month.toLocaleString('no-NO')} kr</p>
            <p className="runrate">Runrate: {runRates.month.toLocaleString('no-NO')} kr</p>
          </div>
        </div>

        {/* Previous Month */}
        <div className="payment-history">
          <h2>Forrige måned</h2>
          <div className="payment-item">
            <span className="payment-date">Forrige måned total</span>
            <span className="payment-type">Kontrakter</span>
            <span className="payment-amount">{prevMonth.toLocaleString('no-NO')} kr</span>
          </div>
        </div>
      </div>
    </div>
  );
}
