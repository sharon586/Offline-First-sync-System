import React, { useState } from "react";
import {
  Box, Button, Card, CardContent, TextField, Typography,
  Alert, Link, CircularProgress,
} from "@mui/material";
import { LockOutlined } from "@mui/icons-material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useSyncStore } from "../store/syncStore";
import { recordsApi } from "../api/records";
import { saveRecordLocal } from "../utils/indexedDB";

export default function LoginPage() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { loadLocalRecords } = useSyncStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login(form.username, form.password);
      setAuth(res.user, res.access_token);
      // seed local IndexedDB from server
      try {
        const records = await recordsApi.list({ size: 100 });
        for (const r of records.items) await saveRecordLocal(r);
        await loadLocalRecords();
      } catch { /* ignore seeding errors */ }
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="grey.100">
      <Card elevation={4} sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <Box sx={{ bgcolor: "primary.main", borderRadius: "50%", p: 1.5, mb: 1 }}>
              <LockOutlined sx={{ color: "white" }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>Sign In</Typography>
            <Typography variant="body2" color="text.secondary">Offline-First Sync System</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Username" margin="normal" required autoFocus
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <TextField
              fullWidth label="Password" type="password" margin="normal" required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button
              type="submit" fullWidth variant="contained" size="large"
              sx={{ mt: 3, mb: 2 }} disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Sign In"}
            </Button>
          </Box>

          <Typography variant="body2" textAlign="center">
            Don't have an account?{" "}
            <Link component={RouterLink} to="/register">Register</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
