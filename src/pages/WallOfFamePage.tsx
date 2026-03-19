import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/WallOfFame.css';

interface Record {
  ansatt: string;
  dag: number;
  uke: number;
  måned: number;
  avdeling: string;
}

interface TrackedRecord {
  ansatt: string;
  department: string;
  type: 'dag' | 'uke' | 'måned';
  value: number;
  timestamp: string;
}

export default function WallOfFamePage() {
  const [loading, setLoading] = useState(true);
  const [deptRecords, setDeptRecords] = useState<{ [dept: string]: { day: Record; week: Record; month: Record } }>({
    KRS: { day: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'KRS' }, week: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'KRS' }, month: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'KRS' } },
    OSL: { day: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'OSL' }, week: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'OSL' }, month: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'OSL' } },
    Skien: { day: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'Skien' }, week: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'Skien' }, month: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'Skien' } },
  });
  const [projectRecords, setProjectRecords] = useState<{ day: Record; week: Record; month: Record }>({
    day: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'MUON' },
    week: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'MUON' },
    month: { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'MUON' },
  });

  // Track records in Firestore to detect new ones
  const checkAndPostNewRecord = async (record: TrackedRecord) => {
    try {
      const recordId = `${record.department}_${record.type}_${record.value}`;
      const recordRef = doc(db, 'records_tracking', recordId);
      const recordSnap = await getDocs(collection(db, 'records_tracking'));
      
      const existing = recordSnap.docs.find(d => 
        d.data().department === record.department && 
        d.data().type === record.type &&
        d.data().ansatt === record.ansatt &&
        d.data().value === record.value
      );

      if (!existing) {
        // New record! Save it and post to livefeed
        await setDoc(recordRef, record);
        
        // Post to livefeed
        const typeLabel = record.type === 'dag' ? 'DAG' : record.type === 'uke' ? 'UKE' : 'MÅNED';
        await setDoc(doc(collection(db, 'livefeed_sales')), {
          type: 'record',
          userName: record.ansatt,
          message: `🔥 ${record.ansatt} 🔥 NY REKORD ${typeLabel}: ${record.value}`,
          timestamp: new Date(),
          department: record.department,
          recordType: record.type,
          recordValue: record.value,
        });

        console.log(`🔥 NEW RECORD: ${record.ansatt} - ${typeLabel}: ${record.value} (${record.department})`);
      }
    } catch (err) {
      console.error('Error checking/posting record:', err);
    }
  };

  useEffect(() => {
    // Load Progresjon data from Admin
    const unsubscribeProgresjon = onSnapshot(collection(db, 'allente_progresjon'), async (snapshot) => {
      try {
        const records: Record[] = [];
        
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          records.push({
            ansatt: data.ansatt || '',
            dag: data.dag || 0,
            uke: data.uke || 0,
            måned: data.måned || 0,
            avdeling: data.avdeling || 'Unknown',
          });
        });

        console.log('📊 Progresjon loaded:', records.length, 'records');

        // Group by department and find best for each period
        const depts: { [key: string]: Record[] } = {
          KRS: [],
          OSL: [],
          Skien: [],
        };
        let projectAll: Record[] = [];

        records.forEach((r) => {
          if (depts[r.avdeling]) {
            depts[r.avdeling].push(r);
          }
          projectAll.push(r);
        });

        // Calculate best records for each department
        const newDeptRecords: { [dept: string]: { day: Record; week: Record; month: Record } } = {};
        
        Object.entries(depts).forEach(([dept, recs]) => {
          const bestDay = recs.reduce((max, r) => r.dag > max.dag ? r : max, recs[0] || { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: dept });
          const bestWeek = recs.reduce((max, r) => r.uke > max.uke ? r : max, recs[0] || { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: dept });
          const bestMonth = recs.reduce((max, r) => r.måned > max.måned ? r : max, recs[0] || { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: dept });
          
          newDeptRecords[dept] = { day: bestDay, week: bestWeek, month: bestMonth };

          // Check for new records
          checkAndPostNewRecord({ ansatt: bestDay.ansatt, department: dept, type: 'dag', value: bestDay.dag, timestamp: new Date().toISOString() });
          checkAndPostNewRecord({ ansatt: bestWeek.ansatt, department: dept, type: 'uke', value: bestWeek.uke, timestamp: new Date().toISOString() });
          checkAndPostNewRecord({ ansatt: bestMonth.ansatt, department: dept, type: 'måned', value: bestMonth.måned, timestamp: new Date().toISOString() });
        });

        // Calculate best records for project
        const bestDayAll = projectAll.reduce((max, r) => r.dag > max.dag ? r : max, projectAll[0] || { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'MUON' });
        const bestWeekAll = projectAll.reduce((max, r) => r.uke > max.uke ? r : max, projectAll[0] || { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'MUON' });
        const bestMonthAll = projectAll.reduce((max, r) => r.måned > max.måned ? r : max, projectAll[0] || { ansatt: '-', dag: 0, uke: 0, måned: 0, avdeling: 'MUON' });

        const newProjectRecords = { day: bestDayAll, week: bestWeekAll, month: bestMonthAll };

        // Check for new project records
        checkAndPostNewRecord({ ansatt: bestDayAll.ansatt, department: 'MUON', type: 'dag', value: bestDayAll.dag, timestamp: new Date().toISOString() });
        checkAndPostNewRecord({ ansatt: bestWeekAll.ansatt, department: 'MUON', type: 'uke', value: bestWeekAll.uke, timestamp: new Date().toISOString() });
        checkAndPostNewRecord({ ansatt: bestMonthAll.ansatt, department: 'MUON', type: 'måned', value: bestMonthAll.måned, timestamp: new Date().toISOString() });

        setDeptRecords(newDeptRecords);
        setProjectRecords(newProjectRecords);
        setLoading(false);

        console.log('🏆 Department records updated:', newDeptRecords);
        console.log('🏆 Project records updated:', newProjectRecords);
      } catch (err) {
        console.error('Error loading Progresjon:', err);
        setLoading(false);
      }
    });

    return () => unsubscribeProgresjon();
  }, []);

  if (loading) return <div style={{ marginLeft: '135px', paddingRight: '340px', padding: '2rem', color: '#999' }}>Laster...</div>;

  const RecordBox = ({ label, value, employee, emoji }: { label: string; value: number; employee: string; emoji: string }) => (
    <div style={{ background: '#2d3748', padding: '1.5rem', borderRadius: '12px', border: '2px solid #4b5563', textAlign: 'center', flex: 1, minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{emoji}</div>
      <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#9ca3af', marginBottom: '0.75rem', textTransform: 'uppercase' }}>{label}</h3>
      <p style={{ fontSize: '1.2rem', fontWeight: '700', color: '#8b5cf6', marginBottom: '0.5rem' }}>{employee}</p>
      <p style={{ fontSize: '2rem', fontWeight: '800', color: '#22c55e' }}>{value}</p>
    </div>
  );

  return (
    <div style={{ marginLeft: '135px', paddingRight: '340px', padding: '1.5rem', background: '#1a1a1a', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', textAlign: 'center' }}>🏆 WALL OF FAME</h1>

      {/* DEPARTMENT RECORDS */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '1rem', color: '#4db8ff' }}>AVDELINGER</h2>
        {Object.entries(deptRecords).map(([dept, records]) => (
          <div key={dept} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: dept === 'KRS' ? '#4db8ff' : dept === 'OSL' ? '#ff6b6b' : '#51cf66' }}>{dept}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <RecordBox label="BEST DAG" value={records.day.dag} employee={records.day.ansatt} emoji="☀️" />
              <RecordBox label="BEST UKE" value={records.week.uke} employee={records.week.ansatt} emoji="📅" />
              <RecordBox label="BEST MÅNED" value={records.month.måned} employee={records.month.ansatt} emoji="📊" />
            </div>
          </div>
        ))}
      </div>

      {/* PROJECT RECORDS */}
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '1rem', color: '#5a67d8' }}>MUON (HELE PROSJEKTET)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <RecordBox label="BEST DAG" value={projectRecords.day.dag} employee={projectRecords.day.ansatt} emoji="☀️" />
          <RecordBox label="BEST UKE" value={projectRecords.week.uke} employee={projectRecords.week.ansatt} emoji="📅" />
          <RecordBox label="BEST MÅNED" value={projectRecords.month.måned} employee={projectRecords.month.ansatt} emoji="📊" />
        </div>
      </div>
    </div>
  );
}
