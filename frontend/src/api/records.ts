import apiClient from "./client";
import type { AppRecord, PaginatedResponse } from "../types";

export interface RecordFilters {
  search?: string;
  status?: string;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_order?: string;
}

export const recordsApi = {
  list: (filters: RecordFilters = {}) =>
    apiClient.get<PaginatedResponse<AppRecord>>("/records", { params: filters }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<AppRecord>(`/records/${id}`).then((r) => r.data),

  create: (data: Partial<AppRecord>) =>
    apiClient.post<AppRecord>("/records", data).then((r) => r.data),

  update: (id: string, data: Partial<AppRecord>) =>
    apiClient.put<AppRecord>(`/records/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/records/${id}`),
};
