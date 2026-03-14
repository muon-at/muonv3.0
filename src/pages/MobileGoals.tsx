import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileGoals.css';

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
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadGoals = async () => {
      try {
        const normalizedId = normalize(user.externalName || user.id || '');
        const goalsRef = doc(db, 'employee_goals', normalizedId);
        const goalsDoc = await getDoc(goalsRef);
        if (goalsDoc.exists()) {
          const data = goalsDoc.data();
          setWeeklyGoal(data?.weeklyGoal || 0);
          setMonthlyGoal(data?.monthlyGoal || 0);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading goals:', error);
        setLoading(false);
      }
    };

    loadGoals();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const dailyGoal = Math.round((weeklyGoal || 0) / 5);
      const normalizedId = normalize(user.externalName || user.id || '');
      const goalsRef = doc(db, 'employee_goals', normalizedId);
      const saveData = {
        dailyGoal: dailyGoal,
        weeklyGoal: weeklyGoal || 0,
        monthlyGoal: monthlyGoal || 0,
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

  const dailyGoal = Math.round((weeklyGoal || 0) / 5);

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
              onChange={(e) => setWeeklyGoal(parseInt(e.target.value) || 0)}
              placeholder="0"
              autoFocus
            />
          </div>

          <div className="goal-input-group">
            <label>MÅNEDSMÅL</label>
            <input
              type="number"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(parseInt(e.target.value) || 0)}
              placeholder="0"
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

        <div className="goals-summary">
          <h3>OPPSUMMERING</h3>
          <div className="summary-item">
            <span>Dagsmål:</span>
            <strong>{dailyGoal}</strong>
          </div>
          <div className="summary-item">
            <span>Ukesmål:</span>
            <strong>{weeklyGoal}</strong>
          </div>
          <div className="summary-item">
            <span>Månedsmål:</span>
            <strong>{monthlyGoal}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
