import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileMinSide.css';

export default function MobileMinSide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Load employee data
        const employeesRef = collection(db, 'employees');
        const q = query(employeesRef, where('userId', '==', user.id));
        const snapshot = await getDocs(q);
        
        let empData: any = {};
        if (snapshot.size > 0) {
          empData = snapshot.docs[0].data();
        }

        // Load goals from Firestore (employee_goals collection)
        try {
          const goalsRef = doc(db, 'employee_goals', user.id);
          const goalsDoc = await getDoc(goalsRef);
          if (goalsDoc.exists()) {
            const goals = goalsDoc.data();
            empData = { ...empData, ...goals };
          }
        } catch (err) {
          console.log('No goals found in Firestore');
        }

        setData(empData);

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

  // Record circles (best of each period - NO kr)
  const besteDag = data?.besteDag || 0;
  const besteUke = data?.besteUke || 0;
  const besteMåned = data?.besteMåned || 0;
  const besteÅr = data?.besteÅr || 0;
  const totaltEarnings = data?.totalEarnings || 0;

  // Progress: Sales vs Goals (synced from PC via Firestore)
  const weeklyGoal = data?.weeklyGoal || 1;
  const monthlyGoal = data?.monthlyGoal || 1;
  const dagGoal = data?.dailyGoal || Math.round((weeklyGoal || 1) / 5);

  const dagSalg = Math.round(data?.status || 0);
  const ukeSalg = Math.round(data?.weeklyStatus || 0);
  const månedSalg = Math.round(data?.monthlyStatus || 0);

  const dagProgress = (dagSalg / dagGoal) * 100;
  const ukeProgress = (ukeSalg / weeklyGoal) * 100;
  const månedProgress = (månedSalg / monthlyGoal) * 100;

  // Runrate (same as desktop - NO kr)
  const ukeRunrate = data?.weekRunrate || 0;
  const månedRunrate = data?.monthRunrate || 0;

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
        {/* REKORDER - Circles (BESTE DAG | UKE | MÅNED | ÅR | TOTALT) - NO kr */}
        <div className="rekorder-row">
          <div className="rekord-circle">
            <div className="circle-number">{besteDag}</div>
            <div className="circle-label">BESTE DAG</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{besteUke}</div>
            <div className="circle-label">BESTE UKE</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{besteMåned}</div>
            <div className="circle-label">BESTE MND</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{besteÅr}</div>
            <div className="circle-label">BESTE ÅR</div>
          </div>
          <div className="rekord-circle">
            <div className="circle-number">{totaltEarnings}</div>
            <div className="circle-label">TOTALT</div>
          </div>
        </div>

        {/* PROGRESS BARS - Sales vs Goals (synced from PC) */}
        <div className="progress-section">
          <div className="progress-item">
            <label>DAG</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${Math.min(100, dagProgress)}%` }} />
            </div>
            <div className="progress-text">{dagSalg} of {Math.round(dagGoal)}</div>
          </div>

          <div className="progress-item">
            <label>UKE</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${Math.min(100, ukeProgress)}%` }} />
            </div>
            <div className="progress-text">{ukeSalg} of {Math.round(weeklyGoal)}</div>
          </div>

          <div className="progress-item">
            <label>MÅNED</label>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${Math.min(100, månedProgress)}%` }} />
            </div>
            <div className="progress-text">{månedSalg} of {Math.round(monthlyGoal)}</div>
          </div>
        </div>

        {/* RUNRATE - NO kr */}
        <div className="runrate-section">
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE UKE</div>
            <div className="runrate-value">{ukeRunrate}</div>
          </div>
          <div className="runrate-box">
            <div className="runrate-label">RUNRATE MÅNED</div>
            <div className="runrate-value">{månedRunrate}</div>
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
