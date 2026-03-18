import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import FileUploadModal from '../components/FileUploadModal';
import '../styles/AdminDashboard.css';

interface Employee {
  id: string;
  name: string;
  email?: string;
  username?: string;
  password?: string;
  department?: string;
  role?: string;
  project?: string;
  slackName?: string;
  externalName?: string;
  tmgName?: string;
  stilling?: string;
  ansattnummer?: string;
}

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const muonParam = searchParams.get('muon');
  const location = useLocation();
  
  // ===== PEOPLE STATE =====
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const employeesCache = React.useRef<Employee[] | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; employeeId?: string; employeeName?: string }>({ show: false });
  const [deleting, setDeleting] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    project: 'Allente',
    stilling: 'Fulltid',
    department: 'OSL',
    slackName: '',
    externalName: '',
    tmgName: '',
  });

  // ===== PRODUKT STATE =====
  const [produkterData, setProdukterData] = useState<any[]>([]);
  const [loadingProdukter, setLoadingProdukter] = useState(false);
  const produkterCache = React.useRef<any[] | null>(null);

  // ===== WAR ROOM STATE =====
  const [warRoomTab, setWarRoomTab] = useState('salg');
  
  // SALG
  const [salgData, setSalgData] = useState<any[]>([]);
  const [loadingSalg, setLoadingSalg] = useState(false);
  const [salgFilters, setSalgFilters] = useState({
    selger: '',
    avdeling: '',
    produkt: '',
    platform: '',
    kundenummer: '',
    datoFrom: '',
    datoTo: '',
  });

  // ANGER
  const [angerData, setAngerData] = useState<any[]>([]);
  const [loadingAnger, setLoadingAnger] = useState(false);
  const angerCache = React.useRef<any[] | null>(null);

  // PROGRESJON
  const [progresjonData, setProgresjonData] = useState<any[]>([]);
  const [loadingProgresjon, setLoadingProgresjon] = useState(false);
  const progresjonCache = React.useRef<any[] | null>(null);

  // BADGES
  const [badgesData, setBadgesData] = useState<any[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const badgesCache = React.useRef<any[] | null>(null);

  // UPLOAD
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; fileType?: 'salg' | 'stats' | 'angring' }>({ isOpen: false });

  // ===== FETCH EMPLOYEES =====
  const fetchEmployees = async () => {
    if (employeesCache.current && employeesCache.current.length > 0) {
      setEmployees(employeesCache.current);
      setLoadingEmployees(false);
    } else {
      setLoadingEmployees(true);
    }

    try {
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      
      const employeeList: Employee[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.archived) return;
        
        employeeList.push({
          id: doc.id,
          name: data.name || 'N/A',
          email: data.email,
          username: data.username,
          password: data.password,
          department: data.department,
          role: data.role,
          project: data.project,
          slackName: data.slackName,
          externalName: data.externalName,
          tmgName: data.tmgName,
          stilling: data.stilling,
        });
      });
      
      const sortedEmployees = employeeList.sort((a, b) => a.name.localeCompare(b.name));
      employeesCache.current = sortedEmployees;
      setEmployees(sortedEmployees);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // ===== FETCH SALG (WAR ROOM) =====
  const fetchSalg = async () => {
    setLoadingSalg(true);

    try {
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const snapshot = await getDocs(contractsRef);
      
      const salgList: any[] = [];
      snapshot.forEach((doc) => {
        salgList.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setSalgData(salgList);
    } catch (err) {
      console.error('Error fetching salg:', err);
    } finally {
      setLoadingSalg(false);
    }
  };

  // ===== FETCH ANGER =====
  const fetchAnger = async () => {
    if (angerCache.current && angerCache.current.length > 0) {
      setAngerData(angerCache.current);
      setLoadingAnger(false);
    } else {
      setLoadingAnger(true);
    }

    try {
      const angerRef = collection(db, 'allente_anger');
      const snapshot = await getDocs(angerRef);
      
      const angerList: any[] = [];
      snapshot.forEach((doc) => {
        angerList.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      angerCache.current = angerList;
      setAngerData(angerList);
    } catch (err) {
      console.error('Error fetching anger:', err);
    } finally {
      setLoadingAnger(false);
    }
  };

  // ===== FETCH BADGES =====
  const fetchBadges = async () => {
    if (badgesCache.current && badgesCache.current.length > 0) {
      setBadgesData(badgesCache.current);
      setLoadingBadges(false);
    } else {
      setLoadingBadges(true);
    }

    try {
      const badgesRef = collection(db, 'allente_badges');
      const snapshot = await getDocs(badgesRef);
      
      const badgesList: any[] = [];
      snapshot.forEach((doc) => {
        badgesList.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      const sorted = badgesList.sort((a, b) => {
        // Badges med navn kommer først
        const aHasName = a.navn && a.navn.trim().length > 0 ? 1 : 0;
        const bHasName = b.navn && b.navn.trim().length > 0 ? 1 : 0;
        
        if (aHasName !== bHasName) {
          return bHasName - aHasName; // Med navn først (1 > 0)
        }
        
        // Innenfor samme gruppe, sorter etter ID
        const aIndex = parseInt(a.id) || 999;
        const bIndex = parseInt(b.id) || 999;
        return aIndex - bIndex;
      });

      badgesCache.current = sorted;
      setBadgesData(sorted);
    } catch (err) {
      console.error('Error fetching badges:', err);
    } finally {
      setLoadingBadges(false);
    }
  };

  // ===== SAVE BADGES =====
  const handleSaveBadges = async () => {
    try {
      for (const badge of badgesData) {
        if (badge.emoji) {
          const badgeRef = doc(db, 'allente_badges', badge.id || badge.emoji);
          await setDoc(badgeRef, {
            emoji: badge.emoji,
            navn: badge.navn || '',
            verdi: badge.verdi || '',
            beskrivelse: badge.beskrivelse || '',
          }, { merge: true });
        }
      }
      console.log('✅ Badges saved!');
    } catch (err) {
      console.error('Error saving badges:', err);
    }
  };

  // ===== HANDLE FILE UPLOAD =====
  const handleFileUpload = async () => {
    // Auto-refresh the current view with fresh data
    if (warRoomTab === 'salg') {
      fetchSalg();
    }
  };

  // ===== FETCH PROGRESJON =====
  const fetchProgresjon = async () => {
    if (progresjonCache.current && progresjonCache.current.length > 0) {
      setProgresjonData(progresjonCache.current);
      setLoadingProgresjon(false);
    } else {
      setLoadingProgresjon(true);
    }

    try {
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const snapshot = await getDocs(contractsRef);
      
      const contracts: any[] = [];
      snapshot.forEach((doc) => {
        contracts.push(doc.data());
      });

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const sellerStats: { [key: string]: any } = {};
      
      contracts.forEach((data) => {
        const ansatt = data.selger || 'Ukjent';
        if (!sellerStats[ansatt]) {
          sellerStats[ansatt] = { 
            btv_today: 0, 
            dth_today: 0, 
            free_today: 0,
            total_week: 0, 
            total_month: 0,
            free_month: 0,
            best_day: 0,
            best_week: 0,
            best_month: 0,
            badges: 0,
          };
        }

        const orderedateStr = data.dato || '';
        const produkt = (data.produkt || '').toLowerCase();
        
        if (orderedateStr && typeof orderedateStr === 'string') {
          const parts = orderedateStr.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            const orderDate = new Date(year, month - 1, day);

            // Today counts
            if (orderDate >= startOfDay && orderDate < endOfDay) {
              if (produkt.includes('btv')) {
                sellerStats[ansatt].btv_today++;
              } else if (produkt.includes('dth')) {
                sellerStats[ansatt].dth_today++;
              } else if (produkt.includes('free dekoder') || produkt.includes('free')) {
                sellerStats[ansatt].free_today++;
              }
            }

            // Month counts
            if (orderDate >= startOfMonth && orderDate <= today) {
              sellerStats[ansatt].total_month++;
              if (produkt.includes('free dekoder') || produkt.includes('free')) {
                sellerStats[ansatt].free_month++;
              }
            }

            // Week counts
            if (orderDate >= startOfWeek && orderDate <= today) {
              sellerStats[ansatt].total_week++;
            }
          }
        }
      });

      const progresjonList = Object.entries(sellerStats)
        .map(([ansatt, stats]) => ({
          ansatt,
          ...stats,
        }))
        .sort((a, b) => b.total_week - a.total_week); // Sort by week total

      progresjonCache.current = progresjonList;
      setProgresjonData(progresjonList);
    } catch (err) {
      console.error('Error fetching progresjon:', err);
    } finally {
      setLoadingProgresjon(false);
    }
  };

  // ===== FETCH PRODUKTER =====
  const fetchProdukter = async () => {
    if (produkterCache.current && produkterCache.current.length > 0) {
      setProdukterData(produkterCache.current);
      setLoadingProdukter(false);
    } else {
      setLoadingProdukter(true);
    }

    try {
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const contractsSnapshot = await getDocs(contractsRef);
      const produkterMap = new Map<string, any>();
      
      contractsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const produkt = data.produkt || '';
        const plattform = data.platform || 'Ukjent';
        const key = `${produkt}|${plattform}`;
        
        if (produkt.trim() && !produkterMap.has(key)) {
          produkterMap.set(key, {
            navn: produkt,
            plattform: plattform,
            cpo: '',
            provisjon: '',
            tilstand: 'Aktiv',
          });
        }
      });

      const cpoRef = collection(db, 'allente_produkter');
      const cpoSnapshot = await getDocs(cpoRef);
      
      cpoSnapshot.forEach((doc) => {
        const data = doc.data();
        produkterMap.forEach((value) => {
          if (value.navn === data.navn) {
            value.cpo = data.cpo || '';
            value.provisjon = data.provisjon || '';
            value.tilstand = data.tilstand || 'Aktiv';
          }
        });
      });

      const products = Array.from(produkterMap.values()).sort((a, b) => {
        if (a.tilstand !== b.tilstand) {
          return a.tilstand === 'Aktiv' ? -1 : 1;
        }
        if (a.navn !== b.navn) {
          return a.navn.localeCompare(b.navn);
        }
        return a.plattform.localeCompare(b.plattform);
      });

      produkterCache.current = products;
      setProdukterData(products);
    } catch (err) {
      console.error('Error fetching produkter:', err);
    } finally {
      setLoadingProdukter(false);
    }
  };

  // ===== SAVE PRODUKTER =====
  const handleSaveProdukter = async () => {
    try {
      const cpoRef = collection(db, 'allente_produkter');
      
      for (const produkt of produkterData) {
        const snapshot = await getDocs(cpoRef);
        
        let found = false;
        for (const doc of snapshot.docs) {
          if (doc.data().navn === produkt.navn) {
            await updateDoc(doc.ref, {
              cpo: produkt.cpo || '',
              provisjon: produkt.provisjon || '',
              tilstand: produkt.tilstand || 'Aktiv',
            });
            found = true;
            break;
          }
        }
        
        if (!found) {
          await addDoc(cpoRef, {
            navn: produkt.navn,
            cpo: produkt.cpo || '',
            provisjon: produkt.provisjon || '',
            tilstand: produkt.tilstand || 'Aktiv',
          });
        }
      }
      
      console.log('✅ Produkter saved!');
    } catch (err) {
      console.error('Error saving produkter:', err);
    }
  };

  // ===== EMPLOYEE HANDLERS =====
  const handleEditClick = (emp: Employee) => {
    setEditingEmployee({ ...emp });
    setShowEditModal(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ show: true, employeeId: id, employeeName: name });
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.employeeId) return;
    setDeleting(true);
    try {
      await updateDoc(doc(db, 'employees', deleteConfirm.employeeId), { archived: true });
      setEmployees(employees.filter(e => e.id !== deleteConfirm.employeeId));
      setDeleteConfirm({ show: false });
    } catch (err) {
      console.error('Error archiving employee:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee.name.trim()) return;
    try {
      await updateDoc(doc(db, 'employees', editingEmployee.id), {
        name: editingEmployee.name,
        email: editingEmployee.email,
        password: editingEmployee.password,
        role: editingEmployee.role,
        project: editingEmployee.project,
        department: editingEmployee.department,
        slackName: editingEmployee.slackName,
        externalName: editingEmployee.externalName,
        tmgName: editingEmployee.tmgName,
        stilling: editingEmployee.stilling,
      });
      setEmployees(employees.map(e => e.id === editingEmployee.id ? editingEmployee : e));
      setShowEditModal(false);
      setEditingEmployee(null);
    } catch (err) {
      console.error('Error saving employee:', err);
    }
  };

  const handleSaveAdd = async () => {
    if (!newEmployee.name.trim() || !newEmployee.password.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'employees'), newEmployee);
      setEmployees([...employees, { id: docRef.id, ...newEmployee }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        project: 'Allente',
        stilling: 'Fulltid',
        department: 'OSL',
        slackName: '',
        externalName: '',
        tmgName: '',
      });
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding employee:', err);
    }
  };

  // ===== USEEFFECTS =====
  useEffect(() => {
    if (muonParam === 'people') {
      fetchEmployees();
    }
  }, [muonParam]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const subParam = params.get('sub');
    
    if (subParam === 'produkt') {
      fetchProdukter();
    }
    
    if (subParam === 'warroom') {
      // Set initial tab on first load
      if (warRoomTab === 'salg') fetchSalg();
    }
  }, [location.search]);

  // Fetch data when War Room tab changes
  useEffect(() => {
    if (warRoomTab === 'salg') fetchSalg();
    if (warRoomTab === 'anger') fetchAnger();
    if (warRoomTab === 'progresjon') fetchProgresjon();
  }, [warRoomTab]);

  // Fetch Badges
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('sub') === 'badges') {
      fetchBadges();
    }
  }, [location.search]);

  return (
    <div className="admin-dashboard-container">
      <div className="admin-content">
        
        {/* ===== PEOPLE VIEW ===== */}
        {muonParam === 'people' && (
          <div className="tab-content" style={{ marginLeft: '135px', paddingLeft: '0px', paddingRight: '10px', paddingTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 'calc(100% - 145px)' }}>
            {loadingEmployees ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Laster ansatte...</p>
            ) : (
              <>
                {/* Statistics Cards */}
                <div style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ background: '#667eea', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>TOTALT</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.length}</p>
                  </div>
                  <div style={{ background: '#10b981', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>KRS</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.filter(e => e.department === 'KRS').length}</p>
                  </div>
                  <div style={{ background: '#f59e0b', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>SKIEN</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.filter(e => e.department === 'Skien').length}</p>
                  </div>
                  <div style={{ background: '#3b82f6', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', opacity: 0.9 }}>OSL</p>
                    <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>{employees.filter(e => e.department === 'OSL').length}</p>
                  </div>
                </div>

                {/* Search + Add Button */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', width: '100%' }}>
                  <input
                    type="text"
                    placeholder="Søk etter navn eller e-post..."
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      color: '#333',
                      boxSizing: 'border-box',
                      backgroundColor: '#fff',
                    }}
                  />
                  <button 
                    onClick={() => setShowAddModal(true)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ➕ Legg til Ansatt
                  </button>
                </div>

                {/* Employee Table */}
                <div style={{ width: '100%', marginBottom: '1rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Navn</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>E-post</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Rolle</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Prosjekt</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Avdeling</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>TMG-navn</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Stilling</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Ekstern navn</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Min Side</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700' }}>Handlinger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees
                        .filter(emp => emp.name?.toLowerCase().includes(employeeSearchQuery.toLowerCase()) || emp.email?.toLowerCase().includes(employeeSearchQuery.toLowerCase()))
                        .map((emp) => (
                          <tr key={emp.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.75rem', fontWeight: '700' }}>{emp.name}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#4b5563' }}>{emp.email || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ background: emp.role === 'owner' ? '#a78bfa' : emp.role === 'teamleder' ? '#60a5fa' : '#34d399', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                                {emp.role === 'owner' ? 'eier' : emp.role === 'teamleder' ? 'teamleder' : 'selger'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{emp.project || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>{emp.department || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>{emp.tmgName || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>{emp.stilling || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>{emp.externalName || '-'}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <a href={`/min-side-preview?user=${emp.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}>
                                👁️ Se
                              </a>
                            </td>
                            <td style={{ padding: '0.75rem', display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                              <button onClick={() => handleEditClick(emp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', textDecoration: 'underline', padding: '0', fontWeight: '600' }}>Rediger</button>
                              <button onClick={() => handleDeleteClick(emp.id, emp.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', textDecoration: 'underline', padding: '0', fontWeight: '600' }}>Slett</button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== PRODUKT VIEW ===== */}
        {(() => {
          const params = new URLSearchParams(location.search);
          return params.get('sub') === 'produkt' && (
            <div className="tab-content" style={{ marginLeft: '135px', paddingLeft: '0px', paddingRight: '10px', paddingTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 'calc(100% - 145px)' }}>
              {loadingProdukter ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Laster produkter...</p>
              ) : produkterData.length > 0 ? (
                <>
                  <div style={{ width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                      <thead>
                        <tr style={{ background: 'transparent', borderBottom: '2px solid #4b5563' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#b0b0b0' }}>Produkt</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#b0b0b0' }}>Plattform</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#b0b0b0' }}>CPO</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#b0b0b0' }}>Provisjon</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#b0b0b0' }}>Tilstand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produkterData.map((produkt, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #4b5563', background: '#1f2937', color: '#e5e7eb' }}>
                            <td style={{ padding: '0.75rem', textAlign: 'left' }}>{produkt.navn}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#60a5fa' }}>{produkt.plattform}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <input
                                type="text"
                                value={produkt.cpo || ''}
                                onChange={(e) => {
                                  const updated = [...produkterData];
                                  updated[idx].cpo = e.target.value;
                                  setProdukterData(updated);
                                }}
                                placeholder="f.eks 500"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #4b5563',
                                  borderRadius: '4px',
                                  color: '#e2e8f0',
                                  backgroundColor: '#374151',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <input
                                type="text"
                                value={produkt.provisjon || ''}
                                onChange={(e) => {
                                  const updated = [...produkterData];
                                  updated[idx].provisjon = e.target.value;
                                  setProdukterData(updated);
                                }}
                                placeholder="f.eks 10%"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #4b5563',
                                  borderRadius: '4px',
                                  color: '#e2e8f0',
                                  backgroundColor: '#374151',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <select
                                value={produkt.tilstand || 'Aktiv'}
                                onChange={(e) => {
                                  const updated = [...produkterData];
                                  updated[idx].tilstand = e.target.value;
                                  setProdukterData(updated);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #4b5563',
                                  borderRadius: '4px',
                                  color: '#e2e8f0',
                                  backgroundColor: '#374151',
                                  boxSizing: 'border-box',
                                }}
                              >
                                <option value="Aktiv">Aktiv</option>
                                <option value="Pause">Pause</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                      fontSize: '0.95rem',
                    }}
                  >
                    💾 Lagre CPO, Provisjon & Tilstand
                  </button>

                  <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                    Viser {produkterData.length} unike Produkt + Plattform kombinasjoner
                  </p>
                </>
              ) : (
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Ingen produkter funnet</p>
              )}
            </div>
          );
        })()}

        {/* ===== UNIFIED WAR ROOM WITH TABS ===== */}
        {(() => {
          const params = new URLSearchParams(location.search);
          return params.get('sub') === 'warroom' && (
            <div className="tab-content" style={{ marginLeft: '135px', paddingLeft: '0px', paddingRight: '10px', paddingTop: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: 'calc(100% - 145px)' }}>
              
              {/* Tab Navigation */}
              <div style={{ width: '100%', display: 'flex', gap: '0.5rem', marginTop: '1.5rem', marginBottom: '0', paddingLeft: '1rem', borderBottom: 'none', flexWrap: 'wrap' }}>
                {['salg', 'anger', 'progresjon', 'upload-salg', 'upload-stats', 'upload-anger'].map((tab) => {
                  const tabLabels: { [key: string]: string } = { 
                    salg: 'Salg 🎯', 
                    anger: 'Anger 😤', 
                    progresjon: 'Progresjon 📈',
                    'upload-salg': 'Last opp Salg 📤',
                    'upload-stats': 'Last opp Stats 📊',
                    'upload-anger': 'Last opp Angring ↩️'
                  };
                  const isActive = warRoomTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setWarRoomTab(tab)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        borderBottom: isActive ? '3px solid #5a67d8' : 'none',
                        background: isActive ? '#5a67d8' : 'transparent',
                        color: isActive ? '#fff' : '#999',
                        fontWeight: isActive ? '700' : '600',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {tabLabels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* SALG TAB CONTENT */}
              {warRoomTab === 'salg' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {loadingSalg ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Laster salg data...</p>
                  ) : salgData.length > 0 ? (
                    <>
                      {/* Filter Panel */}
                      <div style={{ width: '100%', background: '#2d3748', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', marginTop: '0', maxWidth: '1200px', boxSizing: 'border-box' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: '#e2e8f0' }}>Filtrer resultater</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>Selger</label>
                            <select
                              value={salgFilters.selger}
                              onChange={(e) => setSalgFilters({ ...salgFilters, selger: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #4b5563',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: '#e2e8f0',
                                backgroundColor: '#374151',
                                boxSizing: 'border-box',
                              }}
                            >
                              <option value="">Alle</option>
                              {[...new Set(salgData.map((r: any) => r.selger).filter(Boolean))].sort().map((s: any) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>Avdeling</label>
                            <select
                              value={salgFilters.avdeling}
                              onChange={(e) => setSalgFilters({ ...salgFilters, avdeling: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #4b5563',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: '#e2e8f0',
                                backgroundColor: '#374151',
                                boxSizing: 'border-box',
                              }}
                            >
                              <option value="">Alle</option>
                              {[...new Set(salgData.map((r: any) => r.avdeling).filter(Boolean))].sort().map((a: any) => (
                                <option key={a} value={a}>{a}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>Produkt</label>
                            <select
                              value={salgFilters.produkt}
                              onChange={(e) => setSalgFilters({ ...salgFilters, produkt: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #4b5563',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: '#e2e8f0',
                                backgroundColor: '#374151',
                                boxSizing: 'border-box',
                              }}
                            >
                              <option value="">Alle</option>
                              {[...new Set(salgData.map((r: any) => r.produkt).filter(Boolean))].sort().map((p: any) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>Plattform</label>
                            <select
                              value={salgFilters.platform}
                              onChange={(e) => setSalgFilters({ ...salgFilters, platform: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #4b5563',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: '#e2e8f0',
                                backgroundColor: '#374151',
                                boxSizing: 'border-box',
                              }}
                            >
                              <option value="">Alle</option>
                              {[...new Set(salgData.map((r: any) => r.platform).filter(Boolean))].sort().map((pl: any) => (
                                <option key={pl} value={pl}>{pl}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>Kundenummer</label>
                            <input
                              type="text"
                              placeholder="Søk..."
                              value={salgFilters.kundenummer}
                              onChange={(e) => setSalgFilters({ ...salgFilters, kundenummer: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #4b5563',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: '#e2e8f0',
                                backgroundColor: '#374151',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>Dato fra</label>
                            <input
                              type="date"
                              value={salgFilters.datoFrom}
                              onChange={(e) => setSalgFilters({ ...salgFilters, datoFrom: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #4b5563',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: '#e2e8f0',
                                backgroundColor: '#374151',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>Dato til</label>
                            <input
                              type="date"
                              value={salgFilters.datoTo}
                              onChange={(e) => setSalgFilters({ ...salgFilters, datoTo: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #4b5563',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: '#e2e8f0',
                                backgroundColor: '#374151',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>

                          <div>
                            <button
                              onClick={() => setSalgFilters({ selger: '', avdeling: '', produkt: '', platform: '', kundenummer: '', datoFrom: '', datoTo: '' })}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                background: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                marginTop: '1.5rem',
                              }}
                            >
                              🔄 Nullstill
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Data Table */}
                      <div style={{ width: '100%', maxWidth: '1200px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'transparent', borderBottom: '2px solid #4b5563' }}>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Dato</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>ID</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Kundenummer</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Produkt</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Selger</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Avdeling</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Plattform</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const parseDate = (rawDate: string): string => {
                                let dateParts = rawDate.split('/');
                                if (dateParts.length !== 3) {
                                  dateParts = rawDate.split('.');
                                }
                                
                                if (dateParts.length === 3) {
                                  // ALWAYS assume DD/MM/YYYY format (Norwegian convention)
                                  const day = parseInt(dateParts[0]);
                                  const month = parseInt(dateParts[1]);
                                  const year = parseInt(dateParts[2]);
                                  
                                  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                }
                                return '';
                              };

                              const filtered = salgData
                                .filter((row: any) => {
                                  if (salgFilters.selger && row.selger !== salgFilters.selger) return false;
                                  if (salgFilters.avdeling && row.avdeling !== salgFilters.avdeling) return false;
                                  if (salgFilters.produkt && row.produkt !== salgFilters.produkt) return false;
                                  if (salgFilters.platform && row.platform !== salgFilters.platform) return false;
                                  if (salgFilters.kundenummer && !row.kundeNr?.toLowerCase().includes(salgFilters.kundenummer.toLowerCase())) return false;
                                  if (salgFilters.datoFrom || salgFilters.datoTo) {
                                    const rowDateISO = parseDate(row.dato || '');
                                    
                                    if (salgFilters.datoFrom && rowDateISO && rowDateISO < salgFilters.datoFrom) return false;
                                    if (salgFilters.datoTo && rowDateISO && rowDateISO > salgFilters.datoTo) return false;
                                  }
                                  return true;
                                })
                                .sort((a: any, b: any) => {
                                  // Sort by date descending (newest first)
                                  const dateA = parseDate(a.dato || '');
                                  const dateB = parseDate(b.dato || '');
                                  return dateB.localeCompare(dateA);
                                });
                              
                              return (
                                <>
                                  <tr style={{ background: '#2d3748', borderBottom: '1px solid #4b5563' }}>
                                    <td colSpan={7} style={{ padding: '0.75rem', textAlign: 'center', color: '#b0b0b0', fontSize: '0.85rem', fontWeight: '600' }}>
                                      📊 Resultater: {filtered.length} av {salgData.length}
                                    </td>
                                  </tr>
                                  {filtered.map((row: any) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid #4b5563', background: '#1f2937', color: '#e5e7eb' }}>
                                  <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{row.dato || '-'}</td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#60a5fa', fontWeight: '600' }}>{row.csvId || '-'}</td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{row.kundeNr || '-'}</td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{row.produkt || '-'}</td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{row.selger || '-'}</td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{row.avdeling || 'Ukjent'}</td>
                                  <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#4ade80' }}>{row.platform || '-'}</td>
                                </tr>
                              ))}
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>

                      <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem', maxWidth: '1200px', marginBottom: '1.5rem' }}>
                        Viser {salgData.filter((row: any) => {
                          if (salgFilters.selger && row.selger !== salgFilters.selger) return false;
                          if (salgFilters.avdeling && row.avdeling !== salgFilters.avdeling) return false;
                          if (salgFilters.produkt && row.produkt !== salgFilters.produkt) return false;
                          if (salgFilters.platform && row.platform !== salgFilters.platform) return false;
                          if (salgFilters.kundenummer && !row.kundeNr?.toLowerCase().includes(salgFilters.kundenummer.toLowerCase())) return false;
                          if (salgFilters.datoFrom || salgFilters.datoTo) {
                            const parseDate = (rawDate: string): string => {
                              let dateParts = rawDate.split('/');
                              if (dateParts.length !== 3) {
                                dateParts = rawDate.split('.');
                              }
                              
                              if (dateParts.length === 3) {
                                // ALWAYS assume DD/MM/YYYY format (Norwegian convention)
                                const day = parseInt(dateParts[0]);
                                const month = parseInt(dateParts[1]);
                                const year = parseInt(dateParts[2]);
                                
                                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              }
                              return '';
                            };
                            
                            const rowDateISO = parseDate(row.dato || '');
                            
                            if (salgFilters.datoFrom && rowDateISO && rowDateISO < salgFilters.datoFrom) return false;
                            if (salgFilters.datoTo && rowDateISO && rowDateISO > salgFilters.datoTo) return false;
                          }
                          return true;
                        }).length} av {salgData.length} kontrakter
                      </p>
                    </>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Ingen salg data funnet</p>
                  )}
                </div>
              )}

              {/* ANGER TAB CONTENT */}
              {warRoomTab === 'anger' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {loadingAnger ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Laster anger data...</p>
                  ) : angerData.length > 0 ? (
                    <div style={{ width: '100%', maxWidth: '1200px', overflowX: 'auto', marginTop: '1.5rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem' }}>Dato</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem' }}>Kundenummer</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem' }}>Beskrivelse</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {angerData.map((row: any) => (
                            <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{row.dato || '-'}</td>
                              <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#667eea', fontWeight: '600' }}>{row.kundeNr || '-'}</td>
                              <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{row.beskrivelse || row.description || '-'}</td>
                              <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                                <span style={{ background: row.status === 'Løst' ? '#d1fae5' : '#fecaca', color: row.status === 'Løst' ? '#059669' : '#dc2626', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                                  {row.status || 'Aktiv'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Ingen anger data funnet</p>
                  )}
                </div>
              )}

              {/* PROGRESJON TAB CONTENT */}
              {warRoomTab === 'progresjon' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#1a1a1a', marginLeft: '-10px', marginRight: '-10px', marginTop: '-10px', marginBottom: '-10px', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                  {loadingProgresjon ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: '2rem', width: '100%' }}>Laster progresjon data...</p>
                  ) : progresjonData.length > 0 ? (
                    <div style={{ width: '100%', overflowX: 'auto', background: '#1a1a1a' }}>
                      <table style={{ 
                        borderCollapse: 'collapse',
                        background: '#1a1a1a',
                        color: '#b0b0b0',
                        minWidth: '100%',
                      }}>
                        <thead>
                          {/* Group Header Row */}
                          <tr style={{ background: '#0d0d0d', borderBottom: '1px solid #404040' }}>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.65rem', color: '#a0a0a0', whiteSpace: 'nowrap' }}>Ansatt</th>
                            <th colSpan={3} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.65rem', color: '#a0a0a0', whiteSpace: 'nowrap', borderLeft: '1px solid #404040' }}>I dag</th>
                            <th colSpan={3} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.65rem', color: '#a0a0a0', whiteSpace: 'nowrap', borderLeft: '1px solid #404040' }}>Total</th>
                            <th colSpan={3} style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.65rem', color: '#a0a0a0', whiteSpace: 'nowrap', borderLeft: '1px solid #404040' }}>Rekorder</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.65rem', color: '#a0a0a0', whiteSpace: 'nowrap', borderLeft: '1px solid #404040' }}>Badges</th>
                          </tr>
                          {/* Column Header Row */}
                          <tr style={{ background: '#0d0d0d', borderBottom: '2px solid #404040' }}>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.75rem', color: '#d0d0d0', whiteSpace: 'nowrap' }}></th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#4db8ff', whiteSpace: 'nowrap' }}>BTV</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#ff6b6b', whiteSpace: 'nowrap' }}>DTH</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#51cf66', whiteSpace: 'nowrap' }}>Free box</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#ffd700', whiteSpace: 'nowrap' }}>Uke</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#ffd700', whiteSpace: 'nowrap' }}>Måned</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#ffd700', whiteSpace: 'nowrap' }}>Free box</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#b366ff', whiteSpace: 'nowrap' }}>Dag</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#b366ff', whiteSpace: 'nowrap' }}>Uke</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#b366ff', whiteSpace: 'nowrap' }}>Måned</th>
                            <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: '#ffaa00', whiteSpace: 'nowrap' }}>⭐</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progresjonData.map((row: any, idx: number) => (
                            <tr key={row.ansatt} style={{ background: idx % 2 === 0 ? '#1a1a1a' : '#252525', borderBottom: '1px solid #333333', color: '#b0b0b0' }}>
                              <td style={{ padding: '0.75rem', fontSize: '0.8rem', fontWeight: '600', color: '#e0e0e0', whiteSpace: 'nowrap' }}>{row.ansatt}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#4db8ff', whiteSpace: 'nowrap' }}>{row.btv_today}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#ff6b6b', whiteSpace: 'nowrap' }}>{row.dth_today}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#51cf66', whiteSpace: 'nowrap' }}>{row.free_today}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#ffd700', whiteSpace: 'nowrap' }}>{row.total_week}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#ffd700', whiteSpace: 'nowrap' }}>{row.total_month}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#51cf66', whiteSpace: 'nowrap' }}>{row.free_month}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#b366ff', whiteSpace: 'nowrap' }}>{row.best_day}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#b366ff', whiteSpace: 'nowrap' }}>{row.best_week}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#b366ff', whiteSpace: 'nowrap' }}>{row.best_month}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700', color: '#ffaa00', whiteSpace: 'nowrap' }}>⭐ {row.badges}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#999', padding: '2rem', width: '100%' }}>Ingen progresjon data funnet</p>
                  )}
                </div>
              )}

              {/* UPLOAD SALG TAB */}
              {warRoomTab === 'upload-salg' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
                  <button
                    onClick={() => setUploadModal({ isOpen: true, fileType: 'salg' })}
                    style={{
                      padding: '1rem 2rem',
                      background: '#5a67d8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    📤 Last opp Salg
                  </button>
                  <p style={{ marginTop: '1rem', color: '#999', fontSize: '0.9rem' }}>Velg CSV/Excel-fil med salgsdata</p>
                </div>
              )}

              {/* UPLOAD STATS TAB */}
              {warRoomTab === 'upload-stats' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
                  <button
                    onClick={() => setUploadModal({ isOpen: true, fileType: 'stats' })}
                    style={{
                      padding: '1rem 2rem',
                      background: '#5a67d8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    📊 Last opp Stats
                  </button>
                  <p style={{ marginTop: '1rem', color: '#999', fontSize: '0.9rem' }}>Velg CSV/Excel-fil med statistikk</p>
                </div>
              )}

              {/* UPLOAD ANGER TAB */}
              {warRoomTab === 'upload-anger' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
                  <button
                    onClick={() => setUploadModal({ isOpen: true, fileType: 'angring' })}
                    style={{
                      padding: '1rem 2rem',
                      background: '#5a67d8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    ↩️ Last opp Angring
                  </button>
                  <p style={{ marginTop: '1rem', color: '#999', fontSize: '0.9rem' }}>Velg CSV/Excel-fil med kanselleringer</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ===== BADGES ===== */}
        {(() => {
          const params = new URLSearchParams(location.search);
          return params.get('sub') === 'badges' && (
            <div style={{ marginLeft: '135px', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1.5rem', paddingBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'calc(100% - 145px)', background: '#1a1a1a', minHeight: '100vh' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '0.5rem' }}>🎖️ Badges</h2>
              <p style={{ fontSize: '0.95rem', color: '#b0b0b0', marginBottom: '1.5rem' }}>Administrer badge verdier og beskrivelser</p>

              {loadingBadges ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Laster badges...</p>
              ) : badgesData.length > 0 ? (
                <>
                  <div style={{ width: '100%', maxWidth: '1200px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a' }}>
                      <thead>
                        <tr style={{ background: 'transparent', borderBottom: '2px solid #4b5563' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0', width: '80px' }}>Emoji</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Navn</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Verdi</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', fontSize: '0.85rem', color: '#b0b0b0' }}>Beskrivelse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {badgesData.map((badge, idx) => (
                          <tr key={badge.id || idx} style={{ borderBottom: '1px solid #4b5563', background: '#1f2937', color: '#e5e7eb' }}>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '2rem' }}>{badge.emoji}</td>
                            <td style={{ padding: '0.75rem' }}>
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
                                  border: '1px solid #4b5563',
                                  borderRadius: '4px',
                                  background: '#374151',
                                  color: '#e2e8f0',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem' }}>
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
                                  border: '1px solid #4b5563',
                                  borderRadius: '4px',
                                  background: '#374151',
                                  color: '#e2e8f0',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem' }}>
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
                                  border: '1px solid #4b5563',
                                  borderRadius: '4px',
                                  background: '#374151',
                                  color: '#e2e8f0',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleSaveBadges}
                    style={{
                      marginTop: '1.5rem',
                      padding: '0.75rem 1.5rem',
                      background: '#5a67d8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                    }}
                  >
                    💾 Lagre badges
                  </button>

                  <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.9rem' }}>
                    Total: {badgesData.length} badges
                  </p>
                </>
              ) : (
                <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>Ingen badges funnet</p>
              )}
            </div>
          );
        })()}

        {/* ===== DEFAULT: COMING SOON ===== */}
        {!muonParam && (() => {
          const params = new URLSearchParams(location.search);
          const subParam = params.get('sub');
          return !subParam || (subParam !== 'produkt' && subParam !== 'warroom') ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#999' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#333' }}>Coming Soon 🚀</h2>
              <p style={{ fontSize: '1.1rem' }}>More admin features coming soon...</p>
            </div>
          ) : null;
        })()}
      </div>

      {/* ===== MODALS - DELETE EMPLOYEE ===== */}
      {deleteConfirm.show && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h2>Arkiver ansatt?</h2>
            <p>Er du sikker på at du vil arkiviere <strong>{deleteConfirm.employeeName}</strong>?</p>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={handleCancelDelete} disabled={deleting}>Avbryt</button>
              <button className="modal-btn delete-btn" onClick={handleConfirmDelete} disabled={deleting}>{deleting ? 'Arkiverer...' : 'Ja, arkiver'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALS - EDIT EMPLOYEE ===== */}
      {showEditModal && editingEmployee && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <h2>Rediger ansatt</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>Navn *</label>
                <input type="text" value={editingEmployee.name || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={editingEmployee.email || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })} placeholder="epost@bedrift.no" />
              </div>
              <div className="form-group">
                <label>Passord</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type={showEditPassword ? 'text' : 'password'} 
                    value={editingEmployee.password || ''} 
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, password: e.target.value })} 
                    placeholder="Sikker passord" 
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{
                      padding: '0.5rem 0.7rem',
                      background: 'transparent',
                      color: '#b0b0b0',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      transition: 'color 0.2s'
                    }}
                    title={showEditPassword ? 'Skjul passord' : 'Vis passord'}
                  >
                    {showEditPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const generatedPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
                      setEditingEmployee({ ...editingEmployee, password: generatedPassword });
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#5a67d8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Generer
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select value={editingEmployee.role || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}>
                  <option value="">Velg rolle</option>
                  <option value="owner">Eier</option>
                  <option value="teamleder">Teamleder</option>
                  <option value="senior">Senior</option>
                  <option value="junior">Junior</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prosjekt</label>
                <select value={editingEmployee.project || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, project: e.target.value })}>
                  <option value="">Velg prosjekt</option>
                  <option value="Allente">Allente</option>
                  <option value="Muon">Muon</option>
                </select>
              </div>
              <div className="form-group">
                <label>Avdeling</label>
                <select value={editingEmployee.department || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}>
                  <option value="">Velg avdeling</option>
                  <option value="OSL">OSL</option>
                  <option value="KRS">KRS</option>
                  <option value="Skien">Skien</option>
                </select>
              </div>
              <div className="form-group">
                <label>Ekstern Navn</label>
                <input type="text" value={editingEmployee.externalName || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, externalName: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={() => { 
                setShowEditModal(false); 
                setEditingEmployee(null); 
                setShowEditPassword(false);
              }}>Avbryt</button>
              <button className="modal-btn save-btn" onClick={handleSaveEdit}>Lagre</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALS - ADD EMPLOYEE ===== */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <h2>Legg til ansatt</h2>
            <div className="edit-form">
              <div className="form-group">
                <label>Navn *</label>
                <input type="text" value={newEmployee.name || ''} onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })} placeholder="Fullt navn" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={newEmployee.email || ''} onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })} placeholder="epost@bedrift.no" />
              </div>
              <div className="form-group">
                <label>Passord *</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type={showAddPassword ? 'text' : 'password'} 
                    value={newEmployee.password || ''} 
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })} 
                    placeholder="Sikker passord" 
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    style={{
                      padding: '0.5rem 0.7rem',
                      background: 'transparent',
                      color: '#b0b0b0',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      transition: 'color 0.2s'
                    }}
                    title={showAddPassword ? 'Skjul passord' : 'Vis passord'}
                  >
                    {showAddPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const generatedPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
                      setNewEmployee({ ...newEmployee, password: generatedPassword });
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#5a67d8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Generer
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select value={newEmployee.role || ''} onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}>
                  <option value="">Velg rolle</option>
                  <option value="owner">Eier</option>
                  <option value="teamleder">Teamleder</option>
                  <option value="senior">Senior</option>
                  <option value="junior">Junior</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prosjekt</label>
                <select value={newEmployee.project || ''} onChange={(e) => setNewEmployee({ ...newEmployee, project: e.target.value })}>
                  <option value="">Velg prosjekt</option>
                  <option value="Allente">Allente</option>
                  <option value="Muon">Muon</option>
                </select>
              </div>
              <div className="form-group">
                <label>Avdeling</label>
                <select value={newEmployee.department || ''} onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}>
                  <option value="">Velg avdeling</option>
                  <option value="OSL">OSL</option>
                  <option value="KRS">KRS</option>
                  <option value="Skien">Skien</option>
                </select>
              </div>
              <div className="form-group">
                <label>Ekstern Navn</label>
                <input type="text" value={newEmployee.externalName || ''} onChange={(e) => setNewEmployee({ ...newEmployee, externalName: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={() => {
                setShowAddModal(false);
                setShowAddPassword(false);
              }}>Avbryt</button>
              <button className="modal-btn save-btn" onClick={handleSaveAdd}>Lagre</button>
            </div>
          </div>
        </div>
      )}

      {/* FILE UPLOAD MODAL */}
      <FileUploadModal
        isOpen={uploadModal.isOpen}
        title={uploadModal.fileType === 'salg' ? '📤 Last opp Salg' : uploadModal.fileType === 'stats' ? '📊 Last opp Stats' : '↩️ Last opp Angring'}
        fileType={uploadModal.fileType || 'salg'}
        onClose={() => setUploadModal({ isOpen: false })}
        onUpload={handleFileUpload}
      />
    </div>
  );
}
