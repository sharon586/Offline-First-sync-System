import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { AppRecord, SyncOperation } from "../types";

interface SyncDB extends DBSchema {
  records: {
    key: string;
    value: AppRecord;
    indexes: { "by-status": string; "by-user": string };
  };
  pendingOps: {
    key: string;
    value: SyncOperation;
    indexes: { "by-status": string };
  };
}

let db: IDBPDatabase<SyncDB>;

export async function getDB(): Promise<IDBPDatabase<SyncDB>> {
  if (!db) {
    db = await openDB<SyncDB>("offline-sync-db", 1, {
      upgrade(database) {
        const recordStore = database.createObjectStore("records", { keyPath: "id" });
        recordStore.createIndex("by-status", "status");
        recordStore.createIndex("by-user", "user_id");
        const opStore = database.createObjectStore("pendingOps", { keyPath: "id" });
        opStore.createIndex("by-status", "status");
      },
    });
  }
  return db;
}

export async function saveRecordLocal(record: AppRecord): Promise<void> {
  const database = await getDB();
  await database.put("records", record);
}

export async function getRecordsLocal(): Promise<AppRecord[]> {
  const database = await getDB();
  return database.getAll("records");
}

export async function getRecordLocal(id: string): Promise<AppRecord | undefined> {
  const database = await getDB();
  return database.get("records", id);
}

export async function deleteRecordLocal(id: string): Promise<void> {
  const database = await getDB();
  await database.delete("records", id);
}

export async function clearLocalRecords(): Promise<void> {
  const database = await getDB();
  await database.clear("records");
}

export async function addPendingOp(op: SyncOperation): Promise<void> {
  const database = await getDB();
  await database.put("pendingOps", op);
}

export async function getPendingOps(): Promise<SyncOperation[]> {
  const database = await getDB();
  return database.getAll("pendingOps");
}

export async function removePendingOp(id: string): Promise<void> {
  const database = await getDB();
  await database.delete("pendingOps", id);
}

export async function clearPendingOps(): Promise<void> {
  const database = await getDB();
  await database.clear("pendingOps");
}

export async function getPendingOpCount(): Promise<number> {
  const database = await getDB();
  return database.count("pendingOps");
}
