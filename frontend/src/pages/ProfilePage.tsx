import React, { useState } from "react";
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Avatar, Alert, Divider, Chip,
} from "@mui/material";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { useSyncStore } from "../store/syncStore";
import { clearLocalRecords, clearPendingOps } from "../utils/indexedDB";

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore();
  const { pendingCount, lastSyncTime } = useSyncStore();
  const [form, setForm] = useState({ full_name: user?.full_name || "", email: user?.email || "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(""); setError("");
    try {
      const updated = await authApi.updateProfile(form);
      setAuth(updated, localStorage.getItem("token")!);
      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearLocal = async () => {
    if (!window.confirm("Clear all local data and pending sync operations?")) return;
    await clearLocalRecords();
    await clearPendingOps();
    window.location.reload();
  };

  return (
    <Box maxWidth={600} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={3}>Profile</Typography>

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.main", fontSize: 28 }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6">{user?.username}</Typography>
              <Chip label={user?.role} size="small" color={user?.role === "admin" ? "error" : "default"} />
            </Box>
          </Box>

          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSave}>
            <TextField fullWidth label="Full Name" margin="normal" value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <TextField fullWidth label="Email" type="email" margin="normal" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField fullWidth label="Username" margin="normal" value={user?.username || ""} disabled />
            <TextField fullWidth label="Member Since" margin="normal"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ""} disabled />
            <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" mb={2}>Sync Status</Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Typography variant="body2">
              Pending Operations: <strong>{pendingCount}</strong>
            </Typography>
            <Typography variant="body2">
              Last Sync: <strong>{lastSyncTime?.toLocaleString() || "Never"}</strong>
            </Typography>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary" mb={1}>
            Danger Zone: Clear all locally cached data and pending operations.
          </Typography>
          <Button variant="outlined" color="error" size="small" onClick={handleClearLocal}>
            Clear Local Data
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
