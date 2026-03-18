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

  // Load LIVE data from allente_kontraktsarkiv - Real-time listener
  useEffect(() => {
    if (!user || !user.name) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const endOfDay = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Real-time listener
    const contractsRef = collection(db, 'allente_kontraktsarkiv');
    const unsubscribe = onSnapshot(contractsRef, (snapshot) => {
      try {
        
        let dayRevenue = 0;
        let weekRevenue = 0;
        let monthRevenue = 0;
        let dayCount = 0;
        let weekCount = 0;
        let monthCount = 0;
        
        const paymentsList: PaymentHistory[] = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const selger = data.selger || '';
          const dato = data.dato || '';
          const produkt = (data.produkt || '').toLowerCase();

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

              // Price calculation
              const price = produkt.includes('free') ? 800 : 1000;

              // TODAY counts
              if (orderDate >= today && orderDate < endOfDay) {
                dayRevenue += price;
                dayCount++;
              }

              // WEEK counts
              if (orderDate >= startOfWeek && orderDate <= today) {
                weekRevenue += price;
                weekCount++;
              }

              // MONTH counts
              if (orderDate >= startOfMonth && orderDate <= today) {
                monthRevenue += price;
                monthCount++;
              }

              // Collect for payment history (all dates)
              paymentsList.push({
                date: orderDate.toLocaleDateString('no-NO'),
                amount: price,
                type: 'Salg',
              });
            }
          }
        });

        // Sort payments by date (newest first) and take first 3
        const sortedPayments = paymentsList
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3);

        setEarnings({
          day: dayRevenue,
          week: weekRevenue,
          month: monthRevenue,
        });

        // Calculate runrates
        const now = new Date();
        const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
        const dayRunRate = hoursElapsed > 0 ? Math.round((dayRevenue / hoursElapsed) * 8) : 0;

        const weekRunRate = weekRevenue > 0 ? Math.round((weekRevenue / 7) * 7) : 0;

        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const monthRunRate = monthRevenue > 0 ? Math.round((monthRevenue / today.getDate()) * daysInMonth) : 0;

        setRunRates({
          day: dayRunRate,
          week: weekRunRate,
          month: monthRunRate,
        });

        setPayments(sortedPayments);

        console.log('✅ LIVE EARNINGS UPDATED:', { dayRevenue, weekRevenue, monthRevenue, payments: sortedPayments.length });
      } catch (err) {
        console.error('❌ Error loading earnings:', err);
      }
    });

    // Cleanup: unsubscribe when component unmounts or user changes
    return () => unsubscribe();
  }, [user?.id, user?.name]);

  if (!user) return <div className="earnings-container">Laster...</div>;

  return (
    <div className="earnings-container">
      <div className="earnings-content">
        <h1 className="user-header">{user?.name}</h1>

        {/* Earnings Summary */}
        <div className="earnings-summary">
          <div className="earnings-item">
            <div className="earnings-label">I dag</div>
            <div className="earnings-amount">{earnings.day} kr</div>
            <div className="earnings-runrate">Runrate: {runRates.day} kr</div>
          </div>

          <div className="earnings-item">
            <div className="earnings-label">Denne uken</div>
            <div className="earnings-amount">{earnings.week} kr</div>
            <div className="earnings-runrate">Runrate: {runRates.week} kr</div>
          </div>

          <div className="earnings-item">
            <div className="earnings-label">Denne måneden</div>
            <div className="earnings-amount">{earnings.month} kr</div>
            <div className="earnings-runrate">Runrate: {runRates.month} kr</div>
          </div>
        </div>

        {/* Payment History */}
        <div className="payment-history">
          <h2>Siste 3 lønninger</h2>
          <div className="payment-list">
            {payments.length > 0 ? (
              payments.map((payment, idx) => (
                <div key={idx} className="payment-item">
                  <div className="payment-info">
                    <div className="payment-date">{payment.date}</div>
                    <div className="payment-type">{payment.type}</div>
                  </div>
                  <div className="payment-amount">{payment.amount} kr</div>
                </div>
              ))
            ) : (
              <div className="payment-item">Ingen betalinger ennå</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
