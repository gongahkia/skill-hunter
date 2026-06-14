import { afterEach, describe, expect, it } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { migrations } from '../../src/vault/migrations.js';
import { VAULT_STORE_DEFINITIONS, VaultDB } from '../../src/vault/db.js';

const dbs = [];

function dbName() {
  const name = `rakuzaichi-migration-test-${Date.now()}-${Math.random()}`;
  dbs.push(name);
  return name;
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  while (dbs.length) await deleteDatabase(dbs.pop());
});

describe('vault migrations', () => {
  it('exports an empty v1 migration registry', () => {
    expect(migrations).toEqual([]);
  });

  it('upgrades from no database to v1 by creating all stores', async () => {
    const db = await VaultDB.open({ indexedDB, name: dbName() });
    expect(Array.from(db.objectStoreNames).sort()).toEqual(
      VAULT_STORE_DEFINITIONS.map((definition) => definition.name).sort()
    );
    VaultDB.close(db);
  });
});
