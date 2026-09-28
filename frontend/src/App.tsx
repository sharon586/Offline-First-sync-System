import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import RecordsPage from "./pages/RecordsPage";
import SyncHistoryPage from "./pages/SyncHistoryPage";
import ConflictsPage from "./pages/ConflictsPage";
import ProfilePage from "./pages/ProfilePage";
import { useAuthStore } from "./store/authStore";
import { useSyncStore } from "./store/syncStore";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#9c27b0" },
    background: { default: "#f5f7fa" },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: "'Inter', 'Roboto', sans-serif" },
  components: {
    MuiCard: { defaultProps: { elevation: 1 } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const { loadLocalRecords, refreshPendingCount } = useSyncStore();

  useEffect(() => {
    if (isAuthenticated()) {
      loadLocalRecords();
      refreshPendingCount();
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="records" element={<RecordsPage />} />
            <Route path="sync-history" element={<SyncHistoryPage />} />
            <Route path="conflicts" element={<ConflictsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
