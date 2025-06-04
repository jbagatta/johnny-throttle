import { Throttle, perSecond, perMinute, perHour } from '../src/index';
import { IDistributedLock, RedisDistributedLock } from 'johnny-locke';
import { Redis } from 'ioredis';

const getUniqueKey = () => `test-${crypto.randomUUID()}`;

describe('Throttle', () => {
  let redis: Redis;
  let lock: IDistributedLock;
  let throttle: Throttle;
  let key: string;
  const config = perSecond(2);

  beforeEach(async () => {
    redis = new Redis('redis://localhost:6379');
    lock = await RedisDistributedLock.create(redis, {
        namespace: 'test',
        lockTimeoutMs: config.intervalMs / config.executions,
        objectExpiryMs: 60_000
    });

    key = getUniqueKey();
    throttle = new Throttle(lock, config, key);
  });

  afterEach(async () => {
    lock.close();
    await redis.quit();
  });

  describe('Basic Throttling', () => {
    it('should execute immediately on first call', async () => {
      const fn = jest.fn();
      const executed = await throttle.throttle(fn);
      expect(executed).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throttle subsequent calls within the interval', async () => {
      const fn = jest.fn();
      
      const executed1 = throttle.throttle(fn);
      const executed2 = throttle.throttle(fn);
      const executed3 = throttle.throttle(fn);

      expect(await executed1).toBe(true);
      expect(await executed2).toBe(true);

      expect(await executed3).toBe(false);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should allow execution after the interval has passed', async () => {
      const fn = jest.fn();
      
      await throttle.throttle(fn);
      await throttle.throttle(fn);

      await sleep(config.intervalMs + 100);

      const executed = await throttle.throttle(fn);
      expect(executed).toBe(true);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should allow rolling execution throttle window', async () => {
      const fn = jest.fn();
      
      await throttle.throttle(fn);
      await sleep(config.intervalMs / 2);

      await throttle.throttle(fn);
      await sleep(100 + config.intervalMs / 2);

      const executed = await throttle.throttle(fn);
      expect(executed).toBe(true);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Execution', () => {
    it('should handle concurrent calls correctly', async () => {
      const fn = jest.fn();
      const executions = 5;
      
      const results = await Promise.all(
        Array(executions).fill(null).map(() => throttle.throttle(fn))
      );

      const executedCount = results.filter(r => r).length;
      expect(executedCount).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should maintain correct execution count across concurrent processes', async () => {
      const fn = jest.fn();
      const executions = 5;

      const throttle2 = new Throttle(lock, config, key);

      const results = await Promise.all([
        ...Array(executions).fill(null).map(() => throttle.throttle(fn)),
        ...Array(executions).fill(null).map(() => throttle2.throttle(fn))
      ]);

      const executedCount = results.filter(r => r).length;
      expect(executedCount).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration', () => {
    it('should throw error for invalid executions', () => {
      expect(() => new Throttle(lock, { executions: 0, intervalMs: 1000 }, key))
        .toThrow('Executions must be at least 1');
    });

    it('should throw error for invalid interval', () => {
      expect(() => new Throttle(lock, { executions: 1, intervalMs: 0 }, key))
        .toThrow('Interval must be at least 1ms');
    });

    it('should throw error for configuration mismatch', async () => {
      const throttle2 = new Throttle(lock, perSecond(3), key);

      await throttle.throttle(() => Promise.resolve());

      await expect(throttle2.throttle(() => Promise.resolve()))
        .rejects
        .toThrow('Configuration mismatch');
    });
  });

  describe('Error Handling', () => {
    it('should count function execution errors', async () => {
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(throttle.throttle(fn)).rejects.toThrow('Test error');
      await expect(throttle.throttle(fn)).rejects.toThrow('Test error');
      
      const executed = await throttle.throttle(() => Promise.resolve());
      expect(executed).toBe(false);
    });
  });

  describe('Long Running Operations', () => {
    it('should not block other processes during long execution', async () => {
      const longRunningFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );
      const quickFn = jest.fn();

      const longRunningPromise = throttle.throttle(longRunningFn);
      const quickResult = await throttle.throttle(quickFn);

      await longRunningPromise;

      expect(quickResult).toBe(true);
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