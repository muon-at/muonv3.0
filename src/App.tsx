import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MinSide from './pages/MinSide';
import Teamleder from './pages/Teamleder';
import Admin from './pages/Admin';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MinSide />} />
        <Route path="/teamleder" element={<Teamleder />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

