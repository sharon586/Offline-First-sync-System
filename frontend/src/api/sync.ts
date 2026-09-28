import apiClient from "./client";
import type {
  BulkSyncResponse,
  SyncOperation,
  DashboardStats,
  PaginatedResponse,
  SyncHistoryItem,
  Conflict,
} from "../types";

export const syncApi = {
  bulk: (operations: Omit<SyncOperation, "status" | "retry_count">[]) =>
    apiClient.post<BulkSyncResponse>("/sync/bulk", { operations }).then((r) => r.data),

  dashboard: () =>
    apiClient.get<DashboardStats>("/sync/dashboard").then((r) => r.data),

  history: (params: { status?: string; page?: number; size?: number } = {}) =>
    apiClient.get<PaginatedResponse<SyncHistoryItem>>("/sync/history", { params }).then((r) => r.data),

  conflicts: (params: { resolved?: boolean; page?: number; size?: number } = {}) =>
    apiClient.get<PaginatedResponse<Conflict>>("/sync/conflicts", { params }).then((r) => r.data),

  resolveConflict: (id: string, strategy: string, manual_data?: { [key: string]: unknown }) =>
    apiClient.post<Conflict>(`/sync/conflicts/${id}/resolve`, { strategy, manual_data }).then((r) => r.data),
};
