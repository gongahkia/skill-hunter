import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import {
  VAULT_SCHEMA_VERSION,
  VAULT_STORE_DEFINITIONS,
  VaultDB
} from '../../src/vault/db.js';

const dbs = [];

function dbName(label) {
  const name = `rakuzaichi-test-${label}-${Date.now()}-${Math.random()}`;
  dbs.push(name);
  return name;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteDatabase(name) {
  return requestToPromise(indexedDB.deleteDatabase(name));
}

function getRecord(db, storeName, key) {
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).get(key));
}

afterEach(async () => {
  while (dbs.length) await deleteDatabase(dbs.pop());
});

describe('VaultDB', () => {
  it('opens the v1 vault schema with all stores and indexes', async () => {
    const db = await VaultDB.open({ indexedDB, name: dbName('schema') });
    const expectedStores = VAULT_STORE_DEFINITIONS.map((definition) => definition.name).sort();

    expect(db.version).toBe(VAULT_SCHEMA_VERSION);
    expect(Array.from(db.objectStoreNames).sort()).toEqual(expectedStores);

    for (const definition of VAULT_STORE_DEFINITIONS) {
      const tx = db.transaction(definition.name, 'readonly');
      const store = tx.objectStore(definition.name);
      const expectedIndexes = definition.indexes.map((index) => index[0]).sort();
      expect(Array.from(store.indexNames).sort()).toEqual(expectedIndexes);
    }

    VaultDB.close(db);
  });

  it('records schema metadata during first upgrade', async () => {
    const db = await VaultDB.open({ indexedDB, name: dbName('meta') });
    const schemaVersion = await getRecord(db, 'meta', 'schemaVersion');
    const createdAt = await getRecord(db, 'meta', 'createdAt');

    expect(schemaVersion.value).toBe(VAULT_SCHEMA_VERSION);
    expect(new Date(createdAt.value).toString()).not.toBe('Invalid Date');

    VaultDB.close(db);
  });
});
