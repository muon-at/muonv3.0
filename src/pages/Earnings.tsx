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

interface MasterEarning {
  ansatt: string;
  produkt: string;
  dato: string; // DD/MM/YYYY
  provisjon: number;
  lønn: number | null;
  type: string; // 'contract' | 'post'
  createdAt: string;
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

  // Parse DD/MM/YYYY to Date
  const parseNorwegianDate = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };

  // Listen to master_earnings collection
  useEffect(() => {
    if (!user || !user.name) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    endOfPrevMonth.setHours(23, 59, 59, 999);

    const earningsRef = collection(db, 'master_earnings');
    const unsubscribe = onSnapshot(earningsRef, (snapshot) => {
      try {
        let dayRevenue = 0;
        let weekRevenue = 0;
        let monthRevenue = 0;
        let prevMonthRevenue = 0;

        const userName = user.name.toLowerCase().trim();

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as MasterEarning;
          const ansatt = (data.ansatt || '').toLowerCase().trim();

          // Filter by employee name
          if (ansatt !== userName) return;

          const provisjon = data.provisjon || 0;
          const orderDate = parseNorwegianDate(data.dato);

          // TODAY
          if (orderDate.getTime() === today.getTime()) {
            dayRevenue += provisjon;
          }

          // WEEK (from Monday of this week to today)
          if (orderDate >= startOfWeek && orderDate <= today) {
            weekRevenue += provisjon;
          }

          // MONTH (from 1st of month to today)
          if (orderDate >= startOfMonth && orderDate <= today) {
            monthRevenue += provisjon;
          }

          // PREVIOUS MONTH
          if (orderDate >= startOfPrevMonth && orderDate <= endOfPrevMonth) {
            prevMonthRevenue += provisjon;
          }
        });

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

        console.log('💰 Earnings (from master_earnings):', { dayRevenue, weekRevenue, monthRevenue, prevMonthRevenue });
      } catch (err) {
        console.error('❌ Error calculating earnings:', err);
      }
    });

    return () => unsubscribe();
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
            <span className="payment-date">Total</span>
            <span className="payment-type">Kontrakter</span>
            <span className="payment-amount">{prevMonth.toLocaleString('no-NO')} kr</span>
          </div>
        </div>
      </div>
    </div>
  );
}
