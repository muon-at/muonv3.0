import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider } from './lib/authContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useServiceWorkerUpdate } from './lib/useServiceWorkerUpdate';
import SalesLivefeed from './components/SalesLivefeed';
import RevenueDisplay from './components/RevenueDisplay';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import MinSide from './pages/MinSide';
import Chat from './pages/Chat';
import Teamleder from './pages/Teamleder';
import AdminDashboard from './pages/AdminDashboard';
import Status from './pages/Status';
import Records from './pages/Records';
import Earnings from './pages/Earnings';
import MittProsjekt from './pages/MittProsjekt';
import AvdelingDashboard from './pages/AvdelingDashboard';
import LiveKRS from './pages/LiveKRS';
import LiveOSL from './pages/LiveOSL';
import LiveSkien from './pages/LiveSkien';

import MissingEmployees from './pages/MissingEmployees';
import MobileHome from './pages/MobileHome';
import MobileChat from './pages/MobileChat';
import MobileChatConversation from './pages/MobileChatConversation';
import MobileMinSide from './pages/MobileMinSide';
import MobileGoals from './pages/MobileGoals';
import MobileLonn from './pages/MobileLonn';
import MobileTeam from './pages/MobileTeam';
import MobileCalendar from './pages/MobileCalendar';
import './App.css';

function RoutedContent() {
  const [revenueAmount, setRevenueAmount] = useState<number | null>(null);
  const location = useLocation();
  
  // Initialize service worker updates
  useServiceWorkerUpdate();

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme') || 'original';
    document.body.classList.remove('theme-christmas', 'theme-halloween', 'theme-newyear', 'theme-easter');
    if (savedTheme !== 'original') {
      document.body.classList.add(`theme-${savedTheme}`);
    }
  }, []);

  // Show livefeed only on Min Side routes (NOT on LIVE pages - they have their own ticker)
  const showLivefeed = ['/status', '/records', '/earnings', '/calendar', '/mitt-prosjekt', '/min-avdeling'].includes(location.pathname);

  return (
    <>
      <RevenueDisplay amount={revenueAmount} />
      {showLivefeed && <SalesLivefeed onPostAdded={(price) => setRevenueAmount(price)} />}
      <Routes>
        <Route path="/" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password-first-login" element={<ResetPassword />} />
          {/* Public preview route - no auth required */}
          <Route path="/min-side-preview" element={<MinSide />} />
          {/* Mobile home screen */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileHome />
              </ProtectedRoute>
            } 
          />
          {/* Mobile chat screens */}
          <Route 
            path="/home/chat" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileChat />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/home/chat/:type/:id" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileChatConversation />
              </ProtectedRoute>
            } 
          />
          {/* Mobile min side screen */}
          <Route 
            path="/home/min-side" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileMinSide />
              </ProtectedRoute>
            } 
          />
          {/* Mobile goals editor screen */}
          <Route 
            path="/home/mine-mal" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileGoals />
              </ProtectedRoute>
            } 
          />
          {/* Mobile lønn screen */}
          <Route 
            path="/home/lonn" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileLonn />
              </ProtectedRoute>
            } 
          />
          {/* Mobile team screen */}
          <Route 
            path="/home/team" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileTeam />
              </ProtectedRoute>
            } 
          />
          {/* Mobile calendar screen */}
          <Route 
            path="/home/calendar" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileCalendar />
              </ProtectedRoute>
            } 
          />
          {/* Protected route for normal use */}
          <Route 
            path="/min-side" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MinSide />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teamleder" 
            element={
              <ProtectedRoute requiredRole="teamleder">
                <Teamleder />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/live-krs" 
            element={
              <ProtectedRoute requiredRole="teamleder">
                <LiveKRS />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/live-osl" 
            element={
              <ProtectedRoute requiredRole="teamleder">
                <LiveOSL />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/live-skien" 
            element={
              <ProtectedRoute requiredRole="teamleder">
                <LiveSkien />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute requiredRole="owner">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/missing-employees"
            element={
              <ProtectedRoute requiredRole="employee">
                <MissingEmployees />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/min-avdeling" 
            element={
              <ProtectedRoute requiredRole="employee">
                <AvdelingDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat" 
            element={
              <ProtectedRoute requiredRole="employee">
                <Chat />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/status" 
            element={
              <ProtectedRoute requiredRole="employee">
                <Status />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/records" 
            element={
              <ProtectedRoute requiredRole="employee">
                <Records />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/earnings" 
            element={
              <ProtectedRoute requiredRole="employee">
                <Earnings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/mitt-prosjekt" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MittProsjekt />
              </ProtectedRoute>
            } 
          />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <RoutedContent />
      </Router>
    </AuthProvider>
  );
}

export default App;

