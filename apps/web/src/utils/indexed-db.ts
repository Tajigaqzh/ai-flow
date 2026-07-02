type IndexedDbRecord = {
  key: IDBValidKey;
};

type IndexedDbStoreClientOptions = {
  databaseName: string;
  storeName: string;
  version?: number;
};

function getBrowserIndexedDb() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  return window.indexedDB;
}

export function isIndexedDbSupported() {
  return getBrowserIndexedDb() !== null;
}

export class IndexedDbStoreClient {
  private database: IDBDatabase | null = null;
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly version: number;

  constructor({
    databaseName,
    storeName,
    version = 1,
  }: IndexedDbStoreClientOptions) {
    if (!databaseName.trim()) {
      throw new Error('IndexedDB database name is required');
    }

    if (!storeName.trim()) {
      throw new Error('IndexedDB store name is required');
    }

    this.databaseName = databaseName;
    this.storeName = storeName;
    this.version = version;
  }

  async initialize() {
    if (this.database) {
      return this.database;
    }

    const indexedDb = getBrowserIndexedDb();

    if (!indexedDb) {
      return null;
    }

    return new Promise<IDBDatabase | null>((resolve) => {
      const request = indexedDb.open(this.databaseName, this.version);

      request.onblocked = () => resolve(null);
      request.onerror = () => resolve(null);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.storeName)) {
          request.result.createObjectStore(this.storeName, {
            keyPath: 'key',
          });
        }
      };
      request.onsuccess = () => {
        this.database = request.result;
        this.database.onversionchange = () => {
          this.close();
        };
        resolve(this.database);
      };
    });
  }

  close() {
    this.database?.close();
    this.database = null;
  }

  async get<T>(key: IDBValidKey) {
    return this.execute<T | undefined>('readonly', (store) => store.get(key));
  }

  async put<T extends IndexedDbRecord>(record: T) {
    return this.execute<IDBValidKey>('readwrite', (store) => store.put(record));
  }

  async delete(key: IDBValidKey) {
    await this.execute<undefined>('readwrite', (store) => store.delete(key));
  }

  async clear() {
    await this.execute<undefined>('readwrite', (store) => store.clear());
  }

  private async execute<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ) {
    const database = await this.initialize();

    if (!database) {
      return undefined;
    }

    return new Promise<T | undefined>((resolve) => {
      const transaction = database.transaction(this.storeName, mode);
      const store = transaction.objectStore(this.storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
      transaction.onerror = () => resolve(undefined);
    });
  }
}
