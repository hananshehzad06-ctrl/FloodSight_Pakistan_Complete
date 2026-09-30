import { openDB } from "idb";
import { MOCK_PAYLOADS } from "../data/mockData.js";

const DB_NAME = "FloodSightDB";
const DB_VERSION = 1;
const STORE_NAME = "uc_payloads";

let dbPromise = null;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "uc_id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function seedInitialData() {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const count = await tx.store.count();
  await tx.done;

  if (count === 0) {
    const writeTx = db.transaction(STORE_NAME, "readwrite");
    for (const payload of MOCK_PAYLOADS) {
      await writeTx.store.put(payload);
    }
    await writeTx.done;
  }
}

export async function getAllCachedPayloads() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function getPayloadById(uc_id) {
  const db = await initDB();
  return db.get(STORE_NAME, uc_id);
}

export async function savePayload(payload) {
  if (!payload || typeof payload.uc_id !== "string" || payload.uc_id.trim() === "") {
    throw new Error("savePayload: payload must have a non-empty string uc_id");
  }
  const db = await initDB();
  await db.put(STORE_NAME, payload);
}
