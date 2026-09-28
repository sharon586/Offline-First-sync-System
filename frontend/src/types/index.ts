export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
}

export interface AppRecord {
  id: string;
  user_id: string;
  title: string;
  content?: string;
  tags: string[];
  status: "active" | "archived" | "deleted";
  version: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  _local?: boolean;
  _pendingOp?: "create" | "update" | "delete";
}

export interface SyncOperation {
  id: string;
  record_id: string;
  operation: "create" | "update" | "delete";
  payload: { [key: string]: unknown };
  client_timestamp: string;
  status: "pending" | "synced" | "failed" | "conflict";
  retry_count: number;
  error_message?: string;
}

export interface SyncResult {
  operation_id: string;
  record_id: string;
  status: "synced" | "failed" | "conflict";
  message?: string;
  conflict_id?: string;
}

export interface BulkSyncResponse {
  results: SyncResult[];
  synced: number;
  failed: number;
  conflicts: number;
}

export interface SyncHistoryItem {
  id: string;
  user_id: string;
  record_id?: string;
  operation: string;
  status: string;
  error_details?: string;
  conflict_status: boolean;
  timestamp: string;
}

export interface Conflict {
  id: string;
  record_id: string;
  user_id: string;
  client_data: { [key: string]: unknown };
  server_data: { [key: string]: unknown };
  resolution_strategy?: string;
  resolved: boolean;
  resolved_data?: { [key: string]: unknown };
  created_at: string;
  resolved_at?: string;
}

export interface DashboardStats {
  total_records: number;
  pending_changes: number;
  synced_records: number;
  failed_syncs: number;
  unresolved_conflicts: number;
  last_sync_time?: string;
  sync_success_rate: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type NetworkStatus = "online" | "offline";
