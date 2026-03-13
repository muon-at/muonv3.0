import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileMinSide.css';

export default function MobileMinSide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Load earnings
        const earningsRef = collection(db, 'employee_earnings');
        const q = query(earningsRef, where('employeeId', '==', user.id));
        const snapshot = await getDocs(q);
        
        if (snapshot.size > 0) {
          setEarnings(snapshot.docs[0].data());
        }

        // Load badges
        const badgesRef = collection(db, 'user_earned_badges');
        const badgesQ = query(badgesRef, where('userId', '==', user.id));
        const badgesSnapshot = await getDocs(badgesQ);
        const badgesList: any[] = [];
        badgesSnapshot.forEach(doc => {
          badgesList.push(doc.data());
        });
        setBadges(badgesList);

        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
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

  // Calculate daily/weekly/monthly/yearly earnings
  const today = new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const dagEarnings = earnings?.status || 0;
  const ukeEarnings = earnings?.weeklyStatus || 0;
  const måned = earnings?.monthlyStatus || 0;
  const år = earnings?.yearlyStatus || 0;
  const totalt = earnings?.totalEarnings || 0;

  // Progress bars (0-100%)
  const weeklyGoal = earnings?.weeklyGoal || 10000;
  const monthlyGoal = earnings?.monthlyGoal || 40000;
  const dagGoal = weeklyGoal / 5;

  const dagProgress = Math.min(100, (dagEarnings / dagGoal) * 100);
  const ukeProgress = Math.min(100, (ukeEarnings / weeklyGoal) * 100);
  const månedProgress = Math.min(100, (måned / monthlyGoal) * 100);

  // Runrate (UKE | MÅNED)
  const ukeRunrate = earnings?.weekRunrate || 0;
  const månedRunrate = earnings?.monthRunrate || 0;

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
        {/* REKORDER - Same line (DAG | UKE | MÅNED | ÅR | TOTALT) */}
        <div className="rekorder-row">
          <div className="rekord-item">
            <div className="rekord-label">DAG</div>
            <div className="rekord-value">{dagEarnings.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' }).replace(' kr', '')}</div>
          </div>
          <div className="rekord-item">
            <div className="rekord-label">UKE</div>
            <div className="rekord-value">{ukeEarnings.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' }).replace(' kr', '')}</div>
          </div>
          <div className="rekord-item">
            <div className="rekord-label">MÅNED</div>
            <div className="rekord-value">{måned.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' }).replace(' kr', '')}</div>
          </div>
          <div className="rekord-item">
            <div className="rekord-label">ÅR</div>
            <div className="rekord-value">{år.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' }).replace(' kr', '')}</div>
          </div>
          <div className="rekord-item">
            <div className="rekord-label">TOTALT</div>
            <div className="rekord-value">{totalt.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' }).replace(' kr', '')}</div>
          </div>
        </div>

        {/* PROGRESS BARS */}
        <div className="progress-section">
          <div className="progress-item">
            <label>DAG</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${dagProgress}%` }} />
            </div>
            <div className="progress-text">{dagProgress.toFixed(0)}%</div>
          </div>

          <div className="progress-item">
            <label>UKE</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${ukeProgress}%` }} />
            </div>
            <div className="progress-text">{ukeProgress.toFixed(0)}%</div>
          </div>

          <div className="progress-item">
            <label>MÅNED</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${månedProgress}%` }} />
            </div>
            <div className="progress-text">{månedProgress.toFixed(0)}%</div>
          </div>
        </div>

        {/* RUNRATE */}
        <div className="runrate-section">
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE UKE</div>
            <div className="runrate-value">{ukeRunrate.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' }).replace(' kr', '')}</div>
          </div>
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE MÅNED</div>
            <div className="runrate-value">{månedRunrate.toLocaleString('nb-NO', { style: 'currency', currency: 'NOK' }).replace(' kr', '')}</div>
          </div>
        </div>

        {/* BADGES */}
        {badges.length > 0 && (
          <div className="badges-section">
            <h3>BADGES</h3>
            <div className="badges-grid">
              {badges.map((badge, idx) => (
                <div key={idx} className="badge-item" title={badge.name}>
                  {badge.emoji || '🏅'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
