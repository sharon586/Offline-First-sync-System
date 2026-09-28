import React, { useEffect, useState } from "react";
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress,
  LinearProgress, Chip, Button,
} from "@mui/material";
import {
  Storage, CheckCircle, Error, Warning, Sync, Schedule,
} from "@mui/icons-material";
import { syncApi } from "../api/sync";
import { useSyncStore } from "../store/syncStore";
import type { DashboardStats } from "../types";

const StatCard = ({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) => (
  <Card elevation={2}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
          <Typography variant="h4" fontWeight={700}>{value}</Typography>
        </Box>
        <Box sx={{ bgcolor: `${color}.light`, borderRadius: 2, p: 1, color: `${color}.main` }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { sync, isSyncing, networkStatus, lastSyncTime } = useSyncStore();

  const loadStats = async () => {
    try {
      const data = await syncApi.dashboard();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>Dashboard</Typography>
        <Box display="flex" gap={1} alignItems="center">
          <Chip label={networkStatus} color={networkStatus === "online" ? "success" : "error"} size="small" />
          <Button variant="contained" startIcon={<Sync />} onClick={sync} disabled={isSyncing || networkStatus === "offline"}>
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Total Records" value={stats?.total_records || 0} icon={<Storage />} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Pending Changes" value={stats?.pending_changes || 0} icon={<Schedule />} color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Synced Records" value={stats?.synced_records || 0} icon={<CheckCircle />} color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Failed Syncs" value={stats?.failed_syncs || 0} icon={<Error />} color="error" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Unresolved Conflicts" value={stats?.unresolved_conflicts || 0} icon={<Warning />} color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard title="Success Rate" value={`${stats?.sync_success_rate || 0}%`} icon={<CheckCircle />} color="info" />
        </Grid>
      </Grid>

      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" mb={2}>Sync Success Rate</Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Box flexGrow={1}>
              <LinearProgress variant="determinate" value={stats?.sync_success_rate || 0} sx={{ height: 10, borderRadius: 5 }} color="success" />
            </Box>
            <Typography variant="body2" fontWeight={600}>{stats?.sync_success_rate || 0}%</Typography>
          </Box>
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary">
              Last Sync: {stats?.last_sync_time ? new Date(stats.last_sync_time).toLocaleString() : lastSyncTime?.toLocaleString() || "Never"}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
