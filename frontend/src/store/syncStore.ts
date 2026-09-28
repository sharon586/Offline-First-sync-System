import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { AppRecord, SyncOperation, NetworkStatus } from "../types";
import {
  saveRecordLocal,
  getRecordsLocal,
  deleteRecordLocal,
  addPendingOp,
  getPendingOps,
  removePendingOp,
  getPendingOpCount,
} from "../utils/indexedDB";
import { syncApi } from "../api/sync";
import { recordsApi } from "../api/records";

interface SyncState {
  networkStatus: NetworkStatus;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  localRecords: AppRecord[];

  setNetworkStatus: (status: NetworkStatus) => void;
  refreshPendingCount: () => Promise<void>;
  loadLocalRecords: () => Promise<void>;

  createRecord: (data: Partial<AppRecord>) => Promise<AppRecord>;
  updateRecord: (id: string, data: Partial<AppRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  sync: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  networkStatus: navigator.onLine ? "online" : "offline",
  pendingCount: 0,
  isSyncing: false,
  lastSyncTime: null,
  localRecords: [],

  setNetworkStatus: (status) => set({ networkStatus: status }),

  refreshPendingCount: async () => {
    const count = await getPendingOpCount();
    set({ pendingCount: count });
  },

  loadLocalRecords: async () => {
    const records = await getRecordsLocal();
    set({ localRecords: records.filter((r) => !r.is_deleted) });
  },

  createRecord: async (data) => {
    const record: AppRecord = {
      id: uuidv4(),
      user_id: "",
      title: data.title || "Untitled",
      content: data.content,
      tags: data.tags || [],
      status: "active",
      version: 1,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _local: true,
      _pendingOp: "create",
    };

    if (get().networkStatus === "online") {
      try {
        const serverRecord = await recordsApi.create(data);
        await saveRecordLocal(serverRecord);
        set((s) => ({ localRecords: [serverRecord, ...s.localRecords] }));
        return serverRecord;
      } catch {
        // fall through to offline path
      }
    }

    await saveRecordLocal(record);
    const op: SyncOperation = {
      id: uuidv4(),
      record_id: record.id,
      operation: "create",
      payload: { title: record.title, content: record.content, tags: record.tags, status: record.status },
      client_timestamp: record.created_at,
      status: "pending",
      retry_count: 0,
    };
    await addPendingOp(op);
    set((s) => ({ localRecords: [record, ...s.localRecords], pendingCount: s.pendingCount + 1 }));
    return record;
  },

  updateRecord: async (id, data) => {
    const { localRecords, networkStatus } = get();
    const existing = localRecords.find((r) => r.id === id);
    const updated: AppRecord = {
      ...(existing as AppRecord),
      ...data,
      updated_at: new Date().toISOString(),
      _pendingOp: "update",
    };

    if (networkStatus === "online") {
      try {
        const serverRecord = await recordsApi.update(id, data);
        await saveRecordLocal(serverRecord);
        set((s) => ({ localRecords: s.localRecords.map((r) => (r.id === id ? serverRecord : r)) }));
        return;
      } catch {
        // fall through
      }
    }

    await saveRecordLocal(updated);
    const op: SyncOperation = {
      id: uuidv4(),
      record_id: id,
      operation: "update",
      payload: {
        title: updated.title,
        content: updated.content,
        tags: updated.tags,
        status: updated.status,
        version: existing?.version || 1,
      },
      client_timestamp: updated.updated_at,
      status: "pending",
      retry_count: 0,
    };
    await addPendingOp(op);
    set((s) => ({
      localRecords: s.localRecords.map((r) => (r.id === id ? updated : r)),
      pendingCount: s.pendingCount + 1,
    }));
  },

  deleteRecord: async (id) => {
    if (get().networkStatus === "online") {
      try {
        await recordsApi.delete(id);
        await deleteRecordLocal(id);
        set((s) => ({ localRecords: s.localRecords.filter((r) => r.id !== id) }));
        return;
      } catch {
        // fall through
      }
    }

    const existing = get().localRecords.find((r) => r.id === id);
    if (existing) {
      await saveRecordLocal({ ...existing, is_deleted: true, _pendingOp: "delete" });
    }
    const op: SyncOperation = {
      id: uuidv4(),
      record_id: id,
      operation: "delete",
      payload: {},
      client_timestamp: new Date().toISOString(),
      status: "pending",
      retry_count: 0,
    };
    await addPendingOp(op);
    set((s) => ({
      localRecords: s.localRecords.filter((r) => r.id !== id),
      pendingCount: s.pendingCount + 1,
    }));
  },

  sync: async () => {
    if (get().isSyncing || get().networkStatus === "offline") return;
    set({ isSyncing: true });
    try {
      const ops = await getPendingOps();
      if (ops.length === 0) {
        set({ isSyncing: false, lastSyncTime: new Date() });
        return;
      }
      const response = await syncApi.bulk(ops);
      for (const result of response.results) {
        if (result.status === "synced" || result.status === "conflict") {
          const op = ops.find((o) => o.record_id === result.record_id);
          if (op) await removePendingOp(op.id);
        }
      }
      const serverRecords = await recordsApi.list({ size: 100 });
      for (const r of serverRecords.items) await saveRecordLocal(r);
      await get().loadLocalRecords();
      const count = await getPendingOpCount();
      set({ pendingCount: count, lastSyncTime: new Date() });
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      set({ isSyncing: false });
    }
  },
}));
