import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { db } from '../lib/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import '../styles/Teamleder.css';

export default function Teamleder() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('status');

  const isOwner = user?.role === 'owner';
  
  const [salesToday, setSalesToday] = useState(0);
  const [salesWeek, setSalesWeek] = useState(0);
  const [salesMonth, setSalesMonth] = useState(0);
  const monthlyTarget = 800;
  const [departmentData, setDepartmentData] = useState<any>({});
  const [targetData, setTargetData] = useState<any>({});
  const [topSellers, setTopSellers] = useState<any>([]);
  const [goals, setGoals] = useState<any>({
    KRS: { dag: '', uke: '', måned: '' },
    OSL: { dag: '', uke: '', måned: '' },
    Skien: { dag: '', uke: '', måned: '' },
  });

  // Load sales and target data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get all contracts
        const contractsRef = collection(db, 'allente_kontraktsarkiv');
        const contractsSnap = await getDocs(contractsRef);
        const contracts = contractsSnap.docs.map(doc => doc.data());

        // Get targets
        const targetsRef = collection(db, 'allente_targets');
        const targetsSnap = await getDocs(targetsRef);
        const targets: any = {};
        targetsSnap.forEach((doc) => {
          targets[doc.id] = doc.data();
        });
        setTargetData(targets);

        // Calculate today, this week, this month
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Filter and count
        const todaySales = contracts.filter(c => {
          const cDate = new Date(c.dato);
          return cDate.toDateString() === today.toDateString();
        }).length;

        const weekSales = contracts.filter(c => {
          const cDate = new Date(c.dato);
          return cDate >= weekStart && cDate <= today;
        }).length;

        const monthSales = contracts.filter(c => {
          const cDate = new Date(c.dato);
          return cDate >= monthStart && cDate <= today;
        }).length;

        setSalesToday(todaySales);
        setSalesWeek(weekSales);
        setSalesMonth(monthSales);

        // Calculate per department
        const deptMap: any = {};
        ['KRS', 'OSL', 'Skien'].forEach(dept => {
          const deptContracts = contracts.filter(c => c.avdeling === dept);
          
          const deptToday = deptContracts.filter(c => {
            const cDate = new Date(c.dato);
            return cDate.toDateString() === today.toDateString();
          }).length;

          const deptWeek = deptContracts.filter(c => {
            const cDate = new Date(c.dato);
            return cDate >= weekStart && cDate <= today;
          }).length;

          const deptMonth = deptContracts.filter(c => {
            const cDate = new Date(c.dato);
            return cDate >= monthStart && cDate <= today;
          }).length;

          deptMap[dept] = {
            today: deptToday,
            week: deptWeek,
            month: deptMonth,
            target: targets[dept] || {},
          };
        });
        setDepartmentData(deptMap);

        // Top 5 sellers
        const sellerMap: any = {};
        contracts.forEach(c => {
          const sellerKey = c.selger || 'Unknown';
          sellerMap[sellerKey] = (sellerMap[sellerKey] || 0) + 1;
        });

        const sellers = Object.entries(sellerMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => (b.count as any) - (a.count as any))
          .slice(0, 5)
          .map((s, idx) => ({ rank: idx + 1, name: s.name, value: s.count }));

        setTopSellers(sellers);
      } catch (err) {
        console.error('Error loading team data:', err);
      }
    };

    loadData();
  }, []);

  // Load goals when MÅL tab opens
  useEffect(() => {
    if (activeTab === 'mal') {
      loadGoals();
    }
  }, [activeTab]);

  const loadGoals = async () => {
    try {
      const targetsRef = collection(db, 'allente_targets');
      const targetsSnap = await getDocs(targetsRef);
      const loadedGoals: any = {
        KRS: { dag: '', uke: '', måned: '' },
        OSL: { dag: '', uke: '', måned: '' },
        Skien: { dag: '', uke: '', måned: '' },
      };

      targetsSnap.forEach((doc) => {
        const dept = doc.id;
        const data = doc.data();
        if (loadedGoals[dept]) {
          loadedGoals[dept] = {
            dag: data.dag || '',
            uke: data.uke || '',
            måned: data.måned || '',
          };
        }
      });

      setGoals(loadedGoals);
    } catch (err) {
      console.error('Error loading goals:', err);
    }
  };

  const saveGoals = async () => {
    try {
      for (const dept of ['KRS', 'OSL', 'Skien']) {
        await setDoc(doc(db, 'allente_targets', dept), {
          dag: goals[dept].dag || 0,
          uke: goals[dept].uke || 0,
          måned: goals[dept].måned || 0,
        });
      }
      alert('✅ Mål lagret!');
    } catch (err) {
      console.error('Error saving goals:', err);
      alert('❌ Feil ved lagring');
    }
  };

  // Mock KPI data structure
  const kpis = [
    { label: 'I DAG', value: salesToday, subtitle: 'salg totalt', color: '#C86D4D' },
    { label: 'DENNE UKEN', value: salesWeek, subtitle: 'salg totalt', color: '#C86D4D' },
    { label: 'DENNE MND', value: `${salesMonth}/${monthlyTarget}`, subtitle: `${Math.round((salesMonth/monthlyTarget)*100)}% av mål`, color: '#C86D4D' },
  ];

  const departments = [
    {
      name: 'KRS',
      stats: [
        { label: 'Dag', current: departmentData.KRS?.today || 0, target: targetData.KRS?.dag || 14 },
        { label: 'Uke', current: departmentData.KRS?.week || 0, target: targetData.KRS?.uke || 70 },
        { label: 'Måned', current: departmentData.KRS?.month || 0, target: targetData.KRS?.måned || null },
      ],
    },
    {
      name: 'OSL',
      stats: [
        { label: 'Dag', current: departmentData.OSL?.today || 0, target: targetData.OSL?.dag || 14 },
        { label: 'Uke', current: departmentData.OSL?.week || 0, target: targetData.OSL?.uke || 70 },
        { label: 'Måned', current: departmentData.OSL?.month || 0, target: targetData.OSL?.måned || null },
      ],
    },
    {
      name: 'Skien',
      stats: [
        { label: 'Dag', current: departmentData.Skien?.today || 0, target: targetData.Skien?.dag || 10 },
        { label: 'Uke', current: departmentData.Skien?.week || 0, target: targetData.Skien?.uke || 50 },
        { label: 'Måned', current: departmentData.Skien?.month || 0, target: targetData.Skien?.måned || null },
      ],
    },
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
          {isOwner && (
            <button 
              className="nav-button admin-btn-header"
              onClick={() => navigate('/admin-dashboard')}
            >
              Admin →
            </button>
          )}
          <button 
            className="nav-button logout-btn-header"
            onClick={logout}
          >
            Logg ut
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation" style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '2px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveTab('status')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'status' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'status' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          📊 STATUS
        </button>
        <button
          onClick={() => setActiveTab('mal')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'mal' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'mal' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          🎯 MÅL
        </button>
      </div>

      {/* Content */}
      {activeTab === 'status' && (
      <div className="teamleder-content">
        {/* KPI Cards */}
        <div className="kpi-section">
          {kpis.map((kpi: any, idx: number) => (
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
          {departments.map((dept: any, idx: number) => (
            <div key={idx} className="department-card">
              <h3 className="department-name">{dept.name}</h3>
              {dept.stats.map((stat: any, sidx: number) => (
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
            {topSellers.map((seller: any, idx: number) => (
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
      )}

      {/* MÅL Tab */}
      {activeTab === 'mal' && (
      <div className="teamleder-content">
        <div style={{ paddingTop: '2rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem', color: '#333', fontWeight: '700' }}>🎯 Sett Mål for Avdelingene</h2>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>Dagsmål, Ukesmål, Månedsmål per avdeling</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {['KRS', 'OSL', 'Skien'].map((dept) => (
              <div key={dept} style={{
                padding: '1.5rem',
                background: '#fffbf0',
                border: '2px solid #667eea',
                borderRadius: '8px',
              }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: '#333', fontWeight: '700' }}>{dept}</h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DAG</label>
                  <input
                    type="number"
                    value={goals[dept]?.dag || ''}
                    onChange={(e) => setGoals({
                      ...goals,
                      [dept]: { ...goals[dept], dag: e.target.value }
                    })}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      color: '#333',
                      background: '#f8f8f8',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>UKE</label>
                  <input
                    type="number"
                    value={goals[dept]?.uke || ''}
                    onChange={(e) => {
                      const ukeVal = e.target.value;
                      const dagVal = ukeVal ? Math.round(parseInt(ukeVal) / 5) : '';
                      setGoals({
                        ...goals,
                        [dept]: { ...goals[dept], uke: ukeVal, dag: dagVal }
                      });
                    }}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      color: '#333',
                      background: '#f8f8f8',
                    }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: '#999', fontSize: '0.75rem' }}>
                    (DAG settes automatisk: UKE ÷ 5)
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MND</label>
                  <input
                    type="number"
                    value={goals[dept]?.måned || ''}
                    onChange={(e) => setGoals({
                      ...goals,
                      [dept]: { ...goals[dept], måned: e.target.value }
                    })}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      color: '#333',
                      background: '#f8f8f8',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={saveGoals}
            style={{
              padding: '0.75rem 2rem',
              background: '#C86D4D',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            💾 Lagre Mål
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
