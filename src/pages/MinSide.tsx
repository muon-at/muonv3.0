import { useNavigate } from 'react-router-dom';
import '../styles/Pages.css';

export default function MinSide() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Min Side</h1>
        <p className="subtitle">Dine personlige statistikker og oversikter</p>
      </div>

      <div className="page-content">
        <div className="stats-section">
          <h2>Mine Egne Statistikker</h2>
          <div className="stats-grid">
            <div className="stat-box">
              <h3>SALG I DAG</h3>
              <p className="stat-value">0</p>
            </div>
            <div className="stat-box">
              <h3>SALG UKE</h3>
              <p className="stat-value">0</p>
            </div>
            <div className="stat-box">
              <h3>SALG MND</h3>
              <p className="stat-value">0</p>
            </div>
            <div className="stat-box">
              <h3>TOTALT</h3>
              <p className="stat-value">0</p>
            </div>
          </div>
        </div>

        <div className="records-section">
          <h2>Mine Rekorder</h2>
          <div className="records-grid">
            <div className="record-item">
              <h4>Rekord dag</h4>
              <p>-</p>
            </div>
            <div className="record-item">
              <h4>Rekord uke</h4>
              <p>-</p>
            </div>
            <div className="record-item">
              <h4>Rekord mnd</h4>
              <p>-</p>
            </div>
          </div>
        </div>

        <div className="badges-section">
          <h2>Mine Badges</h2>
          <p>Ingen badges ennå</p>
        </div>

        <div className="project-section">
          <h2>Mitt Prosjekt</h2>
          <div className="project-items">
            <div className="project-item">
              <h4>📋 Oversikt Allente</h4>
              <p>Se oversikt for ditt prosjekt</p>
            </div>
            <div className="project-item">
              <h4>🏢 Oversikt Avdeling</h4>
              <p>Se oversikt for din avdeling</p>
            </div>
          </div>
        </div>

        <div className="navigation-section">
          <button 
            className="nav-button teamleder-btn"
            onClick={() => navigate('/teamleder')}
          >
            👥 Gå til Teamleder
          </button>
        </div>
      </div>
    </div>
  );
}
