import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Visualizations from './pages/Visualizations';
import XGBoostModel from './pages/XGBoostModel';
import AlertCenter from './pages/AlertCenter';
import SensorHeatmap from './pages/SensorHeatmap';
import EmergencyProcedures from './pages/EmergencyProcedures';
import Profile from './pages/Profile';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/"            element={<LandingPage />} />
        <Route path="/admin-login" element={<Login />} />
        <Route path="/login"       element={<Navigate to="/" replace />} />
        <Route path="/register"    element={<Navigate to="/" replace />} />

        {/* Protected routes inside Layout */}
        <Route path="/app" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="dashboard"      element={<Dashboard />} />
          <Route path="history"        element={<History />} />
          <Route path="visualizations" element={<Visualizations />} />
          <Route path="xgboost-model"  element={<XGBoostModel />} />
          <Route path="alerts"         element={<AlertCenter />} />
          <Route path="heatmap"        element={<SensorHeatmap />} />
          <Route path="emergency"      element={<EmergencyProcedures />} />
          <Route path="profile"        element={<Profile />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
