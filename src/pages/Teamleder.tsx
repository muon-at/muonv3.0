import { useNavigate } from 'react-router-dom';
import '../styles/Teamleder.css';

export default function Teamleder() {
  const navigate = useNavigate();

  // Mock data - will be replaced with Firestore later
  const kpis = [
    { label: 'I DAG', value: 0, subtitle: 'salg totalt', color: '#C86D4D' },
    { label: 'DENNE UKEN', value: 0, subtitle: 'salg totalt', color: '#C86D4D' },
    { label: 'DENNE MND', value: '0/800', subtitle: '0% av mål', color: '#C86D4D' },
  ];

  const departments = [
    {
      name: 'KRS',
      stats: [
        { label: 'Dag', current: 0, target: 14 },
        { label: 'Uke', current: 0, target: 70 },
        { label: 'Måned', current: 0, target: null },
      ],
    },
    {
      name: 'OSL',
      stats: [
        { label: 'Dag', current: 0, target: 14 },
        { label: 'Uke', current: 0, target: 70 },
        { label: 'Måned', current: 0, target: null },
      ],
    },
    {
      name: 'Skien',
      stats: [
        { label: 'Dag', current: 0, target: 10 },
        { label: 'Uke', current: 0, target: 50 },
        { label: 'Måned', current: 0, target: null },
      ],
    },
  ];

  const topSellers = [
    { rank: 1, name: 'Ajay Sureshkumar / Sælger', value: 112 },
    { rank: 2, name: 'Brandon / Sælger', value: 67 },
    { rank: 3, name: 'Håkon / Sælger', value: 54 },
    { rank: 4, name: 'Mats / Sælger', value: 48 },
    { rank: 5, name: 'Fayez / Sælger', value: 43 },
  ];

  return (
    <div className="teamleder-container">
      {/* Header */}
      <div className="teamleder-header">
        <div>
          <h1>Teamleder Dashboard</h1>
          <p className="subtitle">Oversikt og styring av ditt team</p>
        </div>
        <div className="header-nav-buttons">
          <button 
            className="nav-button back-btn-header"
            onClick={() => navigate('/')}
          >
            ← Min Side
          </button>
          <button 
            className="nav-button admin-btn-header"
            onClick={() => navigate('/admin')}
          >
            Admin →
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="teamleder-content">
        {/* KPI Cards */}
        <div className="kpi-section">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="kpi-card">
              <p className="kpi-label">{kpi.label}</p>
              <p className="kpi-value" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
              <p className="kpi-subtitle">{kpi.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Department Cards */}
        <div className="department-section">
          {departments.map((dept, idx) => (
            <div key={idx} className="department-card">
              <h3 className="department-name">{dept.name}</h3>
              {dept.stats.map((stat, sidx) => (
                <div key={sidx} className="stat-row">
                  <span className="stat-label">{stat.label}</span>
                  <span 
                    className="stat-value"
                    style={{ color: '#C86D4D' }}
                  >
                    {stat.target ? `${stat.current}/${stat.target}` : stat.current}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Top 5 Sellers */}
        <div className="top-sellers-card">
          <div className="top-sellers-header">
            <h3>🏆 Topp 5 Sælgere</h3>
          </div>
          <div className="sellers-list">
            {topSellers.map((seller, idx) => (
              <div key={idx} className="seller-row">
                <div className="seller-rank">{seller.rank}</div>
                <div className="seller-name">{seller.name}</div>
                <div className="seller-value" style={{ color: '#C86D4D' }}>
                  {seller.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
