import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/AvdelingDashboard.css';

interface TopFiveItem {
  externalName: string;
  displayName: string;
  salg: number;
}

interface TopAvdelingItem {
  avdeling: string;
  salg: number;
}

interface Stats {
  dag: number;
  uke: number;
  maned: number;
}

interface Goals {
  dag: number;
  uke: number;
  maned: number;
}

interface TopFive {
  dag: TopFiveItem[];
  uke: TopFiveItem[];
  maned: TopFiveItem[];
}

interface TopAvdeling {
  dag: TopAvdelingItem[];
  uke: TopAvdelingItem[];
  maned: TopAvdelingItem[];
}

const ProsjektDashboard = ({ userProject }: { userProject?: string } = {}) => {
  const proj = userProject || 'Allente';
  const [stats, setStats] = useState<Stats>({ dag: 0, uke: 0, maned: 0 });
  const [goals, setGoals] = useState<Goals>({ dag: 50, uke: 250, maned: 1000 });
  const [topFive, setTopFive] = useState<TopFive>({ dag: [], uke: [], maned: [] });
  const [topAvdeling, setTopAvdeling] = useState<TopAvdeling>({ dag: [], uke: [], maned: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [proj]);

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    const trimmed = dateStr.trim();
    
    // Try D/M/YYYY or DD/MM/YYYY format (4/3/2026 or 04/03/2026)
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return parsed;
    }
    
    // Try D.M.YYYY or DD.MM.YYYY format (4.3.2026 or 04.03.2026)
    const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotMatch) {
      const [, day, month, year] = dotMatch;
      const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return parsed;
    }
    
    // Fallback to default parsing
    return new Date(dateStr);
  };

  const loadData = async () => {
    try {
      const today = new Date();

      // Fetch combined goals from all departments in the project
      try {
        const goalsRef = collection(db, 'allente_targets');
        const allGoalsSnap = await getDocs(goalsRef);
        
        let totalDagGoal = 0;
        let totalUkeGoal = 0;
        let totalManedGoal = 0;
        
        // Sum goals from all departments (KRS, OSL, Skien)
        allGoalsSnap.forEach(doc => {
          const data = doc.data();
          const deptId = doc.id;
          
          // For projects, sum all department goals
          if (deptId === 'KRS' || deptId === 'OSL' || deptId === 'Skien') {
            totalDagGoal += parseInt(data.dag) || 0;
            totalUkeGoal += parseInt(data.uke) || 0;
            totalManedGoal += parseInt(data.måned) || 0;
          }
        });
        
        setGoals({
          dag: totalDagGoal || 50,
          uke: totalUkeGoal || 250,
          maned: totalManedGoal || 1000,
        });
        
        console.log(`🎯 PROJECT ${proj} COMBINED GOALS:`, { dag: totalDagGoal, uke: totalUkeGoal, maned: totalManedGoal });
      } catch (err) {
        console.log('Goals using defaults:', err);
      }

      // Fetch all employees (for projects, we want everyone, not filtered by department)
      const employeesRef = collection(db, 'employees');
      const employeesSnap = await getDocs(employeesRef);
      const employees = employeesSnap.docs.map(doc => doc.data());
      
      console.log(`🔍 PROJECT ${proj} - ALL EMPLOYEES:`, employees.map(e => ({ name: e.name, externalName: e.externalName, department: e.department, project: e.project })));
      
      // Create a set of externalNames that belong to this project
      const projEmployeeNames = new Set<string>();
      employees.forEach(emp => {
        const externalName = emp.externalName?.trim();
        if (externalName && emp.project === proj) {
          projEmployeeNames.add(externalName);
        }
      });
      
      console.log(`🔍 PROJECT ${proj} employee names:`, Array.from(projEmployeeNames));
      
      // Create mapping from externalName → display name
      const employeeNameMap = new Map<string, string>();
      employees.forEach(emp => {
        const externalName = emp.externalName?.trim() || '';
        const displayName = emp.name || emp.ansattNavn || externalName;
        if (externalName) {
          employeeNameMap.set(externalName, displayName);
        }
      });
      
      console.log(`📍 EMPLOYEE NAME MAP for ${proj}:`, Array.from(employeeNameMap.entries()));

      // Fetch all contracts from the archive
      const salesRef = collection(db, 'allente_kontraktsarkiv');
      const salesSnap = await getDocs(salesRef);
      const allSales = salesSnap.docs.map(doc => doc.data());
      
      console.log(`📊 TOTAL SALES IN allente_salg:`, allSales.length);
      console.log(`📊 SAMPLE SALES (first 5):`, allSales.slice(0, 5).map(s => ({ selger: s.selger, dato: s.dato })));

      // Count sales by employee
      const salesByEmployee = new Map<string, { dag: number; uke: number; maned: number }>();

      // Initialize with all employees
      employees.forEach(emp => {
        salesByEmployee.set(emp.externalName, { dag: 0, uke: 0, maned: 0 });
      });

      // Helper function to fetch emoji counts for a date
      const getEmojiCountsForDate = async (date: Date): Promise<Map<string, number>> => {
        const dateStr = date.toISOString().split('T')[0];
        try {
          const emojiCountsDocRef = doc(db, 'emoji_counts_daily', dateStr);
          const emojiCountsSnap = await getDoc(emojiCountsDocRef);
          const emojiCounts = new Map<string, number>();

          if (emojiCountsSnap.exists()) {
            const data = emojiCountsSnap.data();
            const counts = data.counts || {};
            
            // counts is: { "Oliver T Jenssen": { 🔔: 0, 💎: 1, 🎁: 1 }, ... }
            Object.entries(counts).forEach(([employeeName, emojis]: [string, any]) => {
              const bellCount = (emojis['🔔'] || 0) as number;
              const gemCount = (emojis['💎'] || 0) as number;
              const totalEmojis = bellCount + gemCount;
              emojiCounts.set(employeeName, totalEmojis);
            });
          }

          return emojiCounts;
        } catch (err) {
          console.error(`Error fetching emoji counts for ${dateStr}:`, err);
          return new Map();
        }
      };

      // First count contracts for today
      const todaySalesCount = allSales.filter(s => {
        const saleDate = parseDate(s.dato);
        return saleDate && saleDate.toDateString() === today.toDateString();
      }).length;
      
      console.log(`📅 TODAY SALES (${today.toDateString()}):`, todaySalesCount);
      console.log(`📅 TODAY SALES DETAIL:`, allSales
        .filter(s => {
          const saleDate = parseDate(s.dato);
          return saleDate && saleDate.toDateString() === today.toDateString();
        })
        .map(s => ({ selger: s.selger, dato: s.dato })));

      // ✅ FETCH EMOJIS - Sum all emojis from today for DAG calculation
      const todayDateKey = today.toISOString().split('T')[0];
      let totalTodayEmojis = 0;
      try {
        const emojiCountsRef = doc(db, 'emoji_counts_daily', todayDateKey);
        const emojiDoc = await getDoc(emojiCountsRef);
        if (emojiDoc.exists()) {
          const data = emojiDoc.data();
          const counts = data.counts || {};
          // Sum all emojis (🔔 + 💎) for all employees
          Object.values(counts).forEach((emojiSet: any) => {
            totalTodayEmojis += (emojiSet['🔔'] || 0) + (emojiSet['💎'] || 0);
          });
          console.log('🔔 Total emojis today:', totalTodayEmojis);
        }
      } catch (err) {
        console.error('Error fetching emojis:', err);
      }
      
      console.log(`✅ SALES BY EMPLOYEE (after emoji fetch):`, Array.from(salesByEmployee.entries()).slice(0, 10));

      // Then ADD emoji counts for today
      // Create mapping from name (display name) → externalName for emoji lookup
      const nameToExternalName = new Map<string, string>();
      employees.forEach(emp => {
        const externalName = emp.externalName?.trim() || '';
        const displayName = emp.name || '';
        if (displayName && externalName) {
          nameToExternalName.set(displayName, externalName);
        }
      });
      
      const emojiCountsToday = await getEmojiCountsForDate(today);
      emojiCountsToday.forEach((count, employeeName) => {
        // employeeName is the display name (e.g., "Oliver T Jenssen")
        // We need to find the corresponding externalName in our sales data
        const externalName = nameToExternalName.get(employeeName);
        if (externalName) {
          const current = salesByEmployee.get(externalName) || { dag: 0, uke: 0, maned: 0 };
          current.dag += count;  // ADD emojis to existing contract count
          salesByEmployee.set(externalName, current);
        }
      });

      // Emojis only from TODAY are used for UKE and MÅNED
      // (contracts provide the historical totals, emojis are just for today's progress)

      // Count sales for week and month
      allSales.forEach((sale: any) => {
        const selgerKey = sale.selger?.trim();
        if (!selgerKey) return;
        
        // ONLY count sales from employees in THIS project
        if (!projEmployeeNames.has(selgerKey)) return;

        const saleDate = parseDate(sale.dato);
        if (!saleDate || saleDate.getTime() === 0) return;

        // Week calculation
        const weekStart = new Date(today);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);

        // Count for this week
        if (saleDate >= weekStart && saleDate <= today) {
          const current = salesByEmployee.get(selgerKey) || { dag: 0, uke: 0, maned: 0 };
          current.uke += 1;
          salesByEmployee.set(selgerKey, current);
        }

        // Count for this month
        if (saleDate.getMonth() === today.getMonth() && saleDate.getFullYear() === today.getFullYear()) {
          const current = salesByEmployee.get(selgerKey) || { dag: 0, uke: 0, maned: 0 };
          current.maned += 1;
          salesByEmployee.set(selgerKey, current);
        }
      });

      // Calculate totals (combining contracts + emojis)
      let totalDag = 0;
      let totalUke = 0;
      let totalManed = 0;

      const dagList: TopFiveItem[] = [];
      const ukeList: TopFiveItem[] = [];
      const maanedList: TopFiveItem[] = [];

      salesByEmployee.forEach((counts, externalName) => {
        // externalName is how we tracked sales (e.g., "Oliver Jenssen / selger")
        // displayName is the employee's name (e.g., "Oliver T Jenssen")
        const displayName = employeeNameMap.get(externalName) || externalName;
        
        // Look up emojis using displayName (e.g., "Oliver T Jenssen")
        // Emojis only from TODAY for both UKE and MÅNED
        const todayEmojis = emojiCountsToday.get(displayName) || 0;

        const dagTotal = counts.dag;
        const ukeTotal = counts.uke + todayEmojis;
        const maanedTotal = counts.maned + todayEmojis;

        totalDag += dagTotal;
        totalUke += ukeTotal;
        totalManed += maanedTotal;

        dagList.push({ externalName, displayName, salg: dagTotal });
        ukeList.push({ externalName, displayName, salg: ukeTotal });
        maanedList.push({ externalName, displayName, salg: maanedTotal });
      });

      dagList.sort((a, b) => b.salg - a.salg);
      ukeList.sort((a, b) => b.salg - a.salg);
      maanedList.sort((a, b) => b.salg - a.salg);

      // Calculate top 3 avdelinger (departments)
      const avdelingMap = new Map<string, { dag: number; uke: number; maned: number }>();
      employees.forEach(emp => {
        if (!avdelingMap.has(emp.department)) {
          avdelingMap.set(emp.department, { dag: 0, uke: 0, maned: 0 });
        }
        const entry = avdelingMap.get(emp.department)!;
        const empData = dagList.find(e => e.displayName === emp.name) || { salg: 0 };
        entry.dag += empData.salg;
      });
      
      // For UKE/MÅNED, use the lists
      ukeList.forEach(emp => {
        const empObj = employees.find(e => e.name === emp.displayName);
        if (empObj && avdelingMap.has(empObj.department)) {
          avdelingMap.get(empObj.department)!.uke += emp.salg;
        }
      });
      
      maanedList.forEach(emp => {
        const empObj = employees.find(e => e.name === emp.displayName);
        if (empObj && avdelingMap.has(empObj.department)) {
          avdelingMap.get(empObj.department)!.maned += emp.salg;
        }
      });

      const dagAvdeling = Array.from(avdelingMap.entries())
        .map(([dept, data]) => ({ avdeling: dept, salg: data.dag }))
        .filter((item) => item.avdeling && item.avdeling.toLowerCase() !== 'muon') // Filter out MUON
        .sort((a, b) => b.salg - a.salg)
        .slice(0, 3);
      const ukeAvdeling = Array.from(avdelingMap.entries())
        .map(([dept, data]) => ({ avdeling: dept, salg: data.uke }))
        .filter((item) => item.avdeling && item.avdeling.toLowerCase() !== 'muon') // Filter out MUON
        .sort((a, b) => b.salg - a.salg)
        .slice(0, 3);
      const maanedAvdeling = Array.from(avdelingMap.entries())
        .map(([dept, data]) => ({ avdeling: dept, salg: data.maned }))
        .filter((item) => item.avdeling && item.avdeling.toLowerCase() !== 'muon') // Filter out MUON
        .sort((a, b) => b.salg - a.salg)
        .slice(0, 3);

      console.log(`📈 FINAL STATS for ${proj}:`, { dag: totalDag, uke: totalUke, maned: totalManed });
      console.log(`🏆 TOP 3 DAG:`, dagList.slice(0, 3).map(e => ({ name: e.displayName, salg: e.salg })));
      console.log(`🏆 TOP 3 UKE:`, ukeList.slice(0, 3).map(e => ({ name: e.displayName, salg: e.salg })));
      console.log(`🏆 TOP 3 MÅNED:`, maanedList.slice(0, 3).map(e => ({ name: e.displayName, salg: e.salg })));
      
      setStats({ dag: totalDag, uke: totalUke, maned: totalManed });
      setTopFive({
        dag: dagList.slice(0, 3),
        uke: ukeList.slice(0, 3),
        maned: maanedList.slice(0, 3),
      });
      setTopAvdeling({
        dag: dagAvdeling,
        uke: ukeAvdeling,
        maned: maanedAvdeling,
      });

      setLoading(false);
    } catch (err) {
      console.error('Error loading projekt data:', err);
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="avdeling-dashboard">
        <p>Laster data...</p>
      </div>
    );

  return (
    <div className="avdeling-dashboard">
      <div className="avdeling-header">
        <h2>Prosjekt: {proj}</h2>
        <p className="avdeling-subtitle">Se alle kontrakter fra {proj}</p>
      </div>

      <div className="avdeling-grid">
        {/* DAG */}
        <div className="avdeling-card">
          <div className="card-title" style={{ fontSize: '1.3rem', textAlign: 'center' }}>📅 DAG 📅</div>
          <div className="stats-row">
            <div className="stat-box">
              <span className="stat-label">SALG</span>
              <span className="stat-value">{stats.dag}</span>
            </div>
            <span className="separator">/</span>
            <div className="stat-box">
              <span className="stat-label">MÅL</span>
              <span className="stat-value">{goals.dag}</span>
            </div>
          </div>
          <div className="progress-bar-wrapper">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min((stats.dag / goals.dag) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="top-five">
            <div className="top-five-title">TOP 3 AVDELING</div>
            {topAvdeling.dag.length > 0 ? (
              topAvdeling.dag.map((dept, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={idx} className="top-five-item">
                    <span className="rank">{medals[idx]}</span>
                    <span className="name">{dept.avdeling}</span>
                    <span className="count">{dept.salg}</span>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#999' }}>Ingen avdelinger</p>
            )}
            <div style={{ marginTop: '0.8rem', borderTop: '1px solid #ddd', paddingTop: '0.8rem' }}>
              <div className="top-five-title" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>TOP 3 ANSATT</div>
              {topFive.dag.length > 0 ? (
                topFive.dag.map((emp, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={idx} className="top-five-item">
                      <span className="rank">{medals[idx]}</span>
                      <span className="name">{emp.displayName}</span>
                      <span className="count">{emp.salg}</span>
                    </div>
                  );
                })
              ) : (
                <p style={{ fontSize: '0.85rem', color: '#999' }}>Ingen salg i dag</p>
              )}
            </div>
          </div>
        </div>

        {/* UKE */}
        <div className="avdeling-card">
          <div className="card-title" style={{ fontSize: '1.3rem', textAlign: 'center' }}>📊 UKE 📊</div>
          <div className="stats-row">
            <div className="stat-box">
              <span className="stat-label">SALG</span>
              <span className="stat-value">{stats.uke}</span>
            </div>
            <span className="separator">/</span>
            <div className="stat-box">
              <span className="stat-label">MÅL</span>
              <span className="stat-value">{goals.uke}</span>
            </div>
          </div>
          <div className="progress-bar-wrapper">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min((stats.uke / goals.uke) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="top-five">
            <div className="top-five-title">TOP 3 AVDELING</div>
            {topAvdeling.uke.length > 0 ? (
              topAvdeling.uke.map((dept, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={idx} className="top-five-item">
                    <span className="rank">{medals[idx]}</span>
                    <span className="name">{dept.avdeling}</span>
                    <span className="count">{dept.salg}</span>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#999' }}>Ingen avdelinger</p>
            )}
            <div style={{ marginTop: '0.8rem', borderTop: '1px solid #ddd', paddingTop: '0.8rem' }}>
              <div className="top-five-title" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>TOP 3 ANSATT</div>
              {topFive.uke.length > 0 ? (
                topFive.uke.map((emp, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={idx} className="top-five-item">
                      <span className="rank">{medals[idx]}</span>
                      <span className="name">{emp.displayName}</span>
                      <span className="count">{emp.salg}</span>
                    </div>
                  );
                })
              ) : (
                <p style={{ fontSize: '0.85rem', color: '#999' }}>Ingen salg denne uka</p>
              )}
            </div>
          </div>
        </div>

        {/* MÅNED */}
        <div className="avdeling-card">
          <div className="card-title" style={{ fontSize: '1.3rem', textAlign: 'center' }}>📈 MÅNED 📈</div>
          <div className="stats-row">
            <div className="stat-box">
              <span className="stat-label">SALG</span>
              <span className="stat-value">{stats.maned}</span>
            </div>
            <span className="separator">/</span>
            <div className="stat-box">
              <span className="stat-label">MÅL</span>
              <span className="stat-value">{goals.maned}</span>
            </div>
          </div>
          <div className="progress-bar-wrapper">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min((stats.maned / goals.maned) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="top-five">
            <div className="top-five-title">TOP 3 AVDELING</div>
            {topAvdeling.maned.length > 0 ? (
              topAvdeling.maned.map((dept, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={idx} className="top-five-item">
                    <span className="rank">{medals[idx]}</span>
                    <span className="name">{dept.avdeling}</span>
                    <span className="count">{dept.salg}</span>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#999' }}>Ingen avdelinger</p>
            )}
            <div style={{ marginTop: '0.8rem', borderTop: '1px solid #ddd', paddingTop: '0.8rem' }}>
              <div className="top-five-title" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>TOP 3 ANSATT</div>
              {topFive.maned.length > 0 ? (
                topFive.maned.map((emp, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={idx} className="top-five-item">
                      <span className="rank">{medals[idx]}</span>
                      <span className="name">{emp.displayName}</span>
                      <span className="count">{emp.salg}</span>
                    </div>
                  );
                })
              ) : (
                <p style={{ fontSize: '0.85rem', color: '#999' }}>Ingen salg denne måneden</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProsjektDashboard;
