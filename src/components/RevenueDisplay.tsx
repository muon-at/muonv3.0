import React, { useEffect, useState } from 'react';
import '../styles/RevenueDisplay.css';

interface RevenueDisplayProps {
  amount: number | null;
}

export const RevenueDisplay: React.FC<RevenueDisplayProps> = ({ amount }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (amount !== null && amount > 0) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [amount]);

  if (!show || amount === null) return null;

  return (
    <div className="revenue-display-container">
      <div className="revenue-display">
        🔔 +{amount} kr
      </div>
    </div>
  );
};

export default RevenueDisplay;
