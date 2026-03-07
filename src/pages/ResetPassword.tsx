import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/Login.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tempEmployee, setTempEmployee] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Get employee data from localStorage
    const stored = localStorage.getItem('tempEmployee');
    if (!stored) {
      navigate('/');
      return;
    }
    try {
      setTempEmployee(JSON.parse(stored));
    } catch {
      navigate('/');
    }
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!newPassword || !confirmPassword) {
      setError('Vennligst fyll inn begge passord');
      return;
    }

    if (newPassword.length < 4) {
      setError('Passord må være minst 4 tegn');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passordene matcher ikke');
      return;
    }

    setLoading(true);

    try {
      // Update employee password in Firestore
      const empRef = doc(db, 'employees', tempEmployee.id);
      await updateDoc(empRef, {
        password: newPassword,
        passwordChanged: true,
      });

      setSuccess(true);
      
      // Clear temp employee and login
      localStorage.removeItem('tempEmployee');
      
      // Update employee object with new password
      const updatedEmployee = { ...tempEmployee, password: newPassword, passwordChanged: true };
      
      // Login and redirect
      login(updatedEmployee.name, updatedEmployee.id, updatedEmployee.role, updatedEmployee);
      
      setTimeout(() => {
        navigate('/min-side');
      }, 1500);
    } catch (err) {
      console.error('Error updating password:', err);
      setError('Feil ved oppdatering av passord');
    } finally {
      setLoading(false);
    }
  };

  if (!tempEmployee) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Laster...</div>;
  }

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Logo */}
        <div className="login-header">
          <div className="logo">muon</div>
          <h1>Sett Nytt Passord</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleResetPassword} className="login-form">
          {error && <div className="error-message">{error}</div>}
          {success && (
            <div style={{
              background: '#10b981',
              color: 'white',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              ✅ Passord oppdatert! Logger inn...
            </div>
          )}

          <div style={{ 
            background: '#f0f0f0', 
            padding: '1rem', 
            borderRadius: '6px', 
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>Velkommen</p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#333' }}>
              {tempEmployee.name}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">Nytt Passord *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minst 4 tegn"
                disabled={loading || success}
                autoFocus
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '0.5rem',
                  color: '#667eea',
                }}
                disabled={loading || success}
              >
                {showNewPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Bekreft Passord *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Gjenta passord"
                disabled={loading || success}
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '0.5rem',
                  color: '#667eea',
                }}
                disabled={loading || success}
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading || success}>
            {loading ? '🔄 Oppdaterer...' : success ? '✅ Ferdig!' : '💾 Sett Passord'}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p style={{ fontSize: '0.85rem', color: '#999', margin: 0 }}>
            Du må sette nytt passord før første login
          </p>
        </div>
      </div>
    </div>
  );
}
