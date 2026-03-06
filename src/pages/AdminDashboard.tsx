import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
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

interface KontraktsarkivFilters {
  selger: string;
  avdeling: string;
  produkt: string;
  platform: string;
  datoFrom: string;
  datoTo: string;
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
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: 'employee',
    project: '',
    department: 'OSL',
    slackName: '',
    externalName: '',
    tmgName: '',
  });
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; fileType?: 'salg' | 'stats' | 'angring' }>({ isOpen: false });
  const [salgData, setSalgData] = useState<SalgRecord[]>([]);
  const [loadingSalg, setLoadingSalg] = useState(false);
  const [angringerData, setAngringerData] = useState<any[]>([]);
  const [loadingAngringer, setLoadingAngringer] = useState(false);
  const [angringerFilters, setAngringerFilters] = useState({
    filnavn: '',
    kundenummer: '',
    produkt: '',
    selger: '',
    periode: '',
    plattform: '',
  });
  const [activeAngringerFilters, setActiveAngringerFilters] = useState(angringerFilters);
  const [produkterData, setProdukterData] = useState<any[]>([]);
  const [loadingProdukter, setLoadingProdukter] = useState(false);
  const [badgesData, setBadgesData] = useState<any[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);

  const defaultBadges = ['👑', '🎓', '🏆', '⭐', '💎', '🔥', '🚀', '👑', '🎯', '💪', '☀️', '⚡', '🎭', '🏅', '🎖️'];
  const [progresjonData, setProgresjonData] = useState<any[]>([]);
  const [loadingProgresjon, setLoadingProgresjon] = useState(false);
  const [filters, setFilters] = useState<KontraktsarkivFilters>({
    selger: '',
    avdeling: '',
    produkt: '',
    platform: '',
    datoFrom: '',
    datoTo: '',
  });
  const [activeFilters, setActiveFilters] = useState<KontraktsarkivFilters>({
    selger: '',
    avdeling: '',
    produkt: '',
    platform: '',
    datoFrom: '',
    datoTo: '',
  });

  // Fetch employees when Organisasjon tab is opened
  useEffect(() => {
    if (activeMainTab === 'organisasjon') {
      fetchEmployees();
    }
  }, [activeMainTab]);

  // Fetch progresjon data when PROGRESJON tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'progresjon') {
      setLoadingProgresjon(true);
      const loadProgresjonData = async () => {
        try {
          const salgRef = collection(db, 'allente_kontraktsarkiv');
          const snapshot = await getDocs(salgRef);
          
          // Calculate date ranges
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          
          // Convert snapshot to array for easier processing
          const contracts: any[] = [];
          snapshot.forEach((doc) => {
            contracts.push(doc.data());
          });
          
          // Parse contracts and group by seller
          const sellerStats: { [key: string]: { month: number; week: number; total: number; weeks: { [key: string]: number }; months: { [key: string]: number } } } = {};
          
          contracts.forEach((data, idx) => {
            const selger = data.selger || 'Ukjent';
            const orderedateStr = data.orderdato || '';
            
            // Debug first 2 contracts
            if (idx < 2) {
              console.log(`📋 Contract ${idx}:`, { selger, orderedato: orderedateStr, keys: Object.keys(data).slice(0, 5) });
            }
            
            // Initialize seller if not exists
            if (!sellerStats[selger]) {
              sellerStats[selger] = { month: 0, week: 0, total: 0, weeks: {}, months: {} };
            }
            
            sellerStats[selger].total++;
            
            // Parse date (DD/MM/YYYY format)
            if (orderedateStr) {
              const parts = orderedateStr.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                const orderDate = new Date(year, month - 1, day);
                
                // Debug first contract parsing
                if (idx === 0) {
                  console.log('🗓️ First contract parsed:', {
                    raw: orderedateStr,
                    parts: parts,
                    day,
                    month,
                    year,
                    orderDate: orderDate.toISOString().split('T')[0],
                  });
                }
                
                // Count this month
                if (orderDate >= startOfMonth && orderDate <= today) {
                  sellerStats[selger].month++;
                }
                
                // Count this week
                if (orderDate >= startOfWeek && orderDate <= today) {
                  sellerStats[selger].week++;
                }
                
                // Track weeks
                const weekNum = Math.floor((orderDate.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
                const weekKey = `${year}-W${weekNum}`;
                sellerStats[selger].weeks[weekKey] = (sellerStats[selger].weeks[weekKey] || 0) + 1;
                
                // Track months
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                sellerStats[selger].months[monthKey] = (sellerStats[selger].months[monthKey] || 0) + 1;
              }
            }
          });
          
          // Create array with all stats
          const progresjonArray = Object.entries(sellerStats).map(([selger, stats], index) => {
            // Find best week
            const weeks = Object.values(stats.weeks);
            const bestWeek = weeks.length > 0 ? Math.max(...weeks) : 0;
            
            // Find best month
            const months = Object.values(stats.months);
            const bestMonth = months.length > 0 ? Math.max(...months) : 0;
            
            // Debug: Log first 3 sellers
            if (index < 3) {
              console.log(`📊 ${selger}:`, {
                total: stats.total,
                weeks: Object.keys(stats.weeks).length > 0 ? Object.keys(stats.weeks)[0] + '=' + Object.values(stats.weeks)[0] : 'empty',
                months: Object.keys(stats.months).length > 0 ? Object.keys(stats.months)[0] + '=' + Object.values(stats.months)[0] : 'empty',
                bestWeek,
                bestMonth,
              });
            }
            
            return {
              selger,
              month: stats.month,
              week: stats.week,
              total: stats.total,
              bestWeek,
              bestMonth,
            };
          });
          
          setProgresjonData(progresjonArray.sort((a, b) => b.total - a.total));
        } catch (err) {
          console.error('Error fetching progresjon data:', err);
        } finally {
          setLoadingProgresjon(false);
        }
      };
      
      loadProgresjonData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch badges data when BADGES tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'badges') {
      setLoadingBadges(true);
      const loadBadgesData = async () => {
        try {
          const badgesRef = collection(db, 'allente_badges');
          const snapshot = await getDocs(badgesRef);
          const badges: any[] = [];
          
          snapshot.forEach((doc) => {
            badges.push({ id: doc.id, ...doc.data() });
          });

          // If no badges in DB, create from defaults
          if (badges.length === 0) {
            const defaultBadgesList = defaultBadges.map((emoji) => ({
              emoji,
              navn: '',
              verdi: '',
              beskrivelse: '',
            }));
            setBadgesData(defaultBadgesList);
          } else {
            setBadgesData(badges.sort((a, b) => a.emoji.localeCompare(b.emoji)));
          }
        } catch (err) {
          console.error('Error fetching badges:', err);
        } finally {
          setLoadingBadges(false);
        }
      };
      
      loadBadgesData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch produkter data when PRODUKT tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'produkt') {
      setLoadingProdukter(true);
      const loadProdukterData = async () => {
        try {
          // Get unique products from contracts
          const contractsRef = collection(db, 'allente_kontraktsarkiv');
          const contractsSnapshot = await getDocs(contractsRef);
          const uniqueProdukter = new Set<string>();
          
          contractsSnapshot.forEach((doc) => {
            const produkt = doc.data().produkt || '';
            if (produkt.trim()) {
              uniqueProdukter.add(produkt);
            }
          });

          // Get CPO/Provisjon data from Firestore
          const produkterRef = collection(db, 'allente_produkter');
          const produkterSnapshot = await getDocs(produkterRef);
          const produkterMap = new Map<string, any>();
          
          produkterSnapshot.forEach((doc) => {
            produkterMap.set(doc.id, doc.data());
          });

          // Build products list with CPO/Provisjon
          const products = Array.from(uniqueProdukter).map((navn) => ({
            navn,
            cpo: produkterMap.get(navn)?.cpo || '',
            provisjon: produkterMap.get(navn)?.provisjon || '',
          })).sort((a, b) => a.navn.localeCompare(b.navn));
          
          setProdukterData(products);
        } catch (err) {
          console.error('Error fetching produkter:', err);
        } finally {
          setLoadingProdukter(false);
        }
      };
      
      loadProdukterData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch angringer data when ANGRING tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'angring') {
      setLoadingAngringer(true);
      const loadAngringerData = async () => {
        try {
          const angringerRef = collection(db, 'allente_kanselleringer');
          const snapshot = await getDocs(angringerRef);
          const records: any[] = [];
          
          snapshot.forEach((doc) => {
            records.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          
          setAngringerData(records);
        } catch (err) {
          console.error('Error fetching angringer:', err);
        } finally {
          setLoadingAngringer(false);
        }
      };
      
      loadAngringerData();
    }
  }, [activeMainTab, activeAllenteTab]);

  // Fetch salg data when SALG tab is opened
  useEffect(() => {
    if (activeMainTab === 'allente' && activeAllenteTab === 'salg') {
      setLoadingSalg(true);
      const loadBothAsync = async () => {
        // First fetch employees
        const empRef = collection(db, 'employees');
        const empSnapshot = await getDocs(empRef);
        const map: { [key: string]: string } = {};
        
        empSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.externalName && data.department) {
            const normalized = normalizeWhitespace(data.externalName);
            map[normalized] = data.department;
          }
        });
        
        // Then fetch and match salg data
        const salgRef = collection(db, 'allente_kontraktsarkiv');
        const salgSnapshot = await getDocs(salgRef);
        const salgList: SalgRecord[] = [];
        
        salgSnapshot.forEach((doc) => {
          const data = doc.data();
          const selger = data.selger || '';
          const normalizedSelger = normalizeWhitespace(selger);
          const avdeling = map[normalizedSelger] || 'Ukjent';
          
          salgList.push({
            id: doc.id,
            csvId: data.id || data.csvId || '-',
            kundeNr: data.kundenummer || data.kundeNr || data.kundenr || 'N/A',
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
        setSalgData(salgList.sort((a, b) => (b.dato || '').localeCompare(a.dato || '')));
        setLoadingSalg(false);
      };
      
      loadBothAsync();
    }
  }, [activeMainTab, activeAllenteTab]);

  const normalizeWhitespace = (text: string): string => {
    // Normalize whitespace around "/" - "Mats / selger" and "Mats /selger" become "Mats / selger"
    return text.replace(/\s*\/\s*/g, ' / ').trim();
  };

  const handleDeleteClick = (employeeId: string, employeeName: string) => {
    setDeleteConfirm({ show: true, employeeId, employeeName });
  };

  const handleEditClick = (employee: any) => {
    setEditingEmployee({ ...employee });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    
    try {
      const empRef = doc(db, 'employees', editingEmployee.id);
      await updateDoc(empRef, {
        name: editingEmployee.name || '',
        role: editingEmployee.role || '',
        project: editingEmployee.project || '',
        department: editingEmployee.department || '',
        slackName: editingEmployee.slackName || '',
        externalName: editingEmployee.externalName || '',
        tmgName: editingEmployee.tmgName || '',
      });

      // Update local state
      setEmployees(employees.map((emp) => 
        emp.id === editingEmployee.id ? editingEmployee : emp
      ));
      
      setShowEditModal(false);
      setEditingEmployee(null);
    } catch (err) {
      console.error('Error saving employee:', err);
      alert('Feil ved lagring av ansatt');
    }
  };

  const handleSaveBadges = async () => {
    try {
      const badgesRef = collection(db, 'allente_badges');
      
      for (const badge of badgesData) {
        if (badge.emoji) {
          const docRef = doc(db, 'allente_badges', badge.emoji);
          const docSnapshot = await getDocs(badgesRef);
          let exists = false;
          
          docSnapshot.forEach((d) => {
            if (d.id === badge.emoji) {
              exists = true;
            }
          });

          if (exists) {
            // Update existing
            await updateDoc(docRef, {
              navn: badge.navn || '',
              verdi: badge.verdi || '',
              beskrivelse: badge.beskrivelse || '',
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Create new
            await addDoc(badgesRef, {
              emoji: badge.emoji,
              navn: badge.navn || '',
              verdi: badge.verdi || '',
              beskrivelse: badge.beskrivelse || '',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      alert('✅ Badges lagret!');
    } catch (err) {
      console.error('Error saving badges:', err);
      alert('❌ Feil ved lagring');
    }
  };

  const handleSaveProdukter = async () => {
    try {
      const produkterRef = collection(db, 'allente_produkter');
      const snapshot = await getDocs(produkterRef);
      const existingIds = new Set<string>();
      
      snapshot.forEach((d) => {
        existingIds.add(d.id);
      });

      for (const produkt of produkterData) {
        if (produkt.navn.trim()) {
          if (existingIds.has(produkt.navn)) {
            // Update existing
            await updateDoc(doc(db, 'allente_produkter', produkt.navn), {
              cpo: produkt.cpo || '',
              provisjon: produkt.provisjon || '',
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Create new - use product name as document ID
            await addDoc(produkterRef, {
              navn: produkt.navn,
              cpo: produkt.cpo || '',
              provisjon: produkt.provisjon || '',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      alert('✅ Produkter lagret!');
    } catch (err) {
      console.error('Error saving produkter:', err);
      alert('❌ Feil ved lagring');
    }
  };

  const handleSaveAdd = async () => {
    if (!newEmployee.name.trim()) {
      alert('Navn er påkrevd');
      return;
    }

    try {
      const empCollection = collection(db, 'employees');
      const docRef = await addDoc(empCollection, {
        name: newEmployee.name,
        role: newEmployee.role,
        project: newEmployee.project || '',
        department: newEmployee.department,
        slackName: newEmployee.slackName || '',
        externalName: newEmployee.externalName || '',
        tmgName: newEmployee.tmgName || '',
        createdAt: new Date().toISOString(),
      });

      // Add to local state
      setEmployees([...employees, { id: docRef.id, ...newEmployee }]);

      setShowAddModal(false);
      setNewEmployee({
        name: '',
        role: 'employee',
        project: '',
        department: 'OSL',
        slackName: '',
        externalName: '',
        tmgName: '',
      });
    } catch (err) {
      console.error('Error adding employee:', err);
      alert('Feil ved opprettelse av ansatt');
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
    { id: 'progresjon', label: 'PROGRESJON' },
    { id: 'produkt', label: 'PRODUKT' },
    { id: 'badges', label: 'BADGES' },
  ];

  const uploadButtons = [
    { label: 'Last opp Salg', icon: '📤', color: '#C86D4D' },
    { label: 'Last opp Stats', icon: '📈', color: '#667eea' },
    { label: 'Last opp Angring', icon: '↩️', color: '#10b981' },
  ];



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

  const handleFileUpload = async () => {
    // Note: SALG data will auto-refresh when useEffect triggers on tab change
    // No need to manually fetch here
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

  const convertDateFormat = (dateStr: string): string => {
    // Convert M/D/YYYY, DD/MM/YYYY or DD.MM.YYYY to YYYY-MM-DD (with zero-padding)
    if (!dateStr) return '';
    
    // Try splitting by / first
    let parts = dateStr.split('/');
    if (parts.length !== 3) {
      // Try splitting by . if / didn't work
      parts = dateStr.split('.');
    }
    
    if (parts.length === 3) {
      const day = String(parts[0]).padStart(2, '0');
      const month = String(parts[1]).padStart(2, '0');
      return `${parts[2]}-${month}-${day}`;
    }
    return dateStr;
  };

  const getFilteredAngringerData = () => {
    return angringerData.filter((record) => {
      if (activeAngringerFilters.filnavn && !record.filename?.toLowerCase().includes(activeAngringerFilters.filnavn.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.kundenummer && !record.kundenummer?.toLowerCase().includes(activeAngringerFilters.kundenummer.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.produkt && !record.produkt?.toLowerCase().includes(activeAngringerFilters.produkt.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.selger && !record.selger?.toLowerCase().includes(activeAngringerFilters.selger.toLowerCase())) {
        return false;
      }
      if (activeAngringerFilters.periode && record.period?.toString() !== activeAngringerFilters.periode) {
        return false;
      }
      if (activeAngringerFilters.plattform && !record.plattform?.toLowerCase().includes(activeAngringerFilters.plattform.toLowerCase())) {
        return false;
      }
      return true;
    });
  };

  const getFilteredSalgData = () => {
    return salgData.filter((record) => {
      // Selger filter
      if (activeFilters.selger && !record.selger?.toLowerCase().includes(activeFilters.selger.toLowerCase())) {
        return false;
      }

      // Avdeling filter
      if (activeFilters.avdeling && record.avdeling !== activeFilters.avdeling) {
        return false;
      }

      // Produkt filter
      if (activeFilters.produkt && !record.produkt?.toLowerCase().includes(activeFilters.produkt.toLowerCase())) {
        return false;
      }

      // Plattform filter
      if (activeFilters.platform && !record.platform?.toLowerCase().includes(activeFilters.platform.toLowerCase())) {
        return false;
      }

      // Convert record date from DD/MM/YYYY to YYYY-MM-DD for comparison
      const recordDate = convertDateFormat(record.dato || '');

      // Dato from filter
      if (activeFilters.datoFrom && recordDate && recordDate < activeFilters.datoFrom) {
        return false;
      }

      // Dato to filter
      if (activeFilters.datoTo && recordDate && recordDate > activeFilters.datoTo) {
        return false;
      }

      return true;
    });
  };

  const handleSearch = () => {
    setActiveFilters(filters);
    console.log('🔍 Search triggered with filters:', filters);
  };

  const handleResetFilters = () => {
    const emptyFilters = {
      selger: '',
      avdeling: '',
      produkt: '',
      platform: '',
      datoFrom: '',
      datoTo: '',
    };
    setFilters(emptyFilters);
    setActiveFilters(emptyFilters);
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
                  <h3>Kontraktsarkiv {salgData.length > 0 && <span style={{ color: '#667eea', fontSize: '0.8em' }}>({getFilteredSalgData().length} av {salgData.length})</span>}</h3>
                  <p className="content-subtitle">Fullstendig oversikt over alle kontrakter</p>
                </div>

                {loadingSalg ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster salg data...
                  </p>
                ) : salgData.length > 0 ? (
                  <>
                    {/* Filter Panel */}
                    <div className="filter-panel">
                      <div className="filter-group">
                        <label>Selger:</label>
                        <select
                          value={filters.selger}
                          onChange={(e) => setFilters({ ...filters, selger: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.selger).filter(Boolean))].sort().map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-group">
                        <label>Avdeling:</label>
                        <select
                          value={filters.avdeling}
                          onChange={(e) => setFilters({ ...filters, avdeling: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.avdeling).filter(Boolean))].sort().map((avd) => (
                            <option key={avd} value={avd}>{avd}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-group">
                        <label>Produkt:</label>
                        <select
                          value={filters.produkt}
                          onChange={(e) => setFilters({ ...filters, produkt: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.produkt).filter(Boolean))].sort().map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-group">
                        <label>Plattform:</label>
                        <select
                          value={filters.platform}
                          onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {[...new Set(salgData.map(r => r.platform).filter(Boolean))].sort().map((pl) => (
                            <option key={pl} value={pl}>{pl}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-group">
                        <label>Dato fra:</label>
                        <input
                          type="date"
                          value={filters.datoFrom}
                          onChange={(e) => setFilters({ ...filters, datoFrom: e.target.value })}
                          className="filter-input"
                        />
                      </div>

                      <div className="filter-group">
                        <label>Dato til:</label>
                        <input
                          type="date"
                          value={filters.datoTo}
                          onChange={(e) => setFilters({ ...filters, datoTo: e.target.value })}
                          className="filter-input"
                        />
                      </div>

                      <div className="filter-actions">
                        <button
                          className="filter-search"
                          onClick={handleSearch}
                        >
                          🔍 Søk
                        </button>
                        <button
                          className="filter-reset"
                          onClick={handleResetFilters}
                        >
                          🔄 Nullstill
                        </button>
                      </div>
                    </div>

                    {/* Data Table */}
                    <div className="sales-table">
                      <div className="table-header">
                        <div className="col-dato">Ordredato</div>
                        <div className="col-id">Id</div>
                        <div className="col-kunde">Kundenummer</div>
                        <div className="col-produkt">Produkter</div>
                        <div className="col-selger">Selger</div>
                        <div className="col-avdeling">Avdeling</div>
                        <div className="col-platform">Plattform</div>
                      </div>
                      {getFilteredSalgData().map((row) => (
                        <div key={row.id} className="table-row">
                          <div className="col-dato">{row.dato || '-'}</div>
                          <div className="col-id">{row.csvId || '-'}</div>
                          <div className="col-kunde">{row.kundeNr}</div>
                          <div className="col-produkt">{row.produkt || '-'}</div>
                          <div className="col-selger">{row.selger || '-'}</div>
                          <div className="col-avdeling">{row.avdeling || 'Ukjent'}</div>
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

            {/* ANGRING Tab */}
            {activeAllenteTab === 'angring' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Angringer {angringerData.length > 0 && <span style={{ color: '#667eea', fontSize: '0.8em' }}>({getFilteredAngringerData().length} av {angringerData.length})</span>}</h3>
                  <p className="content-subtitle">Oversikt over alle angringer</p>
                </div>

                {loadingAngringer ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster angringer...
                  </p>
                ) : angringerData.length > 0 ? (
                  <>
                    <button
                      className="upload-btn"
                      onClick={() => setUploadModal({ isOpen: true, fileType: 'angring' })}
                      style={{
                        marginBottom: '1.5rem',
                        padding: '0.75rem 1.5rem',
                        background: '#C86D4D',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      📤 Last opp Angringer
                    </button>

                    {/* Filter Panel */}
                    <div className="filter-panel">
                      <div className="filter-group">
                        <label>Filnavn:</label>
                        <select
                          value={angringerFilters.filnavn}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, filnavn: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.filename))).sort().map(fn => (
                            <option key={fn} value={fn}>{fn}</option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-group">
                        <label>Selger:</label>
                        <select
                          value={angringerFilters.selger}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, selger: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.selger))).sort().map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-group">
                        <label>Produkt:</label>
                        <select
                          value={angringerFilters.produkt}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, produkt: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.produkt))).sort().map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="filter-group">
                        <label>Plattform:</label>
                        <select
                          value={angringerFilters.plattform}
                          onChange={(e) => setAngringerFilters({ ...angringerFilters, plattform: e.target.value })}
                          className="filter-select"
                        >
                          <option value="">Alle</option>
                          {Array.from(new Set(angringerData.map(r => r.plattform))).sort().map(pl => (
                            <option key={pl} value={pl}>{pl}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          setActiveAngringerFilters(angringerFilters);
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        🔍 Søk
                      </button>
                      <button
                        onClick={() => {
                          setAngringerFilters({
                            filnavn: '',
                            kundenummer: '',
                            produkt: '',
                            selger: '',
                            periode: '',
                            plattform: '',
                          });
                          setActiveAngringerFilters({
                            filnavn: '',
                            kundenummer: '',
                            produkt: '',
                            selger: '',
                            periode: '',
                            plattform: '',
                          });
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#999',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        🔄 Nullstill
                      </button>
                    </div>

                    <div className="angringer-table">
                      <div className="table-header">
                        <div className="col-filename">Filnavn</div>
                        <div className="col-kundenr">Kundenummer</div>
                        <div className="col-product">Produkt</div>
                        <div className="col-selger">Selger</div>
                        <div className="col-salesdate">Salgsdato</div>
                        <div className="col-regretdate">Avbrytelsesdato</div>
                        <div className="col-period">Periode (dager)</div>
                        <div className="col-category">Plattform</div>
                      </div>
                      {getFilteredAngringerData().map((record, idx) => (
                        <div key={idx} className="table-row">
                          <div className="col-filename">{record.filename || '-'}</div>
                          <div className="col-kundenr">{record.kundenummer || '-'}</div>
                          <div className="col-product">{record.produkt || '-'}</div>
                          <div className="col-selger">{record.selger || '-'}</div>
                          <div className="col-salesdate">{record.salesdate || '-'}</div>
                          <div className="col-regretdate">{record.regretdate || '-'}</div>
                          <div className="col-period">{record.period || 0}</div>
                          <div className="col-category">{record.plattform || '-'}</div>
                        </div>
                      ))}
                    </div>

                    <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                      {angringerData.length > 0 && <span style={{ color: '#667eea', fontSize: '0.95em', fontWeight: '600' }}>({getFilteredAngringerData().length} av {angringerData.length})</span>}
                    </p>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen angringer funnet. Last opp en CSV/Excel fil for å komme i gang.
                  </p>
                )}
              </div>
            )}

            {/* PROGRESJON Tab */}
            {activeAllenteTab === 'progresjon' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Progresjon</h3>
                  <p className="content-subtitle">Salgs oversikt per selger</p>
                </div>

                {loadingProgresjon ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster progresjon data...
                  </p>
                ) : progresjonData.length > 0 ? (
                  <div className="progresjon-table">
                    <div className="table-header">
                      <div className="col-selger">Ekstern Navn</div>
                      <div className="col-week">Uke</div>
                      <div className="col-month">Måned</div>
                      <div className="col-total">Totalt</div>
                      <div className="col-best-week">Best Uke</div>
                      <div className="col-best-month">Best Måned</div>
                    </div>
                    {progresjonData.map((row, idx) => (
                      <div key={idx} className="table-row">
                        <div className="col-selger">{row.selger}</div>
                        <div className="col-week" style={{ textAlign: 'center', fontWeight: '600', color: '#667eea' }}>
                          {row.week}
                        </div>
                        <div className="col-month" style={{ textAlign: 'center', fontWeight: '600', color: '#667eea' }}>
                          {row.month}
                        </div>
                        <div className="col-total" style={{ textAlign: 'center', fontWeight: '600', color: '#764ba2' }}>
                          {row.total}
                        </div>
                        <div className="col-best-week" style={{ textAlign: 'center', fontWeight: '600', color: '#10b981' }}>
                          {row.bestWeek}
                        </div>
                        <div className="col-best-month" style={{ textAlign: 'center', fontWeight: '600', color: '#10b981' }}>
                          {row.bestMonth}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen data tilgjengelig.
                  </p>
                )}
              </div>
            )}

            {/* BADGES Tab */}
            {activeAllenteTab === 'badges' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Badges</h3>
                  <p className="content-subtitle">Administrer badge verdier og beskrivelser</p>
                </div>

                {loadingBadges ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster badges...
                  </p>
                ) : badgesData.length > 0 ? (
                  <>
                    <div className="badges-table">
                      <div className="table-header">
                        <div className="col-emoji">Emoji</div>
                        <div className="col-navn">Navn</div>
                        <div className="col-verdi">Verdi</div>
                        <div className="col-beskrivelse">Beskrivelse</div>
                      </div>
                      {badgesData.map((badge, idx) => (
                        <div key={idx} className="table-row">
                          <div className="col-emoji" style={{ fontSize: '2rem', textAlign: 'center' }}>
                            {badge.emoji}
                          </div>
                          <div className="col-navn">
                            <input
                              type="text"
                              value={badge.navn || ''}
                              onChange={(e) => {
                                const updated = [...badgesData];
                                updated[idx].navn = e.target.value;
                                setBadgesData(updated);
                              }}
                              placeholder="f.eks King"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <div className="col-verdi">
                            <input
                              type="text"
                              value={badge.verdi || ''}
                              onChange={(e) => {
                                const updated = [...badgesData];
                                updated[idx].verdi = e.target.value;
                                setBadgesData(updated);
                              }}
                              placeholder="f.eks 100 poeng"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <div className="col-beskrivelse">
                            <input
                              type="text"
                              value={badge.beskrivelse || ''}
                              onChange={(e) => {
                                const updated = [...badgesData];
                                updated[idx].beskrivelse = e.target.value;
                                setBadgesData(updated);
                              }}
                              placeholder="Hva betyr denne badge?"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSaveBadges}
                      style={{
                        marginTop: '1.5rem',
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      💾 Lagre alle badges
                    </button>

                    <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                      Total: {badgesData.length} badges
                    </p>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen badges funnet.
                  </p>
                )}
              </div>
            )}

            {/* PRODUKT Tab */}
            {activeAllenteTab === 'produkt' && (
              <div className="tab-content">
                <div className="content-title">
                  <h3>Produkter</h3>
                  <p className="content-subtitle">Administrer CPO og Provisjon per produkt</p>
                </div>

                {loadingProdukter ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Laster produkter...
                  </p>
                ) : produkterData.length > 0 ? (
                  <>
                    <div className="produkter-table">
                      <div className="table-header">
                        <div className="col-produktnavn">Produkt</div>
                        <div className="col-cpo">CPO</div>
                        <div className="col-provisjon">Provisjon</div>
                      </div>
                      {produkterData.map((produkt, idx) => (
                        <div key={idx} className="table-row">
                          <div className="col-produktnavn">{produkt.navn}</div>
                          <div className="col-cpo">
                            <input
                              type="text"
                              value={produkt.cpo || ''}
                              onChange={(e) => {
                                const updated = [...produkterData];
                                updated[idx].cpo = e.target.value;
                                setProdukterData(updated);
                              }}
                              placeholder="f.eks 500 eller 5%"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <div className="col-provisjon">
                            <input
                              type="text"
                              value={produkt.provisjon || ''}
                              onChange={(e) => {
                                const updated = [...produkterData];
                                updated[idx].provisjon = e.target.value;
                                setProdukterData(updated);
                              }}
                              placeholder="f.eks 10% eller 1500"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSaveProdukter}
                      style={{
                        marginTop: '1.5rem',
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      💾 Lagre alle produkter
                    </button>

                    <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                      Total: {produkterData.length} produkter (fra {salgData.length} kontrakter)
                    </p>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                    Ingen produkter funnet. Hent kontrakter først under SALG-tabell.
                  </p>
                )}
              </div>
            )}

            {/* Other tabs placeholder */}
            {activeAllenteTab !== 'i-dag' && activeAllenteTab !== 'salg' && activeAllenteTab !== 'angring' && activeAllenteTab !== 'produkt' && activeAllenteTab !== 'badges' && activeAllenteTab !== 'progresjon' && (
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
                <button 
                  className="add-employee-btn"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    marginBottom: '1.5rem',
                    padding: '0.75rem 1.5rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  ➕ Legg til ansatt
                </button>

                <div className="employees-table">
                  <div className="table-header">
                    <div className="col-name">Navn</div>
                    <div className="col-role">Rolle</div>
                    <div className="col-project">Prosjekt</div>
                    <div className="col-dept">Avdeling</div>
                    <div className="col-slack">Slack Navn</div>
                    <div className="col-external">Ekstern Navn</div>
                    <div className="col-tmg">TMG Navn</div>
                    <div className="col-actions">Handlinger</div>
                  </div>
                  {employees.map((emp) => (
                    <div key={emp.id} className="table-row">
                      <div className="col-name">{emp.name}</div>
                      <div className="col-role">{emp.role || '-'}</div>
                      <div className="col-project">{emp.project || '-'}</div>
                      <div className="col-dept">{emp.department || '-'}</div>
                      <div className="col-slack">{emp.slackName || '-'}</div>
                      <div className="col-external">{emp.externalName || '-'}</div>
                      <div className="col-tmg">{emp.tmgName || '-'}</div>
                      <div className="col-actions">
                        <button 
                          className="action-btn edit-btn"
                          onClick={() => handleEditClick(emp)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem 0.5rem' }}
                          title="Rediger"
                        >
                          ✏️
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteClick(emp.id, emp.name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                          title="Slett"
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

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <h2>Rediger ansatt</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>Navn *</label>
                <input 
                  type="text"
                  value={editingEmployee.name || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select 
                  value={editingEmployee.role || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                >
                  <option value="">Velg rolle</option>
                  <option value="owner">Owner</option>
                  <option value="teamlead">Teamlead</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prosjekt</label>
                <input 
                  type="text"
                  value={editingEmployee.project || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, project: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Avdeling</label>
                <select 
                  value={editingEmployee.department || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                >
                  <option value="">Velg avdeling</option>
                  <option value="OSL">OSL</option>
                  <option value="KRS">KRS</option>
                  <option value="Skien">Skien</option>
                  <option value="MUON">MUON</option>
                </select>
              </div>
              <div className="form-group">
                <label>Slack Navn</label>
                <input 
                  type="text"
                  value={editingEmployee.slackName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, slackName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Ekstern Navn *</label>
                <input 
                  type="text"
                  placeholder='f.eks "Mats / selger"'
                  value={editingEmployee.externalName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, externalName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>TMG Navn</label>
                <input 
                  type="text"
                  value={editingEmployee.tmgName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, tmgName: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEmployee(null);
                }}
              >
                Avbryt
              </button>
              <button 
                className="modal-btn save-btn"
                onClick={handleSaveEdit}
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <h2>Legg til ansatt</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>Navn *</label>
                <input 
                  type="text"
                  value={newEmployee.name || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  placeholder="Fullt navn"
                />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select 
                  value={newEmployee.role || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                >
                  <option value="">Velg rolle</option>
                  <option value="owner">Owner</option>
                  <option value="teamlead">Teamlead</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prosjekt</label>
                <input 
                  type="text"
                  value={newEmployee.project || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, project: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Avdeling</label>
                <select 
                  value={newEmployee.department || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                >
                  <option value="">Velg avdeling</option>
                  <option value="OSL">OSL</option>
                  <option value="KRS">KRS</option>
                  <option value="Skien">Skien</option>
                  <option value="MUON">MUON</option>
                </select>
              </div>
              <div className="form-group">
                <label>Slack Navn</label>
                <input 
                  type="text"
                  value={newEmployee.slackName || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, slackName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Ekstern Navn *</label>
                <input 
                  type="text"
                  placeholder='f.eks "Mats / selger"'
                  value={newEmployee.externalName || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, externalName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>TMG Navn</label>
                <input 
                  type="text"
                  value={newEmployee.tmgName || ''}
                  onChange={(e) => setNewEmployee({ ...newEmployee, tmgName: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={() => {
                  setShowAddModal(false);
                  setNewEmployee({
                    name: '',
                    role: 'employee',
                    project: '',
                    department: 'OSL',
                    slackName: '',
                    externalName: '',
                    tmgName: '',
                  });
                }}
              >
                Avbryt
              </button>
              <button 
                className="modal-btn save-btn"
                onClick={handleSaveAdd}
              >
                Legg til
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
