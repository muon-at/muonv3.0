import { useState } from 'react';
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
  const [earnings] = useState<EarningsData>({
    day: 4000,
    week: 18500,
    month: 72000,
  });
  const [runRates] = useState<EarningsRunRate>({
    day: 8000,
    week: 37000,
    month: 900000,
  });
  const [payments] = useState<PaymentHistory[]>([
    { date: '2026-03-17', amount: 25000, type: 'Salg' },
    { date: '2026-03-10', amount: 28500, type: 'Salg' },
    { date: '2026-03-03', amount: 22000, type: 'Salg' },
  ]);

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
            {payments.map((payment, idx) => (
              <div key={idx} className="payment-item">
                <div className="payment-info">
                  <div className="payment-date">{payment.date}</div>
                  <div className="payment-type">{payment.type}</div>
                </div>
                <div className="payment-amount">{payment.amount} kr</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
