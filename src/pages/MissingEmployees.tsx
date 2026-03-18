import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MissingEmployee {
  name: string;
  count: number;
  latestDate: string;
}

export default function MissingEmployees() {
  const [missingEmployees, setMissingEmployees] = useState<MissingEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to employees
    const employeesRef = collection(db, 'employees');
    const employeeUnsub = onSnapshot(employeesRef, (empSnapshot) => {
      const peopleNames = new Set<string>();
      
      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        peopleNames.add(data.name);
        if (data.externalName) {
          peopleNames.add(data.externalName);
        }
      });

      // Listen to contracts
      const contractsRef = collection(db, 'allente_kontraktsarkiv');
      const contractUnsub = onSnapshot(contractsRef, (contractSnapshot) => {
        const sellerCounts: { [key: string]: { count: number; latestDate: string } } = {};

        contractSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          let selger = data.selger || '';
          selger = selger.replace(/ \/ selger$/i, '').trim();

          if (!selger) return;

          if (!sellerCounts[selger]) {
            sellerCounts[selger] = { count: 0, latestDate: '' };
          }
          sellerCounts[selger].count += 1;

          const dato = data.dato || '';
          if (dato > sellerCounts[selger].latestDate) {
            sellerCounts[selger].latestDate = dato;
          }
        });

        // Find missing
        const missing: MissingEmployee[] = Object.entries(sellerCounts)
          .filter(([name]) => !peopleNames.has(name))
          .map(([name, data]) => ({
            name,
            count: data.count,
            latestDate: data.latestDate,
          }))
          .sort((a, b) => b.count - a.count);

        setMissingEmployees(missing);
        setLoading(false);
      });

      return () => contractUnsub();
    });

    return () => employeeUnsub();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', color: '#999' }}>Laster...</div>;
  }

  return (
    <div style={{ padding: '2rem', color: '#e2e8f0' }}>
      <h1>Manglende ansatte i People</h1>
      
      {missingEmployees.length === 0 ? (
        <p style={{ color: '#90ee90', fontSize: '1.2rem' }}>
          ✅ Alle selgere fra arkivet finnes i People! Perfekt!
        </p>
      ) : (
        <>
          <p style={{ color: '#ffb347', marginBottom: '1.5rem' }}>
            ⚠️ {missingEmployees.length} selger finnes i arkivet men IKKE i People:
          </p>
          
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '1rem',
            border: '1px solid #5a67d8',
          }}>
            <thead>
              <tr style={{ backgroundColor: '#2d3748' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #5a67d8' }}>Navn</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #5a67d8' }}>Antall kontrakter</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #5a67d8' }}>Siste dato</th>
              </tr>
            </thead>
            <tbody>
              {missingEmployees.map((emp) => (
                <tr key={emp.name} style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#ffb347' }}>{emp.name}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#90ee90' }}>{emp.count}</td>
                  <td style={{ padding: '0.75rem', color: '#b0b0b0' }}>{emp.latestDate}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: '1.5rem', color: '#b0b0b0', fontSize: '0.9rem' }}>
            💡 Disse må legges til i People med riktig Avdeling for at salget skal telles på riktig avdeling.
          </p>
        </>
      )}
    </div>
  );
}
