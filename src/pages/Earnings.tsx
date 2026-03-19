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

interface PaymentHistory {
  date: string;
  amount: number;
  type: string;
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
  const [payments, setPayments] = useState<PaymentHistory[]>([]);

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

  // Load data from both livefeed (today) and contracts (week/month)
  useEffect(() => {
    if (!user || !user.name) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Listener 1: livefeed_sales (TODAY data with product types)
    const livefeedRef = collection(db, 'livefeed_sales');
    const unsubscribeLivefeed = onSnapshot(livefeedRef, (livefeedSnapshot) => {
      // Listener 2: contracts (WEEK/MONTH with provisjoner)
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const unsubscribeArchive = onSnapshot(contractsRef, (archiveSnapshot) => {
        try {
          let dayRevenue = 0;
          let weekRevenue = 0;
          let monthRevenue = 0;
          let dayCount = 0;
          let weekCount = 0;
          let monthCount = 0;
          
          const paymentsList: PaymentHistory[] = [];

          // Process TODAY from livefeed (fixed rates: BTV=1000, DTH=1000, Free=800)
          livefeedSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const userName = data.userName || '';
            const product = (data.product || '').toLowerCase();
            
            if (userName !== user.name) return;
            
            let productRevenue = 0;
            if (product.includes('btv')) {
              productRevenue = 1000;
            } else if (product.includes('dth')) {
              productRevenue = 1000;
            } else if (product.includes('free')) {
              productRevenue = 800;
            } else {
              productRevenue = 1000; // Default
            }
            
            dayRevenue += productRevenue;
            dayCount++;
          });

          // Process WEEK/MONTH from contracts (with product provisjoner)
          const paymentMap: { [date: string]: number } = {};
          
          archiveSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const selger = data.selger || '';
            const dato = data.dato || '';
            const produkt = data.produkt || '';

            // Filter by seller name
            if (selger !== user.name) return;

            // Parse date: "12/3/2026" → [12, 3, 2026]
            if (dato && typeof dato === 'string') {
              const parts = dato.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);

                // Product provisjon (default 1000 if not specified)
                const provisjon = 1000; // Could parse from produkt field if needed
                const revenue = provisjon;

                // WEEK counts (including today's contracts)
                if (orderDate >= startOfWeek && orderDate <= today) {
                  weekRevenue += revenue;
                  weekCount++;
                  
                  if (orderDate.getTime() === today.getTime()) {
                    paymentMap[dato] = (paymentMap[dato] || 0) + revenue;
                  }
                }

                // MONTH counts (including today's contracts)
                if (orderDate >= startOfMonth && orderDate <= today) {
                  monthRevenue += revenue;
                  monthCount++;
                }

                // Payment history
                paymentsList.push({
                  date: dato,
                  amount: revenue,
                  type: produkt,
                });
              }
            }
          });

          // Add TODAY revenue to WEEK and MONTH totals
          weekRevenue += dayRevenue;
          monthRevenue += dayRevenue;

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

          // Sort and display last 3 payments
          paymentsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

          setPayments(paymentsList.slice(0, 3));

          console.log('💰 Earnings updated:', { dayRevenue, weekRevenue, monthRevenue });
        } catch (err) {
          console.error('❌ Error calculating earnings:', err);
        }
      });

      // Cleanup
      return () => {
        unsubscribeLivefeed();
        unsubscribeArchive();
      };
    });

    return () => unsubscribeLivefeed();
  }, [user?.id, user?.name]);

  if (!user) return <div className="earnings-container">Laster...</div>;

  return (
    <div className="earnings-container">
      <div className="earnings-content">
        <h1 className="user-header">{user?.name}</h1>

        {/* Earnings Cards */}
        <div className="earnings-section">
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

        {/* Payment History */}
        <div className="payment-history">
          <h2>Siste 3 lønniner</h2>
          {payments.map((payment, idx) => (
            <div key={idx} className="payment-item">
              <span className="payment-date">{payment.date}</span>
              <span className="payment-type">Salg</span>
              <span className="payment-amount">{payment.amount.toLocaleString('no-NO')} kr</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
