import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import FileUploadModal from '../components/FileUploadModal';
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

interface SalgRecord {
  id: string;
  csvId?: string;
  kundeNr: string;
  kundeNavn?: string;
  beløp?: number;
  dato?: string;
  produkt?: string;
  selger?: string;
  platform?: string;
  avdeling?: string;
  [key: string]: any;
}

export default function AdminDashboard() {
  console.log('✅ AdminDashboard component mounted!');
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState('allente');
  const [activeAllenteTab, setActiveAllenteTab] = useState('i-dag');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; employeeId?: string; employeeName?: string }>({ show: false });
  const [deleting, setDeleting] = useState(false);
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; fileType?: 'salg' | 'stats' | 'angring' }>({ isOpen: false });
  const [salgData, setSalgData] = useState<SalgRecord[]>([]);
  const [loadingSalg, setLoadingSalg] = useState(false);
  const [employeeMap, setEmployeeMap] = useState<{ [key: string]: string }>({});

  // Fetch employees when Organisasjon tab is opened
  useEffect(() => {
    if (activeMainTab === 'organisasjon') {
      fetchEmployees();
    }
  }, [activeMainTab]);

  // Fetch salg data when SALG tab is opened
  useEffect(() => {
    console.log('🔍 useEffect triggered:', { activeMainTab, activeAllenteTab });
    if (activeMainTab === 'allente' && activeAllenteTab === 'salg') {
      console.log('🚀 Fetching salg data...');
      fetchEmployeeMap().then(() => fetchSalgData());
    }
  }, [activeMainTab, activeAllenteTab]);

  const fetchEmployeeMap = async () => {
    try {
      const empRef = collection(db, 'employees');
      const snapshot = await getDocs(empRef);
      
      const map: { [key: string]: string } = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.externalName && data.department) {
          map[data.externalName] = data.department;
        }
      });
      
      console.log('📋 Employee Map:', map);
      setEmployeeMap(map);
    } catch (err) {
      console.error('❌ Error fetching employee map:', err);
    }
  };

  const fetchSalgData = async () => {
    setLoadingSalg(true);
    try {
      const salgRef = collection(db, 'allente_kontraktsarkiv');
      const snapshot = await getDocs(salgRef);
      
      console.log('📊 Fetching from allente_kontraktsarkiv collection...');
      console.log('📦 Total documents found:', snapshot.size);
      
      const salgList: SalgRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const selger = data.selger || '';
        const avdeling = employeeMap[selger] || 'Ukjent';
        
        // Try different column name variations for kundenummer
        const kundeNr = data.kundenummer || data.kundeNr || data.kundenr || 'N/A';
        
        console.log('📌 Document:', doc.id, 'Kundenummer:', kundeNr, 'Selger:', selger);
        
        salgList.push({
          id: doc.id,
          csvId: data.id || data.csvId || '-',
          kundeNr: kundeNr,
          kundeNavn: data.kunde || data.kundeNavn || data.kundenavn || '-',
          beløp: data.beløp || '-',
          dato: data.dato,
          produkt: data.produkt,
          selger: selger,
          platform: data.platform || '-',
          avdeling: avdeling,
          ...data,
        });
      });
      
      console.log('✅ Total salg records processed:', salgList.length);
      setSalgData(salgList.sort((a, b) => (b.dato || '').localeCompare(a.dato || '')));
    } catch (err) {
      console.error('❌ Error fetching salg data:', err);
    } finally {
      setLoadingSalg(false);
    }
  };

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      
      const employeeList: Employee[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Skip archived employees
        if (data.archived) return;
        
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

  const handleDeleteClick = (employeeId: string, employeeName: string) => {
    setDeleteConfirm({ show: true, employeeId, employeeName });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.employeeId) return;

    setDeleting(true);
    try {
      const empRef = doc(db, 'employees', deleteConfirm.employeeId);
      await updateDoc(empRef, { archived: true });

      // Remove from UI
      setEmployees(employees.filter((emp) => emp.id !== deleteConfirm.employeeId));

      // Close modal
      setDeleteConfirm({ show: false });
    } catch (err) {
      console.error('Error archiving employee:', err);
      alert('Feil ved arkivering av ansatt');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false });
  };

  const handleUploadClick = (fileType: 'salg' | 'stats' | 'angring') => {
    setUploadModal({ isOpen: true, fileType });
  };

  const handleFileUpload = async (file: File, fileType: string) => {
    console.log(`📤 Upload completed for ${fileType} file:`, file.name);
    
    // Refresh salg data after successful upload
    if (fileType === 'salg' && activeMainTab === 'allente' && activeAllenteTab === 'salg') {
      console.log('🔄 Refreshing SALG data...');
      await fetchEmployeeMap();
      await fetchSalgData();
    }
  };

  const getUploadModalTitle = () => {
    switch (uploadModal.fileType) {
      case 'salg':
        return '📤 Last opp Salg';
      case 'stats':
        return '📈 Last opp Stats';
      case 'angring':
        return '↩️ Last opp Angring';
      default:
        return 'Last opp fil';
    }
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
        <div className="header-buttons-admin">
          <button 
            className="back-btn-admin"
            onClick={() => navigate('/teamleder')}
          >
            ← Tilbake
          </button>
          <button className="logout-btn">LOGG UT</button>
        </div>
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
                <button 
                  className="upload-btn"
                  style={{ borderColor: uploadButtons[0].color, color: uploadButtons[0].color }}
                  onClick={() => handleUploadClick('salg')}
                >
                  {uploadButtons[0].icon} {uploadButtons[0].label}
                </button>
                <button 
                  className="upload-btn"
                  style={{ borderColor: uploadButtons[1].color, color: uploadButtons[1].color }}
                  onClick={() => handleUploadClick('stats')}
                >
                  {uploadButtons[1].icon} {uploadButtons[1].label}
                </button>
                <button 
                  className="upload-btn"
                  style={{ borderColor: uploadButtons[2].color, color: uploadButtons[2].color }}
                  onClick={() => handleUploadClick('angring')}
                >
                  {uploadButtons[2].icon} {uploadButtons[2].label}
                </button>
              </div>
            </div>

            {/* Allente Sub-tabs */}
            <div className="allente-tabs">
              {allenteTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`allente-tab ${activeAllenteTab === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    console.log('🔘 Clicked tab:', tab.id);
                    setActiveAllenteTab(tab.id);
                  }}
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
            {/* SALG Tab */}
            {activeAllenteTab === 'salg' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Kontraktsarkiv {salgData.length > 0 && <span style={{ color: '#667eea', fontSize: '0.8em' }}>({salgData.length} ordre)</span>}</h3>
                  <p className="content-subtitle">Fullstendig oversikt over alle kontrakter</p>
                </div>

                {loadingSalg ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster salg data...
                  </p>
                ) : salgData.length > 0 ? (
                  <>
                    <div className="sales-table">
                      <div className="table-header">
                        <div className="col-dato">Ordredato</div>
                        <div className="col-id">Id</div>
                        <div className="col-kunde">Kundenummer</div>
                        <div className="col-produkt">Produkter</div>
                        <div className="col-selger">Selger</div>
                        <div className="col-platform">Choosen Platform</div>
                      </div>
                      {salgData.map((row) => (
                        <div key={row.id} className="table-row">
                          <div className="col-dato">{row.dato || '-'}</div>
                          <div className="col-id">{row.csvId || '-'}</div>
                          <div className="col-kunde">{row.kundeNr}</div>
                          <div className="col-produkt">{row.produkt || '-'}</div>
                          <div className="col-selger">{row.selger || '-'}</div>
                          <div className="col-platform">{row.platform || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen salg data funnet. Last opp en CSV/Excel fil for å komme i gang.
                  </p>
                )}
              </div>
            )}

            {/* Other tabs placeholder */}
            {activeAllenteTab !== 'i-dag' && activeAllenteTab !== 'salg' && (
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
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteClick(emp.id, emp.name)}
                        >
                          🗑️
                        </button>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h2>Arkiver ansatt?</h2>
            <p>
              Er du sikker på at du vil arkivere <strong>{deleteConfirm.employeeName}</strong>?
            </p>
            <p className="modal-info">
              Ansattet vil bli markert som arkivert i Firestore og fjernet fra listen.
            </p>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={handleCancelDelete}
                disabled={deleting}
              >
                Avbryt
              </button>
              <button 
                className="modal-btn delete-btn"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Arkiverer...' : 'Ja, arkiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={uploadModal.isOpen}
        title={getUploadModalTitle()}
        fileType={uploadModal.fileType || 'salg'}
        onClose={() => setUploadModal({ isOpen: false })}
        onUpload={handleFileUpload}
      />
    </div>
  );
}
