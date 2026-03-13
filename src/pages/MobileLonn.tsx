import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileLonn.css';

interface SalesRecord {
  dato?: string;
  selger?: string;
  id?: string;
  produkt?: string;
  [key: string]: any;
}

const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  const trimmed = dateStr.trim();
  
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const ddmmyyyy2Match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy2Match) {
    const [, day, month, year] = ddmmyyyy2Match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return new Date(dateStr);
};

const normalize = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export default function MobileLonn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState({
    dag: 0,
    uke: 0,
    måned: 0,
    dagTo16: 0,
    dagTo21: 0,
    ukeRunrate: 0,
    månedRunrate: 0,
  });

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Hardcoded product provisjon values (same as PC)
        const produktProvisjon: { [key: string]: number } = {
          'Flex 2 with ads - 50,- rabatt i 6 mneder (6)': 600,
          'Flex 2 with ads - 50% discount 6 months (6)': 600,
          'Flex 2 without ads - 50,- rabatt i 6 mneder (6)': 600,
          'Flex 2 without ads - 50% discount 6 months (6)': 600,
          'Flex Basic - 50,- rabatt i 6 mneder (6)': 500,
          'Flex Basic - 150 nok discount 6 months (6)': 500,
          'Basic - 4 frimmneder (12)': 500,
          'Basic - 1 frimåned (12)': 500,
          'Basic - 50% rabatt i 6 mäneder (12)': 500,
          'Basic - 50% discount 6 months (12)': 500,
          'Standard - 50% rabatt i 6 mneder (12)': 800,
          'Standard - 50% rabatt i 6 mäneder (12)': 800,
          'Standard - 50% discount 6 months (12)': 800,
          'Standard - 1 frimned (12)': 800,
          'Standard - 1 frimåned (12)': 800,
          'Standard - 2 frimmneder (12)': 800,
          'Standard - 2 frimåneder (12)': 800,
          'Standard - 4 frimmneder (12)': 800,
          'Standard - 4 frimåneder (12)': 800,
          'Large - 100% Discount 1 month + 200 nok discount 11 months (12)': 1000,
          'Large - 100% discount 1 month then 290,- discount 11 months (12)': 1000
        };

        // Load contracts
        const salesRef = collection(db, 'allente_kontraktsarkiv');
        const snapshot = await getDocs(salesRef);
        
        const contracts: SalesRecord[] = [];
        snapshot.forEach((doc) => {
          contracts.push({ id: doc.id, ...doc.data() });
        });

        // Filter for this employee
        const normalizedExternalName = normalize(user?.externalName || '');
        const employeeContracts = contracts.filter(c => {
          const selger = normalize(c.selger || '');
          return selger === normalizedExternalName || selger.startsWith(normalizedExternalName + ' /');
        });

        // Load emoji earnings for today
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateKey = today.toISOString().split('T')[0];
        
        let bellCountToday = 0, gemCountToday = 0, giftCountToday = 0;
        try {
          const emojiRef = doc(db, 'emoji_counts_daily', dateKey);
          const emojiDoc = await getDoc(emojiRef);
          if (emojiDoc.exists()) {
            const data = emojiDoc.data();
            const counts = data.counts || {};
            const userName = user?.name || '';
            const userEmojis = counts[userName] || { '🔔': 0, '💎': 0, '🎁': 0 };
            bellCountToday = userEmojis['🔔'] || 0;
            gemCountToday = userEmojis['💎'] || 0;
            giftCountToday = userEmojis['🎁'] || 0;
          }
        } catch (err) {
          console.log('No emoji counts found');
        }

        const emojiEarningsToday = (bellCountToday * 800) + (gemCountToday * 1000) - (giftCountToday * 200);

        // Calculate date ranges
        const daysToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysToMonday);
        
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Function to get product earnings
        const getProductEarnings = (produktName: string): number => {
          let provisjon = produktProvisjon[produktName] || 0;
          
          if (provisjon === 0) {
            const productBase = produktName.split(' - ')[0].trim();
            for (const key in produktProvisjon) {
              const adminBase = key.split(' - ')[0].trim();
              if (adminBase === productBase) {
                provisjon = produktProvisjon[key];
                break;
              }
            }
          }
          return provisjon;
        };

        // Calculate earnings by period
        const contractsWeek = employeeContracts.filter(c => {
          const date = parseDate(c.dato || '');
          return date && date >= weekStart && date <= today;
        });
        const weekEarnings = contractsWeek.reduce((sum, c) => {
          const produktName = (c.produkt || '').replace(/\\/g, '').trim();
          return sum + getProductEarnings(produktName);
        }, 0) + emojiEarningsToday;

        const contractsMonth = employeeContracts.filter(c => {
          const date = parseDate(c.dato || '');
          return date && date >= monthStart && date <= today;
        });
        const monthEarnings = contractsMonth.reduce((sum, c) => {
          const produktName = (c.produkt || '').replace(/\\/g, '').trim();
          return sum + getProductEarnings(produktName);
        }, 0) + emojiEarningsToday;

        // Calculate runrates
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
        const hoursWorked = Math.max(0, (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60));
        
        const dagTo16 = hoursWorked > 0 ? (emojiEarningsToday / hoursWorked) * 6 : 0;
        const dagTo21 = hoursWorked > 0 ? (emojiEarningsToday / hoursWorked) * 10 : 0;

        // Working days calculations
        const countWorkingDaysThisWeek = () => {
          let count = 0;
          for (let d = new Date(weekStart); d < today; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++;
          }
          return count;
        };

        const countWorkingDaysThisMonth = () => {
          let count = 0;
          for (let d = new Date(monthStart); d < today; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++;
          }
          return count;
        };

        const countWorkingDaysInMonth = () => {
          const year = now.getFullYear();
          const month = now.getMonth();
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          
          let count = 0;
          for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++;
          }
          return count;
        };

        const workingDaysWeek = Math.max(1, countWorkingDaysThisWeek());
        const weekRunrate = (weekEarnings / workingDaysWeek) * 5;

        const workingDaysMonth = countWorkingDaysThisMonth();
        const totalWorkingDaysInMonth = countWorkingDaysInMonth();
        const monthRunrate = workingDaysMonth > 0 ? (monthEarnings / workingDaysMonth) * totalWorkingDaysInMonth : 0;

        setEarnings({
          dag: Math.round(emojiEarningsToday),
          uke: Math.round(weekEarnings),
          måned: Math.round(monthEarnings),
          dagTo16: Math.round(dagTo16 * 100) / 100,
          dagTo21: Math.round(dagTo21 * 100) / 100,
          ukeRunrate: Math.round(weekRunrate),
          månedRunrate: Math.round(monthRunrate),
        });

        setLoading(false);
      } catch (error) {
        console.error('Error loading lønn data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="mobile-lonn">
        <div className="mobile-header">
          <button className="back-button" onClick={() => navigate('/home')}>
            ← Tilbake
          </button>
          <h1>Lønn</h1>
          <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
          Laster...
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-lonn">
      <div className="mobile-header">
        <button className="back-button" onClick={() => navigate('/home')}>
          ← Tilbake
        </button>
        <h1>Lønn</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="mobile-lonn-content">
        {/* EARNINGS PERIODS */}
        <div className="earnings-periods">
          <div className="earnings-card">
            <div className="earnings-label">DAG</div>
            <div className="earnings-value">{earnings.dag.toLocaleString('nb-NO')}</div>
            <div className="earnings-unit">kr</div>
          </div>

          <div className="earnings-card">
            <div className="earnings-label">UKE</div>
            <div className="earnings-value">{earnings.uke.toLocaleString('nb-NO')}</div>
            <div className="earnings-unit">kr</div>
          </div>

          <div className="earnings-card">
            <div className="earnings-label">MÅNED</div>
            <div className="earnings-value">{earnings.måned.toLocaleString('nb-NO')}</div>
            <div className="earnings-unit">kr</div>
          </div>
        </div>

        {/* DAILY RUNRATE */}
        <div className="runrate-section">
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE DAG</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-time">→ 16:00</span>
                <span className="runrate-value">{earnings.dagTo16.toLocaleString('nb-NO')}</span>
                <span className="runrate-unit">kr/dag</span>
              </div>
              <div className="runrate-divider">|</div>
              <div className="runrate-metric">
                <span className="runrate-time">→ 21:00</span>
                <span className="runrate-value">{earnings.dagTo21.toLocaleString('nb-NO')}</span>
                <span className="runrate-unit">kr/dag</span>
              </div>
            </div>
          </div>
        </div>

        {/* WEEKLY & MONTHLY RUNRATE */}
        <div className="runrate-section">
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE UKE</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-value">{earnings.ukeRunrate.toLocaleString('nb-NO')}</span>
                <span className="runrate-unit">kr/uke</span>
              </div>
            </div>
          </div>

          <div className="runrate-box">
            <div className="runrate-label">RUNRATE MÅNED</div>
            <div className="runrate-metrics">
              <div className="runrate-metric">
                <span className="runrate-value">{earnings.månedRunrate.toLocaleString('nb-NO')}</span>
                <span className="runrate-unit">kr/måned</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
