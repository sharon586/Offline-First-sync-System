import React, { useState } from "react";
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
  Badge, Chip, Tooltip, Avatar,
} from "@mui/material";
import {
  Menu as MenuIcon, Dashboard, Storage, History, Warning,
  Sync, SyncProblem, WifiOff, Wifi, Person, Logout,
} from "@mui/icons-material";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useSyncStore } from "../../store/syncStore";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

const DRAWER_WIDTH = 240;

const navItems = [
  { label: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
  { label: "Records", icon: <Storage />, path: "/records" },
  { label: "Sync History", icon: <History />, path: "/sync-history" },
  { label: "Conflicts", icon: <Warning />, path: "/conflicts" },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { pendingCount, isSyncing, sync } = useSyncStore();
  const networkStatus = useNetworkStatus();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const drawerContent = (
    <Box>
      <Toolbar>
        <Typography variant="h6" fontWeight={700} color="primary">
          OfflineSync
        </Typography>
      </Toolbar>
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Offline-First Sync System
          </Typography>

          <Tooltip title={networkStatus === "online" ? "Online" : "Offline"}>
            <Chip
              icon={networkStatus === "online" ? <Wifi /> : <WifiOff />}
              label={networkStatus === "online" ? "Online" : "Offline"}
              color={networkStatus === "online" ? "success" : "error"}
              size="small"
              sx={{ mr: 1 }}
            />
          </Tooltip>

          {pendingCount > 0 && (
            <Tooltip title={`${pendingCount} pending changes`}>
              <IconButton color="inherit" onClick={sync} disabled={isSyncing || networkStatus === "offline"}>
                <Badge badgeContent={pendingCount} color="warning">
                  {isSyncing ? <Sync sx={{ animation: "spin 1s linear infinite", "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} /> : <SyncProblem />}
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          <Avatar sx={{ bgcolor: "secondary.main", ml: 1, width: 32, height: 32, cursor: "pointer" }} onClick={() => navigate("/profile")}>
            {user?.username?.[0]?.toUpperCase()}
          </Avatar>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={handleLogout}>
              <Logout />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, display: { xs: "none", sm: "block" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" } }} open>
        {drawerContent}
      </Drawer>
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { xs: "block", sm: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}>
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
