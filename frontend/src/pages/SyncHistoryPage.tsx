import React, { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Select, MenuItem, FormControl, InputLabel, Pagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from "@mui/material";
import { syncApi } from "../api/sync";
import type { SyncHistoryItem, PaginatedResponse } from "../types";

const statusColor = (s: string) => s === "success" ? "success" : s === "failed" ? "error" : "warning";

export default function SyncHistoryPage() {
  const [data, setData] = useState<PaginatedResponse<SyncHistoryItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const res = await syncApi.history({ status: statusFilter || undefined, page, size: 20 });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, page]);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={3}>Sync History</Typography>

      <Box mb={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="success">Success</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="conflict">Conflict</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Record</TableCell>
                  <TableCell>Operation</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Conflict</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{item.id.slice(0, 8)}…</TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{item.record_id?.slice(0, 8) ?? "—"}…</TableCell>
                    <TableCell><Chip label={item.operation} size="small" variant="outlined" /></TableCell>
                    <TableCell><Chip label={item.status} size="small" color={statusColor(item.status) as any} /></TableCell>
                    <TableCell>{item.conflict_status ? <Chip label="Yes" size="small" color="warning" /> : "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{new Date(item.timestamp).toLocaleString()}</TableCell>
                    <TableCell sx={{ fontSize: 11, color: "error.main" }}>{item.error_details || "—"}</TableCell>
                  </TableRow>
                ))}
                {data?.items.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>No sync history found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination count={Math.ceil((data?.total || 0) / 20)} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
        </>
      )}
    </Box>
  );
}
