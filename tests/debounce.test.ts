import { IDistributedLock, RedisDistributedLock } from '../src/index';
import { Redis } from 'ioredis';

const getUniqueKey = () => `test-${crypto.randomUUID()}`;

describe('Debounce', () => {
  let redis: Redis;
  let lock: IDistributedLock;
  let key: string;
  const waitMs = 1000;

  beforeEach(async () => {
    redis = new Redis('redis://localhost:6379');
    lock = await RedisDistributedLock.create(redis, {
      namespace: 'test',
      defaultLockDurationMs: waitMs,
      objectExpiryMs: 60_000
    });

    key = getUniqueKey();
  });

  afterEach(async () => {
    lock.close();
    await redis.quit();
  });

  it('should execute after debounce interval', async () => {
    const debounce = lock.createDebouncer(key, waitMs)

    const fn = jest.fn();
    debounce(fn);

    await sleep(waitMs / 2)
    expect(fn).not.toHaveBeenCalled();

    await sleep(100 + waitMs / 2)
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should debounce prior calls', async () => {
    const debounce = lock.createDebouncer(key, waitMs)
    
    const fn1 = jest.fn();
    debounce(fn1);

    await sleep(waitMs - 200)

    const fn2 = jest.fn();
    debounce(fn2);

    await sleep(waitMs - 200)

    const fn3 = jest.fn();
    debounce(fn3);

    await sleep(waitMs + 100)

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
    expect(fn3).toHaveBeenCalledTimes(1);
  });

});

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 