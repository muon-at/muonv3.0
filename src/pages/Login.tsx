import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Vennligst fyll inn både e-post og passord');
      return;
    }

    setLoading(true);
    
    // Mock login - in real app, this would validate against backend
    setTimeout(() => {
      if (email && password) {
        // Store auth state (in real app, use proper auth)
        localStorage.setItem('auth', 'true');
        localStorage.setItem('user_email', email);
        navigate('/min-side');
      } else {
        setError('Feil e-post eller passord');
      }
      setLoading(false);
    }, 500);
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
            <label htmlFor="email">E-post</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din.epost@muon.no"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passord</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logger inn...' : 'Logg inn'}
          </button>
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
