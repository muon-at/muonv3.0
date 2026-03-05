import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/AdminDashboard.css';

interface Employee {
  id: string;
  name: string;
  email?: string;
  department?: string;
  role?: string;
  project?: string;
  slackName?: string;
  externalName?: string;
  tmgName?: string;
  employment_type?: string;
}

export default function AdminDashboard() {
  const [activeMainTab, setActiveMainTab] = useState('allente');
  const [activeAllenteTab, setActiveAllenteTab] = useState('i-dag');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Fetch employees when Organisasjon tab is opened
  useEffect(() => {
    if (activeMainTab === 'organisasjon') {
      fetchEmployees();
    }
  }, [activeMainTab]);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      
      const employeeList: Employee[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        employeeList.push({
          id: doc.id,
          name: data.name || 'N/A',
          email: data.email,
          department: data.department,
          role: data.role,
          project: data.project,
          slackName: data.slackName,
          externalName: data.externalName,
          tmgName: data.tmgName,
          employment_type: data.employment_type,
        });
      });
      
      setEmployees(employeeList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Mock data
  const salesData = [
    { ansatt: 'Fayez Fadie', salg: 0, slack: 'Fayez' },
    { ansatt: 'Steffen Støylen', salg: 0, slack: 'Steffen' },
    { ansatt: 'Benjamin Johannessen', salg: 0, slack: 'Benjamin' },
  ];

  const mainTabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'organisasjon', label: '👥 Organisasjon' },
    { id: 'allente', label: '🟠 Allente' },
  ];

  const allenteTabs = [
    { id: 'i-dag', label: 'I DAG' },
    { id: 'salg', label: 'SALG' },
    { id: 'stats', label: 'STATS' },
    { id: 'angring', label: 'ANGRING' },
    { id: 'mal', label: 'MÅL' },
    { id: 'dashboard', label: 'DASHBOARD' },
    { id: 'produkt', label: 'PRODUKT' },
    { id: 'badges', label: 'BADGES' },
  ];

  const uploadButtons = [
    { label: 'Last opp Salg', icon: '📤', color: '#C86D4D' },
    { label: 'Last opp Stats', icon: '📈', color: '#667eea' },
    { label: 'Last opp Angring', icon: '↩️', color: '#10b981' },
  ];

  const getRoleColor = (role?: string) => {
    const roleColors: { [key: string]: string } = {
      owner: '#4f46e5',
      teamleder: '#6366f1',
      selger: '#10b981',
      tekniker: '#f59e0b',
      ansatt: '#6b7280',
    };
    return roleColors[role?.toLowerCase() || ''] || '#6b7280';
  };

  return (
    <div className="admin-dashboard-container">
      {/* Header */}
      <div className="admin-header">
        <div className="header-left">
          <span className="muon-logo">muon</span>
          <div>
            <h1>Admin Dashboard</h1>
            <p className="subtitle">Sentralisert oversikt over kontrakter og brukerstatistikk</p>
          </div>
        </div>
        <button className="logout-btn">LOGG UT</button>
      </div>

      {/* Main Tab Navigation */}
      <div className="main-tabs">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            className={`main-tab ${activeMainTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveMainTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="admin-content">
        {activeMainTab === 'allente' && (
          <>
            {/* Allente Header */}
            <div className="section-header">
              <div className="section-title">
                <div className="section-icon">🟠</div>
                <h2>Allente</h2>
              </div>
              <div className="upload-buttons">
                {uploadButtons.map((btn, idx) => (
                  <button 
                    key={idx} 
                    className="upload-btn"
                    style={{ borderColor: btn.color, color: btn.color }}
                  >
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Allente Sub-tabs */}
            <div className="allente-tabs">
              {allenteTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`allente-tab ${activeAllenteTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveAllenteTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* I DAG Content */}
            {activeAllenteTab === 'i-dag' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Salg i dag – Allente</h3>
                  <p className="content-subtitle">Henter live data fra aliente Slack-kanal (🔔 + 📱 = 1 salg)</p>
                </div>

                <div className="info-box">
                  <span className="info-icon">💡</span>
                  <p>
                    <strong>Hvordan det fungerer:</strong> Post salg i #allente med emojis (🔔 eller 📱 = 1 salg hver). Tabellen oppdateres live.
                  </p>
                </div>

                <button className="update-btn">↻ Oppdater nå</button>

                {/* Sales Table */}
                <div className="sales-table">
                  <div className="table-header">
                    <div className="col-ansatt">Ansatt</div>
                    <div className="col-salg">Salg i dag</div>
                    <div className="col-slack">Slack-navn</div>
                  </div>
                  {salesData.map((row, idx) => (
                    <div key={idx} className="table-row">
                      <div className="col-ansatt">{row.ansatt}</div>
                      <div className="col-salg">
                        <span className="salg-badge">{row.salg}</span>
                      </div>
                      <div className="col-slack">{row.slack}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other tabs placeholder */}
            {activeAllenteTab !== 'i-dag' && (
              <div className="tab-content">
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                  {allenteTabs.find(t => t.id === activeAllenteTab)?.label} tab content coming soon...
                </p>
              </div>
            )}
          </>
        )}

        {activeMainTab === 'dashboard' && (
          <div className="tab-content">
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
              Dashboard content coming soon...
            </p>
          </div>
        )}

        {activeMainTab === 'organisasjon' && (
          <div className="tab-content">
            <div className="org-header">
              <h2>Ansatt Oversikt</h2>
              <p className="org-subtitle">Håndter alle ansatte i systemet</p>
            </div>

            {loadingEmployees ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                Laster ansatte...
              </p>
            ) : (
              <>
                <div className="employees-table">
                  <div className="table-header">
                    <div className="col-name">Navn</div>
                    <div className="col-email">Email</div>
                    <div className="col-role">Rolle</div>
                    <div className="col-dept">Avdeling</div>
                    <div className="col-project">Prosjekt</div>
                    <div className="col-slack">Slack</div>
                    <div className="col-actions">Handlinger</div>
                  </div>
                  {employees.map((emp) => (
                    <div key={emp.id} className="table-row">
                      <div className="col-name">{emp.name}</div>
                      <div className="col-email">{emp.email || '-'}</div>
                      <div className="col-role">
                        <span className="role-badge" style={{ backgroundColor: getRoleColor(emp.role) }}>
                          {emp.role || '-'}
                        </span>
                      </div>
                      <div className="col-dept">{emp.department || '-'}</div>
                      <div className="col-project">{emp.project || '-'}</div>
                      <div className="col-slack">{emp.slackName || '-'}</div>
                      <div className="col-actions">
                        <button className="action-btn edit-btn">✏️</button>
                        <button className="action-btn delete-btn">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>

                <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                  Total: {employees.length} ansatte
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
