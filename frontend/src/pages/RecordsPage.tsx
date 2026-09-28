import React, { useEffect, useState } from "react";
import {
  Box, Button, Card, CardContent, Typography, TextField,
  IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  Tooltip, CircularProgress, InputAdornment, Pagination,
} from "@mui/material";
import { Add, Edit, Delete, Search, WifiOff, CloudDone } from "@mui/icons-material";
import { useSyncStore } from "../store/syncStore";
import { recordsApi } from "../api/records";
import type { AppRecord } from "../types";

const emptyForm = { title: "", content: "", tags: "", status: "active" };

export default function RecordsPage() {
  const { networkStatus, createRecord, updateRecord, deleteRecord, localRecords, loadLocalRecords } = useSyncStore();
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AppRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const PAGE_SIZE = 10;

  const loadRecords = async () => {
    setLoading(true);
    if (networkStatus === "online") {
      try {
        const res = await recordsApi.list({ search, status: statusFilter || undefined, page, size: PAGE_SIZE });
        setRecords(res.items);
        setTotal(res.total);
        setLoading(false);
        return;
      } catch { /* fall to local */ }
    }
    await loadLocalRecords();
    let filtered = localRecords.filter((r) => !r.is_deleted);
    if (search) filtered = filtered.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
    setTotal(filtered.length);
    setRecords(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, [networkStatus, search, statusFilter, page]);

  const openCreate = () => { setEditRecord(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: AppRecord) => {
    setEditRecord(r);
    setForm({ title: r.title, content: r.content || "", tags: (r.tags || []).join(", "), status: r.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const data = { title: form.title, content: form.content, tags, status: form.status as AppRecord["status"] };
    if (editRecord) {
      await updateRecord(editRecord.id, data);
    } else {
      await createRecord(data);
    }
    setDialogOpen(false);
    loadRecords();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this record?")) return;
    await deleteRecord(id);
    loadRecords();
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>Records</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>New Record</Button>
      </Box>

      {networkStatus === "offline" && (
        <Chip icon={<WifiOff />} label="Offline mode — changes queued for sync" color="warning" sx={{ mb: 2 }} />
      )}

      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <TextField
          size="small" placeholder="Search records..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
          sx={{ minWidth: 240 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : records.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary" textAlign="center">No records found. Create one to get started.</Typography></CardContent></Card>
      ) : (
        <>
          {records.map((r) => (
            <Card key={r.id} elevation={1} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flexGrow={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="h6">{r.title}</Typography>
                      {r._local
                        ? <Tooltip title="Local only — not yet synced"><WifiOff fontSize="small" color="warning" /></Tooltip>
                        : <CloudDone fontSize="small" color="success" />
                      }
                      <Chip label={r.status} size="small" color={r.status === "active" ? "success" : "default"} />
                    </Box>
                    {r.content && <Typography variant="body2" color="text.secondary" noWrap>{r.content}</Typography>}
                    <Box display="flex" gap={0.5} mt={1} flexWrap="wrap">
                      {(r.tags || []).map((t) => <Chip key={t} label={t} size="small" variant="outlined" />)}
                    </Box>
                    <Typography variant="caption" color="text.secondary" mt={1} display="block">
                      v{r.version} · Updated {new Date(r.updated_at).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <IconButton onClick={() => openEdit(r)}><Edit /></IconButton>
                    <IconButton onClick={() => handleDelete(r.id)} color="error"><Delete /></IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination count={Math.ceil(total / PAGE_SIZE)} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRecord ? "Edit Record" : "New Record"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} margin="normal" required />
          <TextField fullWidth label="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} margin="normal" multiline rows={4} />
          <TextField fullWidth label="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select value={form.status} label="Status" onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!form.title}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
