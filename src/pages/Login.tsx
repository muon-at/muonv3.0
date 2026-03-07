import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/min-side');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Vennligst fyll inn både brukernavn og passord');
      return;
    }

    setLoading(true);
    
    try {
      // Lookup employee by username in Firestore
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      
      let foundEmployee: any = null;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.username === username && data.password === password && !data.archived) {
          foundEmployee = { id: doc.id, ...data };
        }
      });

      if (foundEmployee) {
        // Check if default password - must change it
        if (foundEmployee.password === '1234' || !foundEmployee.passwordChanged) {
          // Store employee for password reset page
          localStorage.setItem('tempEmployee', JSON.stringify(foundEmployee));
          navigate('/reset-password');
        } else {
          // Normal login
          login(foundEmployee.name, foundEmployee.id, foundEmployee.role, foundEmployee);
          navigate('/min-side');
        }
      } else {
        setError('Feil brukernavn eller passord');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Feil ved innlogging. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Logo */}
        <div className="login-header">
          <div className="logo">muon</div>
          <h1>Admin Portal</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Brukernavn</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="f.eks sebastian.moen"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passord</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Removed role selector - comes from Firestore */}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? '🔄 Logger inn...' : '✅ Logg inn'}
          </button>

          {/* Rolle og prosjekt hentes fra Firestore */}
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="forgot-password">
            <a href="#">Glemt passord?</a>
          </p>
          <p className="signup">
            Ingen konto? <a href="#">Kontakt administrator</a>
          </p>
        </div>

        {/* Demo Info */}
        <div className="demo-info">
          <p>Demo: Bruk hvilken som helst e-post og passord</p>
        </div>
      </div>

      {/* Background decoration */}
      <div className="background-decoration">
        <div className="gradient-circle-1"></div>
        <div className="gradient-circle-2"></div>
      </div>
    </div>
  );
}
