import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileTeam.css';

interface SalesRecord {
  dato?: string;
  selger?: string;
  id?: string;
  produkt?: string;
  [key: string]: any;
}

const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  const trimmed = dateStr.trim();
  
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const ddmmyyyy2Match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy2Match) {
    const [, day, month, year] = ddmmyyyy2Match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return new Date(dateStr);
};

const normalize = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export default function MobileTeam() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState({
    dag: { krs: 0, osl: 0, skien: 0, muon: 0 },
    uke: { krs: 0, osl: 0, skien: 0, muon: 0 },
    måned: { krs: 0, osl: 0, skien: 0, muon: 0 },
  });
  const [runrateData, setRunrateData] = useState({
    dag: 0,
    uke: 0,
    måned: 0,
  });

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Load all contracts
        const salesRef = collection(db, 'allente_kontraktsarkiv');
        const snapshot = await getDocs(salesRef);
        
        const contracts: SalesRecord[] = [];
        snapshot.forEach((doc) => {
          contracts.push({ id: doc.id, ...doc.data() });
        });

        // Load all employees to map departments
        const employeesRef = collection(db, 'employees');
        const empSnapshot = await getDocs(employeesRef);
        
        const departmentMap: { [key: string]: string } = {};
        empSnapshot.forEach((doc) => {
          const emp = doc.data();
          const externalName = emp.externalName || '';
          const department = emp.department || '';
          
          // Map external name to department (KRS, OSL, Skien, or MUON variants)
          if (externalName) {
            departmentMap[normalize(externalName)] = department;
          }
        });

        // Load emoji counts for today
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateKey = today.toISOString().split('T')[0];
        
        const emojiCountsByName: { [key: string]: number } = {};
        try {
          const emojiRef = doc(db, 'emoji_counts_daily', dateKey);
          const emojiDoc = await getDoc(emojiRef);
          if (emojiDoc.exists()) {
            const data = emojiDoc.data();
            const counts = data.counts || {};
            
            Object.keys(counts).forEach(name => {
              const userEmojis = counts[name] || { '🔔': 0, '💎': 0 };
              emojiCountsByName[name] = (userEmojis['🔔'] || 0) + (userEmojis['💎'] || 0);
            });
          }
        } catch (err) {
          console.log('No emoji counts found');
        }

        // Calculate date ranges
        const daysToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysToMonday);
        
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Count contracts by department
        const countByDepartment = (dateStart: Date, dateEnd: Date, includeEmojis: boolean = false) => {
          const counts = { krs: 0, osl: 0, skien: 0, muon: 0 };
          
          contracts.forEach(c => {
            const date = parseDate(c.dato || '');
            if (!date || date < dateStart || date > dateEnd) return;
            
            const selger = normalize(c.selger || '');
            const dept = departmentMap[selger] || 'MUON';
            
            // Map to lowercase department
            const deptKey = dept.toLowerCase();
            if (deptKey.includes('krs')) counts.krs++;
            else if (deptKey.includes('osl')) counts.osl++;
            else if (deptKey.includes('skien')) counts.skien++;
            else counts.muon++;
          });

          // Add emojis if requested
          if (includeEmojis) {
            Object.keys(emojiCountsByName).forEach(name => {
              const emojis = emojiCountsByName[name] || 0;
              if (emojis === 0) return;
              
              // Find department for this person
              const dept = departmentMap[normalize(name)] || 'MUON';
              const deptKey = dept.toLowerCase();
              
              if (deptKey.includes('krs')) counts.krs += emojis;
              else if (deptKey.includes('osl')) counts.osl += emojis;
              else if (deptKey.includes('skien')) counts.skien += emojis;
              else counts.muon += emojis;
            });
          }

          // Calculate MUON total (should sum all departments, not replace)
          counts.muon = counts.krs + counts.osl + counts.skien;

          return counts;
        };

        const dagCounts = countByDepartment(today, today, true);
        const ukeCounts = countByDepartment(weekStart, today, true);
        const månedCounts = countByDepartment(monthStart, today, true);

        // Calculate runrates (based on MUON total)
        const countWorkingDaysThisWeek = () => {
          let count = 0;
          for (let d = new Date(weekStart); d < today; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++;
          }
          return count;
        };

        const countWorkingDaysThisMonth = () => {
          let count = 0;
          for (let d = new Date(monthStart); d < today; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++;
          }
          return count;
        };

        const countWorkingDaysInMonth = () => {
          const year = now.getFullYear();
          const month = now.getMonth();
          const firstDay = new Date(year, month, 1);
          const lastDay = new Date(year, month + 1, 0);
          
          let count = 0;
          for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) count++;
          }
          return count;
        };

        const workingDaysWeek = Math.max(1, countWorkingDaysThisWeek());
        const weekRunrate = Math.round((ukeCounts.muon / workingDaysWeek) * 5);

        const workingDaysMonth = countWorkingDaysThisMonth();
        const totalWorkingDaysInMonth = countWorkingDaysInMonth();
        const monthRunrate = workingDaysMonth > 0 ? Math.round((månedCounts.muon / workingDaysMonth) * totalWorkingDaysInMonth) : 0;

        setTeamData({
          dag: dagCounts,
          uke: ukeCounts,
          måned: månedCounts,
        });

        setRunrateData({
          dag: dagCounts.muon,
          uke: weekRunrate,
          måned: monthRunrate,
        });

        setLoading(false);
      } catch (error) {
        console.error('Error loading team data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="mobile-team">
        <div className="mobile-header">
          <button className="back-button" onClick={() => navigate('/home')}>
            ← Tilbake
          </button>
          <h1>Team</h1>
          <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
          Laster...
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-team">
      <div className="mobile-header">
        <button className="back-button" onClick={() => navigate('/home')}>
          ← Tilbake
        </button>
        <h1>Team</h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="mobile-team-content">
        {/* DAG */}
        <div className="team-period">
          <h3 className="period-title">DAG</h3>
          <div className="team-stats">
            <div className="team-stat krs">
              <span className="stat-label">KRS</span>
              <span className="stat-value">{teamData.dag.krs}</span>
            </div>
            <div className="team-stat osl">
              <span className="stat-label">OSL</span>
              <span className="stat-value">{teamData.dag.osl}</span>
            </div>
            <div className="team-stat skien">
              <span className="stat-label">SKIEN</span>
              <span className="stat-value">{teamData.dag.skien}</span>
            </div>
            <div className="team-stat muon">
              <span className="stat-label">MUON</span>
              <span className="stat-value">{teamData.dag.muon}</span>
            </div>
          </div>
        </div>

        {/* UKE */}
        <div className="team-period">
          <h3 className="period-title">UKE</h3>
          <div className="team-stats">
            <div className="team-stat krs">
              <span className="stat-label">KRS</span>
              <span className="stat-value">{teamData.uke.krs}</span>
            </div>
            <div className="team-stat osl">
              <span className="stat-label">OSL</span>
              <span className="stat-value">{teamData.uke.osl}</span>
            </div>
            <div className="team-stat skien">
              <span className="stat-label">SKIEN</span>
              <span className="stat-value">{teamData.uke.skien}</span>
            </div>
            <div className="team-stat muon">
              <span className="stat-label">MUON</span>
              <span className="stat-value">{teamData.uke.muon}</span>
            </div>
          </div>
        </div>

        {/* MÅNED */}
        <div className="team-period">
          <h3 className="period-title">MÅNED</h3>
          <div className="team-stats">
            <div className="team-stat krs">
              <span className="stat-label">KRS</span>
              <span className="stat-value">{teamData.måned.krs}</span>
            </div>
            <div className="team-stat osl">
              <span className="stat-label">OSL</span>
              <span className="stat-value">{teamData.måned.osl}</span>
            </div>
            <div className="team-stat skien">
              <span className="stat-label">SKIEN</span>
              <span className="stat-value">{teamData.måned.skien}</span>
            </div>
            <div className="team-stat muon">
              <span className="stat-label">MUON</span>
              <span className="stat-value">{teamData.måned.muon}</span>
            </div>
          </div>
        </div>

        {/* RUNRATE MUON */}
        <div className="runrate-section">
          <h3 className="period-title">RUNRATE MUON</h3>
          <div className="runrate-metrics">
            <div className="runrate-box">
              <span className="runrate-label">DAG</span>
              <span className="runrate-value">{runrateData.dag}</span>
              <span className="runrate-unit">salg</span>
            </div>
            <div className="runrate-box">
              <span className="runrate-label">UKE</span>
              <span className="runrate-value">{runrateData.uke}</span>
              <span className="runrate-unit">salg</span>
            </div>
            <div className="runrate-box">
              <span className="runrate-label">MÅNED</span>
              <span className="runrate-value">{runrateData.måned}</span>
              <span className="runrate-unit">salg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
