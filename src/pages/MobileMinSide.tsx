import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileMinSide.css';

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
    .replace(/[\/\\]/g, '_')
    .toLowerCase()
    .trim();
};

export default function MobileMinSide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState({
    dagSalg: 0,
    dagMål: 0,
    ukeSalg: 0,
    ukeMål: 0,
    månedSalg: 0,
    månedMål: 0,
  });
  const [recordData, setRecordData] = useState({
    besteDag: 0,
    besteUke: 0,
    besteMåned: 0,
    besteÅr: 0,
    totalt: 0,
  });
  const [runrateData, setRunrateData] = useState({
    ukeRunrate: 0,
    månedRunrate: 0,
  });

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // 1. Load goals from Firestore
        let weeklyGoal = 0;
        let monthlyGoal = 0;
        let dailyGoal = 0;

        try {
          const normalizedId = normalize(user.externalName || user.id || '');
          const goalsRef = doc(db, 'employee_goals', normalizedId);
          const goalsDoc = await getDoc(goalsRef);
          if (goalsDoc.exists()) {
            const goals = goalsDoc.data();
            weeklyGoal = goals?.weeklyGoal || 0;
            monthlyGoal = goals?.monthlyGoal || 0;
            dailyGoal = goals?.dailyGoal || Math.round((weeklyGoal || 0) / 5);
          }
        } catch (err) {
          console.log('No goals found in Firestore');
        }

        // 2. Load contracts from allente_kontraktsarkiv
        const salesRef = collection(db, 'allente_kontraktsarkiv');
        const snapshot = await getDocs(salesRef);
        
        const contracts: SalesRecord[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          contracts.push({ id: doc.id, ...data });
        });

        // Filter for this employee by externalName
        const normalizedExternalName = normalize(user?.externalName || '');
        const employeeContracts = contracts.filter(c => {
          const selger = normalize(c.selger || '');
          return selger === normalizedExternalName || selger.startsWith(normalizedExternalName + ' /');
        });

        console.log('📱 Mobile Min Side loading for:', user?.name, 'Found contracts:', employeeContracts.length);

        // 3. Load emoji counts for today
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateKey = today.toISOString().split('T')[0];
        
        let emojiCountToday = 0;
        try {
          const emojiRef = doc(db, 'emoji_counts_daily', dateKey);
          const emojiDoc = await getDoc(emojiRef);
          if (emojiDoc.exists()) {
            const data = emojiDoc.data();
            const counts = data.counts || {};
            const userName = user?.name || '';
            const userEmojis = counts[userName] || { '🔔': 0, '💎': 0 };
            emojiCountToday = (userEmojis['🔔'] || 0) + (userEmojis['💎'] || 0);
            console.log('📱 Emoji count today:', emojiCountToday);
          }
        } catch (err) {
          console.log('No emoji counts found');
        }

        // 4. Calculate date ranges
        const daysToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysToMonday);
        
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        // 5. Count this week (contracts + emojis)
        const weekContracts = employeeContracts.filter(c => {
          const date = parseDate(c.dato || '');
          return date && date >= weekStart && date <= today;
        }).length;
        const salesThisWeek = weekContracts + emojiCountToday;

        // 6. Count this month (contracts + emojis)
        const monthContracts = employeeContracts.filter(c => {
          const date = parseDate(c.dato || '');
          return date && date >= monthStart && date <= today;
        }).length;
        const salesThisMonth = monthContracts + emojiCountToday;

        // 7. Calculate best day/week/month
        const dayMap: { [key: string]: number } = {};
        const weekMap: { [key: string]: number } = {};
        const monthMap: { [key: string]: number } = {};

        employeeContracts.forEach(c => {
          const date = parseDate(c.dato || '');
          if (date) {
            const dateStr = c.dato || '';
            dayMap[dateStr] = (dayMap[dateStr] || 0) + 1;

            const dayOfWeek = date.getDay();
            const mondayDate = new Date(date);
            mondayDate.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            const weekKey = mondayDate.toISOString().split('T')[0];
            weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;

            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
          }
        });

        const bestDay = Math.max(0, ...Object.values(dayMap));
        const besteUke = Math.max(0, ...Object.values(weekMap));
        const besteMåned = Math.max(0, ...Object.values(monthMap));
        const besteÅr = employeeContracts.filter(c => {
          const date = parseDate(c.dato || '');
          return date && date >= yearStart && date <= today;
        }).length;
        const total = employeeContracts.length;

        // 8. Calculate runrates
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
        const weekRunrate = Math.round((salesThisWeek / workingDaysWeek) * 5);

        const workingDaysMonth = countWorkingDaysThisMonth();
        const totalWorkingDaysInMonth = countWorkingDaysInMonth();
        const monthRunrate = workingDaysMonth > 0 ? Math.round((salesThisMonth / workingDaysMonth) * totalWorkingDaysInMonth) : 0;

        // 9. Update state
        setProgressData({
          dagSalg: emojiCountToday,
          dagMål: dailyGoal,
          ukeSalg: salesThisWeek,
          ukeMål: weeklyGoal,
          månedSalg: salesThisMonth,
          månedMål: monthlyGoal,
        });

        setRecordData({
          besteDag: bestDay,
          besteUke,
          besteMåned,
          besteÅr,
          totalt: total,
        });

        setRunrateData({
          ukeRunrate: weekRunrate,
          månedRunrate: monthRunrate,
        });

        // 10. Load badges
        try {
          const badgeRef = doc(db, 'user_earned_badges', normalize(user?.externalName || ''));
          const badgeDoc = await getDoc(badgeRef);
          if (badgeDoc.exists()) {
            const badgeData = badgeDoc.data();
            setEarnedBadges(badgeData.badges || []);
          }
        } catch (err) {
          console.log('No badges found');
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading mobile min side data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="mobile-min-side">
        <div className="mobile-header">
          <button className="back-button" onClick={() => navigate('/home')}>
            ← Tilbake
          </button>
          <h1>Min Side</h1>
          <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
          Laster...
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-min-side">
      <div className="mobile-header">
        <button className="back-button" onClick={() => navigate('/home')}>
          ← Tilbake
        </button>
        <h1>Min Side</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="mobile-min-side-content">
        {/* REKORDER - Circles */}
        <div className="rekorder-row">
          <div className="rekord-circle">
            <div className="circle-number">{recordData.besteDag}</div>
            <div className="circle-label">BESTE DAG</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{recordData.besteUke}</div>
            <div className="circle-label">BESTE UKE</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{recordData.besteMåned}</div>
            <div className="circle-label">BESTE MND</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{recordData.besteÅr}</div>
            <div className="circle-label">BESTE ÅR</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{recordData.totalt}</div>
            <div className="circle-label">TOTALT</div>
          </div>
        </div>

        {/* PROGRESS BARS - Sales vs Goals */}
        <div className="progress-section">
          <div className="progress-item">
            <label>DAG</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${Math.min(100, (progressData.dagSalg / Math.max(1, progressData.dagMål)) * 100)}%` }} />
            </div>
            <div className="progress-text">{progressData.dagSalg} of {progressData.dagMål}</div>
          </div>

          <div className="progress-item">
            <label>UKE</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${Math.min(100, (progressData.ukeSalg / Math.max(1, progressData.ukeMål)) * 100)}%` }} />
            </div>
            <div className="progress-text">{progressData.ukeSalg} of {progressData.ukeMål}</div>
          </div>

          <div className="progress-item">
            <label>MÅNED</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${Math.min(100, (progressData.månedSalg / Math.max(1, progressData.månedMål)) * 100)}%` }} />
            </div>
            <div className="progress-text">{progressData.månedSalg} of {progressData.månedMål}</div>
          </div>
        </div>

        {/* RUNRATE */}
        <div className="runrate-section">
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE UKE</div>
            <div className="runrate-value">{runrateData.ukeRunrate}</div>
          </div>
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE MÅNED</div>
            <div className="runrate-value">{runrateData.månedRunrate}</div>
          </div>
        </div>

        {/* BADGES */}
        {earnedBadges.length > 0 && (
          <div className="badges-section">
            <h3>BADGES</h3>
            <div className="badges-grid">
              {earnedBadges.map((badge, idx) => (
                <div key={idx} className="badge-item">
                  {badge}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
