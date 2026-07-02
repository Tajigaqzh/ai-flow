import { IndexedDbStoreClient, isIndexedDbSupported } from '@/utils/indexed-db';

describe('IndexedDbStoreClient', () => {
  // 边界场景：Node 或 SSR 环境没有 window.indexedDB 时，能力检测应安全返回 false。
  it('reports IndexedDB as unsupported without a browser database API', () => {
    expect(isIndexedDbSupported()).toBe(false);
  });

  // 异常场景：数据库名为空时应直接拒绝，避免创建不可追踪的 IndexedDB 实例。
  it('rejects an empty database name', () => {
    expect(
      () =>
        new IndexedDbStoreClient({
          databaseName: ' ',
          storeName: 'chat-history',
        }),
    ).toThrow('IndexedDB database name is required');
  });

  // 异常场景：对象仓库名为空时应直接拒绝，避免后续事务访问失败。
  it('rejects an empty store name', () => {
    expect(
      () =>
        new IndexedDbStoreClient({
          databaseName: 'ai-flow-chat',
          storeName: '',
        }),
    ).toThrow('IndexedDB store name is required');
  });

  // 边界场景：缺少浏览器 IndexedDB 能力时，读操作应降级为 undefined 而不是抛错。
  it('returns undefined when reading without IndexedDB support', async () => {
    const client = new IndexedDbStoreClient({
      databaseName: 'ai-flow-chat',
      storeName: 'chat-history',
    });

    await expect(client.get('default-chat')).resolves.toBeUndefined();
  });
});
