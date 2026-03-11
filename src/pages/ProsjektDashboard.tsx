import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/AvdelingDashboard.css';

interface TopFiveItem {
  externalName: string;
  displayName: string;
  salg: number;
  emojis?: string;
}

interface TopAvdelingItem {
  avdeling: string;
  salg: number;
  emojis?: string;
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

  const getEmojiCountsForDate = async (date: Date): Promise<Map<string, number>> => {
    const dateStr = date.toISOString().split('T')[0];
    try {
      const emojiCountsDocRef = doc(db, 'emoji_counts_daily', dateStr);
      const emojiCountsSnap = await getDoc(emojiCountsDocRef);
      const emojiCounts = new Map<string, number>();

      if (emojiCountsSnap.exists()) {
        const data = emojiCountsSnap.data();
        const counts = data.counts || {};
        Object.entries(counts).forEach(([employeeName, emojis]: [string, any]) => {
          const bellCount = (emojis['🔔'] || 0) as number;
          const gemCount = (emojis['💎'] || 0) as number;
          const totalEmojis = bellCount + gemCount;
          emojiCounts.set(employeeName, totalEmojis);
        });
      }
      return emojiCounts;
    } catch (err) {
      return new Map();
    }
  };

  const loadData = async () => {
    try {
      const today = new Date();
      
      // Week start (Monday)
      const weekStart = new Date(today);
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(today.getDate() - daysToMonday);

      // 1. FETCH EMPLOYEES & CONTRACTS
      const employeesRef = collection(db, 'employees');
      const employeesSnap = await getDocs(employeesRef);
      const employees = employeesSnap.docs.map(doc => doc.data());
      
      // Create mapping from externalName → department
      const nameToDepart = new Map<string, string>();
      employees.forEach(emp => {
        const extName = emp.externalName?.trim();
        if (extName) {
          nameToDepart.set(extName, emp.department || 'Ukjent');
        }
      });

      const salesRef = collection(db, 'allente_kontraktsarkiv');
      const salesSnap = await getDocs(salesRef);
      const allSales = salesSnap.docs.map(doc => doc.data());

      // 2. GROUP BY DEPARTMENT (via employee lookup)
      const avdelingStats = new Map<string, { dag: number; uke: number; maned: number }>();
      const sellerStats = new Map<string, { displayName: string; avdeling: string; dag: number; uke: number; maned: number }>();

      allSales.forEach((sale: any) => {
        const saleDate = parseDate(sale.dato);
        if (!saleDate || saleDate.getTime() === 0) return;

        const selger = sale.selger?.trim() || 'Ukjent';
        const avdeling = nameToDepart.get(selger) || 'Ukjent';
        
        if (!avdelingStats.has(avdeling)) {
          avdelingStats.set(avdeling, { dag: 0, uke: 0, maned: 0 });
        }
        
        if (!sellerStats.has(selger)) {
          sellerStats.set(selger, { displayName: selger, avdeling, dag: 0, uke: 0, maned: 0 });
        }

        const isDag = saleDate.toDateString() === today.toDateString();
        const isUke = saleDate >= weekStart && saleDate <= today;
        const isManed = saleDate.getMonth() === today.getMonth() && saleDate.getFullYear() === today.getFullYear();

        const avdelingEntry = avdelingStats.get(avdeling)!;
        const sellerEntry = sellerStats.get(selger)!;
        
        if (isDag) { avdelingEntry.dag += 1; sellerEntry.dag += 1; }
        if (isUke) { avdelingEntry.uke += 1; sellerEntry.uke += 1; }
        if (isManed) { avdelingEntry.maned += 1; sellerEntry.maned += 1; }
      });

      // 3. FETCH EMOJIS FOR TODAY
      const emojiCountsToday = await getEmojiCountsForDate(today);
      
      emojiCountsToday.forEach((count, employeeName) => {
        for (const [, stats] of sellerStats.entries()) {
          if (stats.displayName === employeeName) {
            stats.dag += count;
            stats.uke += count;
            stats.maned += count;
            break;
          }
        }
      });

      // 4. CALCULATE TOTALS
      let totalDag = 0, totalUke = 0, totalManed = 0;
      avdelingStats.forEach(stats => {
        totalDag += stats.dag;
        totalUke += stats.uke;
        totalManed += stats.maned;
      });

      // 5. RANK TOP 3 AVDELINGER
      setTopAvdeling({
        dag: Array.from(avdelingStats.entries())
          .map(([avdeling, data]) => ({ avdeling, salg: data.dag }))
          .filter(item => item.avdeling && item.avdeling.toLowerCase() !== 'muon')
          .sort((a, b) => b.salg - a.salg)
          .slice(0, 3),
        uke: Array.from(avdelingStats.entries())
          .map(([avdeling, data]) => ({ avdeling, salg: data.uke }))
          .filter(item => item.avdeling && item.avdeling.toLowerCase() !== 'muon')
          .sort((a, b) => b.salg - a.salg)
          .slice(0, 3),
        maned: Array.from(avdelingStats.entries())
          .map(([avdeling, data]) => ({ avdeling, salg: data.maned }))
          .filter(item => item.avdeling && item.avdeling.toLowerCase() !== 'muon')
          .sort((a, b) => b.salg - a.salg)
          .slice(0, 3),
      });
      
      setStats({ dag: totalDag, uke: totalUke, maned: totalManed });
      setGoals({ dag: 50, uke: 250, maned: 1000 });
      
      // 6. RANK TOP 3 SELLERS
      const sellerListArray = Array.from(sellerStats.values());
      
      setTopFive({
        dag: sellerListArray
          .map(s => ({ externalName: s.displayName, displayName: s.displayName, salg: s.dag }))
          .sort((a, b) => b.salg - a.salg)
          .slice(0, 3),
        uke: sellerListArray
          .map(s => ({ externalName: s.displayName, displayName: s.displayName, salg: s.uke }))
          .sort((a, b) => b.salg - a.salg)
          .slice(0, 3),
        maned: sellerListArray
          .map(s => ({ externalName: s.displayName, displayName: s.displayName, salg: s.maned }))
          .sort((a, b) => b.salg - a.salg)
          .slice(0, 3),
      });

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
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
