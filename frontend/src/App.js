import { useState, useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DeviceScanner from "./pages/DeviceScanner";
import VMManagement from "./pages/VMManagement";
import AIAssistant from "./pages/AIAssistant";
import ActionQueue from "./pages/ActionQueue";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import FileBrowser from "./pages/FileBrowserNew";
import BackupManager from "./pages/BackupManager";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ConnectionProvider, useConnections } from "./contexts/ConnectionContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Axios interceptor for auth
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Inner component that has access to ConnectionContext
function AppContent({ isAuthenticated, handleLogin, handleLogout }) {
  const { loadAllConnections } = useConnections();
  const hasLoadedRef = useRef(false);

  // Reload connections when user logs in
  useEffect(() => {
    if (isAuthenticated && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // Small delay to ensure token is set
      setTimeout(() => {
        loadAllConnections();
      }, 100);
    } else if (!isAuthenticated) {
      hasLoadedRef.current = false;
    }
  }, [isAuthenticated, loadAllConnections]);

  return (
    <div className="App">
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <Login onLogin={handleLogin} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Dashboard onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/devices"
            element={
              isAuthenticated ? (
                <DeviceScanner onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/vms"
            element={
              isAuthenticated ? (
                <VMManagement onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/ai-assistant"
            element={
              isAuthenticated ? (
                <AIAssistant onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/actions"
            element={
              isAuthenticated ? (
                <ActionQueue onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/audit-log"
            element={
              isAuthenticated ? (
                <AuditLog onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/settings"
            element={
              isAuthenticated ? (
                <Settings onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/files"
            element={
              isAuthenticated ? (
                <FileBrowser onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/backups"
            element={
              isAuthenticated ? (
                <BackupManager onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  const handleLogin = (token, username) => {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ConnectionProvider>
        <AppContent 
          isAuthenticated={isAuthenticated}
          handleLogin={handleLogin}
          handleLogout={handleLogout}
        />
      </ConnectionProvider>
    </ThemeProvider>
  );
}

export default App;
