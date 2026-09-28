import React, { useState } from "react";
import {
  Box, Button, Card, CardContent, TextField, Typography,
  Alert, Link, CircularProgress,
} from "@mui/material";
import { PersonAdd } from "@mui/icons-material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { authApi } from "../api/auth";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.register(form);
      navigate("/login", { state: { message: "Account created! Please sign in." } });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="grey.100">
      <Card elevation={4} sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <Box sx={{ bgcolor: "secondary.main", borderRadius: "50%", p: 1.5, mb: 1 }}>
              <PersonAdd sx={{ color: "white" }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>Create Account</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth label="Full Name" margin="normal" value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <TextField fullWidth label="Username" margin="normal" required value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <TextField fullWidth label="Email" type="email" margin="normal" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField fullWidth label="Password" type="password" margin="normal" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              helperText="Minimum 6 characters" />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, mb: 2 }} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : "Create Account"}
            </Button>
          </Box>

          <Typography variant="body2" textAlign="center">
            Already have an account?{" "}
            <Link component={RouterLink} to="/login">Sign in</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
