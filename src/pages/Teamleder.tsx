import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import '../styles/Teamleder.css';

export default function Teamleder() {
  const [activeTab, setActiveTab] = useState('status');

  // Parse dates in multiple formats (DD/MM/YYYY, DD.MM.YYYY, ISO)
  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    
    const trimmed = dateStr.trim();
    
    // Try DD/MM/YYYY format (19/02/2026)
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const result = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return result;
    }
    
    // Try DD.MM.YYYY format (19.02.2026)
    const ddmmyyyy2Match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (ddmmyyyy2Match) {
      const [, day, month, year] = ddmmyyyy2Match;
      const result = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return result;
    }
    
    // Try ISO format (YYYY-MM-DD or 2026-02-19)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const result = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return result;
    }

    // Try MM/DD/YYYY format (American, 02/19/2026)
    const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch;
      // Check if this looks like MM/DD/YYYY (month > 12 would be invalid)
      if (parseInt(month) <= 12 && parseInt(day) <= 31) {
        const result = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return result;
      }
    }
    
    // Fallback to default Date parsing
    console.warn('Could not parse date:', dateStr);
    return new Date(dateStr);
  };
  
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
        // Get all employees (for department lookup)
        const employeesRef = collection(db, 'employees');
        const employeesSnap = await getDocs(employeesRef);
        const employeeMap: any = {};
        employeesSnap.forEach(doc => {
          const emp = doc.data();
          if (emp.externalName) {
            employeeMap[emp.externalName] = emp.department || 'Ukjent';
          }
        });
        console.log('👥 Employee department map:', employeeMap);

        // Get all contracts
        const contractsRef = collection(db, 'allente_kontraktsarkiv');
        const contractsSnap = await getDocs(contractsRef);
        let contracts = contractsSnap.docs.map(doc => doc.data());
        
        // Enrich contracts with department info from employees
        contracts = contracts.map(c => ({
          ...c,
          avdeling: employeeMap[c.selger] || c.avdeling || 'Annet'
        }));
        
        // Find missing sellers
        const uniqueSellers = new Set(contracts.map(c => c.selger));
        const missingSellers = Array.from(uniqueSellers).filter(seller => !employeeMap[seller]);
        console.log('⚠️ SELLERS NOT IN EMPLOYEES LIST:', missingSellers);
        console.log('📋 Enriched contracts with departments (first 3):', contracts.slice(0, 3));

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
          const cDate = parseDate(c.dato);
          return cDate.toDateString() === today.toDateString();
        }).length;

        const weekSales = contracts.filter(c => {
          const cDate = parseDate(c.dato);
          return cDate >= weekStart && cDate <= today;
        }).length;

        const monthSales = contracts.filter(c => {
          const cDate = parseDate(c.dato);
          return cDate >= monthStart && cDate <= today;
        }).length;

        console.log('🔔 TOTALS - Today:', todaySales, 'Week:', weekSales, 'Month:', monthSales);
        console.log('✅ All contracts loaded:', contracts.length);

        setSalesToday(todaySales);
        setSalesWeek(weekSales);
        setSalesMonth(monthSales);

        // Calculate per department
        const deptMap: any = {};
        const today_end = new Date(today);
        today_end.setHours(23, 59, 59, 999);
        
        console.log('🔍 Debug Info:', {
          today: today.toDateString(),
          weekStart: weekStart.toDateString(),
          monthStart: monthStart.toDateString(),
          totalContracts: contracts.length
        });

        // Count contracts per department
        const avdelingCounts: any = {};
        contracts.forEach(c => {
          const av = c.avdeling || 'MISSING';
          avdelingCounts[av] = (avdelingCounts[av] || 0) + 1;
        });
        console.log('📋 Avdeling distribution after enrichment:', avdelingCounts);

        ['KRS', 'OSL', 'Skien'].forEach(dept => {
          const deptContracts = contracts.filter(c => c.avdeling === dept);
          console.log(`📊 ${dept} total contracts:`, deptContracts.length);
          
          const deptToday = deptContracts.filter(c => {
            const cDate = parseDate(c.dato);
            const match = cDate.toDateString() === today.toDateString();
            return match;
          }).length;

          const deptWeek = deptContracts.filter(c => {
            const cDate = parseDate(c.dato);
            const match = cDate >= weekStart && cDate <= today_end;
            return match;
          }).length;

          const deptMonth = deptContracts.filter(c => {
            const cDate = parseDate(c.dato);
            const match = cDate >= monthStart && cDate <= today_end;
            return match;
          }).length;

          console.log(`📈 ${dept} this week:`, deptWeek, `this month:`, deptMonth);

          deptMap[dept] = {
            today: deptToday,
            week: deptWeek,
            month: deptMonth,
            target: targets[dept] || {},
          };
        });
        setDepartmentData(deptMap);
        console.log('✅ Final Department Data:', deptMap);
        console.log('✅ Target Data:', targets);

        // All sellers - THIS MONTH ONLY
        const monthContracts = contracts.filter(c => {
          const cDate = parseDate(c.dato);
          return cDate >= monthStart && cDate <= today;
        });

        const sellerMap: any = {};
        monthContracts.forEach(c => {
          const sellerKey = c.selger || 'Unknown';
          const dept = employeeMap[c.selger] || c.avdeling || 'Annet';
          if (!sellerMap[sellerKey]) {
            sellerMap[sellerKey] = { count: 0, department: dept };
          }
          sellerMap[sellerKey].count += 1;
        });
        console.log('📈 Sellers this month:', sellerMap);

        const sellers = Object.entries(sellerMap)
          .map(([name, data]: any) => ({ name, count: data.count, department: data.department }))
          .sort((a, b) => (b.count as any) - (a.count as any))
          .map((s, idx) => ({ rank: idx + 1, name: s.name, value: s.count, department: s.department }));

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
        { label: 'Dag', current: departmentData.KRS?.today || 0, target: (targetData.KRS?.dag ? parseInt(targetData.KRS.dag) : 0) || 0 },
        { label: 'Uke', current: departmentData.KRS?.week || 0, target: (targetData.KRS?.uke ? parseInt(targetData.KRS.uke) : 0) || 0 },
        { label: 'Måned', current: departmentData.KRS?.month || 0, target: (targetData.KRS?.måned ? parseInt(targetData.KRS.måned) : 0) || 0 },
      ],
    },
    {
      name: 'OSL',
      stats: [
        { label: 'Dag', current: departmentData.OSL?.today || 0, target: (targetData.OSL?.dag ? parseInt(targetData.OSL.dag) : 0) || 0 },
        { label: 'Uke', current: departmentData.OSL?.week || 0, target: (targetData.OSL?.uke ? parseInt(targetData.OSL.uke) : 0) || 0 },
        { label: 'Måned', current: departmentData.OSL?.month || 0, target: (targetData.OSL?.måned ? parseInt(targetData.OSL.måned) : 0) || 0 },
      ],
    },
    {
      name: 'Skien',
      stats: [
        { label: 'Dag', current: departmentData.Skien?.today || 0, target: (targetData.Skien?.dag ? parseInt(targetData.Skien.dag) : 0) || 0 },
        { label: 'Uke', current: departmentData.Skien?.week || 0, target: (targetData.Skien?.uke ? parseInt(targetData.Skien.uke) : 0) || 0 },
        { label: 'Måned', current: departmentData.Skien?.month || 0, target: (targetData.Skien?.måned ? parseInt(targetData.Skien.måned) : 0) || 0 },
      ],
    },
  ];

  return (
    <div className="teamleder-container">
      {/* Header - SAME AS ADMIN & MIN SIDE */}
      <div className="page-header-standard">
        <div className="header-left">
          <span className="muon-logo">muon</span>
          <div>
            <h1>👔 Teamleder Dashboard</h1>
            <p className="subtitle">Oversikt og styring av ditt team</p>
          </div>
        </div>
        <div className="header-buttons">
          <button 
            className="back-btn-standard"
            onClick={() => window.history.back()}
          >
            ← Tilbake
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
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', color: '#333' }}>📊 Status Denne Måneden</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Live data fra kontrakter</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#764ba2')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#667eea')}
          >
            🔄 Oppdater
          </button>
        </div>

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

        {/* All Sellers - This Month */}
        <div className="top-sellers-card">
          <div className="top-sellers-header">
            <h3>🏆 Sælgere Denne Måneden</h3>
          </div>
          <div className="sellers-list">
            {topSellers.map((seller: any, idx: number) => (
              <div key={idx} className="seller-row">
                <div className="seller-rank">{seller.rank}</div>
                <div className="seller-name">
                  {seller.name} <span style={{ color: '#999', fontSize: '0.85rem' }}>({seller.department})</span>
                </div>
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
