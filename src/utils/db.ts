import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'aura_db';
const STORE_NAME = 'assets';

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveAsset(key: string, data: any) {
  const db = await getDB();
  await db.put(STORE_NAME, data, key);
}

export async function getAsset(key: string): Promise<any> {
  const db = await getDB();
  return db.get(STORE_NAME, key);
}

export async function deleteAsset(key: string) {
  const db = await getDB();
  await db.delete(STORE_NAME, key);
}
