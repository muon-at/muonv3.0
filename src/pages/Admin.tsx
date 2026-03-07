import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Admin() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to AdminDashboard which has all the tabs (Dashboard, Organisasjon, Allente)
    navigate('/admin-dashboard');
  }, [navigate]);

  return null; // This page just redirects
}
