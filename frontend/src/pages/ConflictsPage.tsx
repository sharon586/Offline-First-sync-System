import React, { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  RadioGroup, FormControlLabel, Radio, TextField, Pagination,
  Accordion, AccordionSummary, AccordionDetails, Alert,
} from "@mui/material";
import { ExpandMore, Warning, CheckCircle } from "@mui/icons-material";
import { syncApi } from "../api/sync";
import type { Conflict, PaginatedResponse } from "../types";

export default function ConflictsPage() {
  const [data, setData] = useState<PaginatedResponse<Conflict> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [resolveDialog, setResolveDialog] = useState<Conflict | null>(null);
  const [strategy, setStrategy] = useState("server_wins");
  const [manualData, setManualData] = useState("");
  const [resolving, setResolving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await syncApi.conflicts({ resolved: showResolved ? undefined : false, page, size: 10 });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, showResolved]);

  const handleResolve = async () => {
    if (!resolveDialog) return;
    setResolving(true);
    try {
      let manual: Record<string, unknown> | undefined;
      if (strategy === "manual") {
        manual = JSON.parse(manualData);
      }
      await syncApi.resolveConflict(resolveDialog.id, strategy, manual);
      setResolveDialog(null);
      load();
    } catch (e: any) {
      alert("Error: " + (e.message || "Could not resolve conflict"));
    } finally {
      setResolving(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>Conflicts</Typography>
        <Button variant="outlined" size="small" onClick={() => { setShowResolved(!showResolved); setPage(1); }}>
          {showResolved ? "Show Unresolved Only" : "Show All"}
        </Button>
      </Box>

      {!loading && data?.total === 0 && (
        <Alert severity="success" icon={<CheckCircle />}>No unresolved conflicts — everything is in sync!</Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
      ) : (
        <>
          {data?.items.map((conflict) => (
            <Card key={conflict.id} elevation={2} sx={{ mb: 2, borderLeft: conflict.resolved ? "4px solid #4caf50" : "4px solid #ff9800" }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Record: <code style={{ fontSize: 12 }}>{conflict.record_id.slice(0, 16)}…</code>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Created: {new Date(conflict.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1} alignItems="center">
                    <Chip
                      icon={conflict.resolved ? <CheckCircle /> : <Warning />}
                      label={conflict.resolved ? "Resolved" : "Unresolved"}
                      color={conflict.resolved ? "success" : "warning"}
                      size="small"
                    />
                    {conflict.resolution_strategy && (
                      <Chip label={conflict.resolution_strategy} size="small" variant="outlined" />
                    )}
                    {!conflict.resolved && (
                      <Button variant="contained" size="small" onClick={() => {
                        setResolveDialog(conflict);
                        setStrategy("server_wins");
                        setManualData(JSON.stringify(conflict.client_data, null, 2));
                      }}>
                        Resolve
                      </Button>
                    )}
                  </Box>
                </Box>

                <Box display="flex" gap={2} mt={1}>
                  <Accordion sx={{ flex: 1 }} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="body2" fontWeight={600} color="primary">Client Data</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre style={{ fontSize: 11, overflow: "auto", margin: 0 }}>
                        {JSON.stringify(conflict.client_data, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                  <Accordion sx={{ flex: 1 }} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="body2" fontWeight={600} color="secondary">Server Data</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre style={{ fontSize: 11, overflow: "auto", margin: 0 }}>
                        {JSON.stringify(conflict.server_data, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              </CardContent>
            </Card>
          ))}
          {(data?.total || 0) > 10 && (
            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination count={Math.ceil((data?.total || 0) / 10)} page={page} onChange={(_, p) => setPage(p)} />
            </Box>
          )}
        </>
      )}

      <Dialog open={!!resolveDialog} onClose={() => setResolveDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Conflict</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Choose how to resolve this conflict between client and server versions.
          </Typography>
          <RadioGroup value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <FormControlLabel value="server_wins" control={<Radio />} label="Server wins — keep server version" />
            <FormControlLabel value="client_wins" control={<Radio />} label="Client wins — use client version" />
            <FormControlLabel value="last_write_wins" control={<Radio />} label="Last write wins — use most recently modified" />
            <FormControlLabel value="manual" control={<Radio />} label="Manual — edit the data below" />
          </RadioGroup>
          {strategy === "manual" && (
            <TextField
              fullWidth multiline rows={8} margin="normal"
              label="Resolved JSON"
              value={manualData}
              onChange={(e) => setManualData(e.target.value)}
              inputProps={{ style: { fontFamily: "monospace", fontSize: 12 } }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialog(null)}>Cancel</Button>
          <Button onClick={handleResolve} variant="contained" disabled={resolving}>
            {resolving ? "Resolving…" : "Apply Resolution"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
