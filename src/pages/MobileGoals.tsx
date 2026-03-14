import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileGoals.css';

interface BadgeDefinition {
  emoji: string;
  navn: string;
  verdi: string;
  beskrivelse: string;
}

const badgeDefinitions: BadgeDefinition[] = [
  { emoji: '🏆', navn: 'BEST', verdi: 'Løpende', beskrivelse: 'Den som har flest salg totalt (kun en)' },
  { emoji: '👑', navn: 'MVP MÅNED', verdi: 'Historisk', beskrivelse: 'Har vært best i minst en måned' },
  { emoji: '⭐', navn: 'MVP DAG', verdi: 'Historisk', beskrivelse: 'Har vært best på minst en dag' },
  { emoji: '🎓', navn: 'FØRSTE SALGET', verdi: '1+', beskrivelse: '1+ salg totalt' },
  { emoji: '🚀', navn: '5 SALG', verdi: '5+', beskrivelse: '5+ salg på EN dag' },
  { emoji: '🎯', navn: '10 SALG', verdi: '10+', beskrivelse: '10+ salg på EN dag' },
  { emoji: '🔥', navn: '15 SALG', verdi: '15+', beskrivelse: '15+ salg på EN dag' },
  { emoji: '💎', navn: '20 SALG', verdi: '20+', beskrivelse: '20+ salg på EN dag' },
];

const normalize = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\]/g, '_')
    .toLowerCase()
    .trim();
};

export default function MobileGoals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [weeklyGoal, setWeeklyGoal] = useState<number | ''>('');
  const [monthlyGoal, setMonthlyGoal] = useState<number | ''>('');
  const [badgeStatus, setBadgeStatus] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const normalizedId = normalize(user.externalName || user.id || '');
        
        // Load goals (one-time)
        const goalsRef = doc(db, 'employee_goals', normalizedId);
        const goalsDoc = await getDoc(goalsRef);
        if (goalsDoc.exists()) {
          const data = goalsDoc.data();
          setWeeklyGoal(data?.weeklyGoal || '');
          setMonthlyGoal(data?.monthlyGoal || '');
        }

        // Real-time badge listener (updates live)
        const badgesRef = doc(db, 'employee_badges', normalizedId);
        const unsubscribe = onSnapshot(badgesRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setBadgeStatus(data?.badges || {});
            console.log('✅ Badges updated (real-time):', data?.badges);
          }
        });

        setLoading(false);
        
        // Cleanup listener on unmount
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const dailyGoal = Math.round(((weeklyGoal as number) || 0) / 5);
      const normalizedId = normalize(user.externalName || user.id || '');
      const goalsRef = doc(db, 'employee_goals', normalizedId);
      const saveData = {
        dailyGoal: dailyGoal,
        weeklyGoal: (weeklyGoal as number) || 0,
        monthlyGoal: (monthlyGoal as number) || 0,
        updatedAt: new Date().toISOString(),
        userId: user.id,
      };

      await setDoc(goalsRef, saveData, { merge: true });
      console.log('✅ Goals saved:', saveData);
      alert('✅ Mål lagret!');
      navigate('/home');
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('❌ Feil ved lagring: ' + (error as any).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mobile-goals">
        <div className="mobile-header">
          <button className="back-button" onClick={() => navigate('/home')}>
            ← Tilbake
          </button>
          <h1>Mine Mål</h1>
          <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
          Laster...
        </div>
      </div>
    );
  }

  const dailyGoal = Math.round(((weeklyGoal as number) || 0) / 5);

  return (
    <div className="mobile-goals">
      <div className="mobile-header">
        <button className="back-button" onClick={() => navigate('/home')}>
          ← Tilbake
        </button>
        <h1>Mine Mål</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="mobile-goals-content">
        <div className="goals-form">
          <div className="goal-input-group">
            <label>DAGSMÅL</label>
            <div className="goal-display">{dailyGoal}</div>
            <p className="goal-hint">Beregnes automatisk: Ukesmål ÷ 5</p>
          </div>

          <div className="goal-input-group">
            <label>UKESMÅL</label>
            <input
              type="number"
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(e.target.value ? parseInt(e.target.value) : '')}
              autoFocus
            />
          </div>

          <div className="goal-input-group">
            <label>MÅNEDSMÅL</label>
            <input
              type="number"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value ? parseInt(e.target.value) : '')}
            />
          </div>

          <button
            className="save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Lagrer...' : '✓ Lagre Mål'}
          </button>
        </div>

        {/* BADGES SECTION */}
        <div className="badges-section">
          <h3>BADGES</h3>
          <div className="badges-grid">
            {badgeDefinitions.map((badge) => {
              const isEarned = badgeStatus[badge.emoji] === true;
              return (
                <button
                  key={badge.emoji}
                  className={`badge-emoji ${isEarned ? 'earned' : 'locked'}`}
                  onClick={() => setSelectedBadge(badge)}
                  type="button"
                >
                  {badge.emoji}
                </button>
              );
            })}
          </div>
        </div>

        {/* BADGE DETAIL MODAL */}
        {selectedBadge && (
          <div className="badge-modal-overlay" onClick={() => setSelectedBadge(null)}>
            <div className="badge-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedBadge(null)}>
                ✕
              </button>
              <div className="modal-badge-emoji">{selectedBadge.emoji}</div>
              <h2>{selectedBadge.navn}</h2>
              <p className="modal-description">{selectedBadge.beskrivelse}</p>
              <p className="modal-requirement">Kreves: {selectedBadge.verdi}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
