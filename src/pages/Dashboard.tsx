import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/Dashboard.css';

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

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const employeesRef = collection(db, 'employees');
        const snapshot = await getDocs(employeesRef);
        
        const employeeList: Employee[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
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
        setError(`Feil ved henting av data: ${err}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  if (loading) return <div className="dashboard">Laster ansattliste...</div>;
  if (error) return <div className="dashboard error">{error}</div>;

  return (
    <div className="dashboard">
      <h1>📊 Muon Dashboard</h1>
      <p className="employee-count">{employees.length} ansatte</p>
      <div className="employees-grid">
        {employees.length > 0 ? (
          employees.map((emp) => (
            <div key={emp.id} className="employee-card">
              <h3>{emp.name}</h3>
              {emp.role && <p className="role"><strong>🎯 Rolle:</strong> {emp.role}</p>}
              {emp.department && <p><strong>🏢 Avdeling:</strong> {emp.department}</p>}
              {emp.project && <p><strong>📋 Prosjekt:</strong> {emp.project}</p>}
              {emp.employment_type && <p><strong>📌 Type:</strong> {emp.employment_type}</p>}
              {emp.email && <p><strong>📧 Email:</strong> {emp.email}</p>}
              {emp.slackName && <p className="slack"><strong>💬 Slack:</strong> {emp.slackName}</p>}
              {emp.externalName && <p><strong>👤 Navn (Ekstern):</strong> {emp.externalName}</p>}
              {emp.tmgName && <p><strong>🎧 TMG Navn:</strong> {emp.tmgName}</p>}
            </div>
          ))
        ) : (
          <p>Ingen ansatte å vise</p>
        )}
      </div>
    </div>
  );
}
