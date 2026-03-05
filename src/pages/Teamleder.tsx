import { useNavigate } from 'react-router-dom';
import '../styles/Pages.css';

export default function Teamleder() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Teamleder Dashboard</h1>
        <p className="subtitle">Oversikt og styring av ditt team</p>
      </div>

      <div className="page-content">
        <div className="section-grid">
          {/* ALLENTE Seksjon */}
          <div className="section-box allente-section">
            <h2>📊 Allente</h2>
            <div className="section-items">
              <div className="item">
                <h4>Opplasting anger</h4>
                <p>Last opp nye kontrakter</p>
              </div>
              <div className="item">
                <h4>Opplasting salg</h4>
                <p>Registrer salg</p>
              </div>
              <div className="item">
                <h4>Opplasting TMG</h4>
                <p>Last opp Telemagic data</p>
              </div>
              <div className="item">
                <h4>Oversikt Muon</h4>
                <p>Se hele Muons oversikt</p>
              </div>
              <div className="item">
                <h4>Oversikt avdeling</h4>
                <p>Se din avdelings oversikt</p>
              </div>
              <div className="item">
                <h4>DAG / UKE / MND</h4>
                <p>Salgsstatistikk</p>
              </div>
              <div className="item">
                <h4>Endre targets</h4>
                <p>Sett salg mål</p>
              </div>
            </div>
          </div>

          {/* ANSATT STATS Seksjon */}
          <div className="section-box ansatt-section">
            <h2>👥 Ansatt Statistikk</h2>
            <div className="section-items">
              <div className="item">
                <h4>Alle i tabell</h4>
                <p>Se alle ansattes stats</p>
              </div>
              <div className="item">
                <h4>SALG I DAG</h4>
                <p>Daglig oversikt</p>
              </div>
              <div className="item">
                <h4>SALG UKE</h4>
                <p>Ukentlig oversikt</p>
              </div>
              <div className="item">
                <h4>SALG MND</h4>
                <p>Månedlig oversikt</p>
              </div>
              <div className="item">
                <h4>TOTALT</h4>
                <p>Total statistikk</p>
              </div>
              <div className="item">
                <h4>Rekord dag/uke/mnd</h4>
                <p>Beste resultater</p>
              </div>
            </div>
          </div>
        </div>

        <div className="navigation-section">
          <button 
            className="nav-button back-btn"
            onClick={() => navigate('/')}
          >
            ← Tilbake til Min Side
          </button>
          <button 
            className="nav-button admin-btn"
            onClick={() => navigate('/admin')}
          >
            🔐 Gå til Admin →
          </button>
        </div>
      </div>
    </div>
  );
}
