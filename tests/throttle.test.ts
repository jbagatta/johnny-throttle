import { IDistributedLock, RedisDistributedLock } from '../src/index';
import { Redis } from 'ioredis';
import { perSecond } from '../src/config';

const getUniqueKey = () => `test-${crypto.randomUUID()}`;

describe('Throttle', () => {
  let redis: Redis;
  let lock: IDistributedLock;
  let key: string;
  const config = perSecond(2);

  beforeEach(async () => {
    redis = new Redis('redis://localhost:6379');
    lock = await RedisDistributedLock.create(redis, {
        namespace: 'test',
        defaultLockDurationMs: config.intervalMs / config.executions,
        objectExpiryMs: 60_000
    });

    key = getUniqueKey();
  });

  afterEach(async () => {
    lock.close();
    await redis.quit();
  });

  describe('Basic Throttling', () => {
    it('should execute immediately on first call', async () => {
      const throttle = lock.createThrottler(key, config);

      const fn = jest.fn();
      const executed = await throttle(fn);

      expect(executed).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throttle subsequent calls within the interval', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const fn = jest.fn();
      
      const executed1 = throttle(fn);
      const executed2 = throttle(fn);
      const executed3 = throttle(fn);

      expect(await executed1).toBe(true);
      expect(await executed2).toBe(true);

      expect(await executed3).toBe(false);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should allow execution after the interval has passed', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const fn = jest.fn();
      
      await throttle(fn);
      await throttle(fn);

      await sleep(config.intervalMs + 100);

      const executed = await throttle(fn);
      expect(executed).toBe(true);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should allow rolling execution throttle window', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const fn = jest.fn();
      
      await throttle(fn);
      await sleep(config.intervalMs / 2);

      await throttle(fn);
      await sleep(100 + config.intervalMs / 2);

      const executed = await throttle(fn);
      expect(executed).toBe(true);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Execution', () => {
    it('should handle concurrent calls correctly', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const fn = jest.fn();
      const executions = 5;
      
      const results = await Promise.all(
        Array(executions).fill(null).map(() => throttle(fn))
      );

      const executedCount = results.filter(r => r).length;
      expect(executedCount).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should maintain correct execution count across concurrent processes', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const fn = jest.fn();
      const executions = 5;

      const throttle2 = lock.createThrottler(key, config);

      const results = await Promise.all([
        ...Array(executions).fill(null).map(() => throttle(fn)),
        ...Array(executions).fill(null).map(() => throttle2(fn))
      ]);

      const executedCount = results.filter(r => r).length;
      expect(executedCount).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration', () => {
    it('should throw error for invalid executions', () => {
      expect(() => lock.createThrottler(key, { executions: 0, intervalMs: 1000 }))
        .toThrow('Executions must be at least 1');
    });

    it('should throw error for invalid interval', () => {
      expect(() => lock.createThrottler(key, { executions: 1, intervalMs: 0 }))
        .toThrow('Interval must be at least 1ms');
    });

    it('should throw error for configuration mismatch across throttle instances', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const throttle2 = lock.createThrottler(key, perSecond(3));

      await throttle(() => Promise.resolve());

      await expect(throttle2(() => Promise.resolve()))
        .rejects
        .toThrow('Configuration mismatch');
    });
  });

  describe('Error Handling', () => {
    it('should count function execution errors', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(throttle(fn)).rejects.toThrow('Test error');
      await expect(throttle(fn)).rejects.toThrow('Test error');
      
      const executed = await throttle(() => Promise.resolve());
      expect(executed).toBe(false);
    });
  });

  describe('Long Running Operations', () => {
    it('should not block other processes during long execution', async () => {
      const throttle = lock.createThrottler(key, config);
      
      const longRunningFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );
      const quickFn = jest.fn();

      const longRunningPromise = throttle(longRunningFn);
      const quickResult = await throttle(quickFn);
      const quickResult2 = await throttle(quickFn);

      await longRunningPromise;

      expect(quickResult).toBe(true);
      expect(quickResult2).toBe(false);
      expect(longRunningFn).toHaveBeenCalledTimes(1);
      expect(quickFn).toHaveBeenCalledTimes(1);
    });
  });
}); 

async function sleep(ms: number) {
    return new Promise((res) => {
        setTimeout(res, ms)
    })
}