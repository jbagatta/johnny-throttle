import { Throttle, perSecond, perMinute, perHour } from './index';
import { IDistributedLock, RedisDistributedLock } from 'johnny-locke';
import { Redis } from 'ioredis';

const getUniqueKey = () => `test-${crypto.randomUUID()}`;

describe('Throttle', () => {
  let redis: Redis;
  let lock: IDistributedLock;
  let throttle: Throttle;
  const key = getUniqueKey();

  const config = perSecond(2);

  beforeAll(async () => {
    redis = new Redis('redis://localhost:6379');
    lock = await RedisDistributedLock.create(redis, {
        namespace: 'test',
        lockTimeoutMs: config.intervalMs / config.executions
    });
  });

  afterAll(async () => {
    lock.close();
    await redis.quit();
  });

  beforeEach(() => {
    // Create a new throttle instance for each test
    throttle = new Throttle(lock, perSecond(2), key);
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
      
      // First call should execute
      const executed1 = await throttle.throttle(fn);
      expect(executed1).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call should execute (we allow 2 per second)
      const executed2 = await throttle.throttle(fn);
      expect(executed2).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);

      // Third call should be throttled
      const executed3 = await throttle.throttle(fn);
      expect(executed3).toBe(false);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should allow execution after the interval has passed', async () => {
      const fn = jest.fn();
      
      // Execute twice
      await throttle.throttle(fn);
      await throttle.throttle(fn);
      expect(fn).toHaveBeenCalledTimes(2);

      // Wait for the interval to pass
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should execute again
      const executed = await throttle.throttle(fn);
      expect(executed).toBe(true);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Execution', () => {
    it('should handle concurrent calls correctly', async () => {
      const fn = jest.fn();
      const executions = 5; // More than our throttle limit
      
      // Execute multiple calls concurrently
      const results = await Promise.all(
        Array(executions).fill(null).map(() => throttle.throttle(fn))
      );

      // Should only execute twice (our throttle limit)
      const executedCount = results.filter(Boolean).length;
      expect(executedCount).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should maintain correct execution count across concurrent processes', async () => {
      const fn = jest.fn();
      const throttle2 = new Throttle(lock, perSecond(2), key);

      // Execute from first throttle
      await throttle.throttle(fn);
      await throttle.throttle(fn);

      // Try to execute from second throttle
      const executed = await throttle2.throttle(fn);
      expect(executed).toBe(false);
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
      // Create throttle with different config
      const throttle2 = new Throttle(lock, perSecond(3), key);

      // First throttle should work
      await throttle.throttle(() => Promise.resolve());

      // Second throttle should fail
      await expect(throttle2.throttle(() => Promise.resolve()))
        .rejects
        .toThrow('Configuration mismatch');
    });
  });

  describe('Helper Functions', () => {
    it('should create correct perSecond configuration', () => {
      const config = perSecond(5);
      expect(config).toEqual({
        executions: 5,
        intervalMs: 1000
      });
    });

    it('should create correct perMinute configuration', () => {
      const config = perMinute(5);
      expect(config).toEqual({
        executions: 5,
        intervalMs: 60 * 1000
      });
    });

    it('should create correct perHour configuration', () => {
      const config = perHour(5);
      expect(config).toEqual({
        executions: 5,
        intervalMs: 60 * 60 * 1000
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle function execution errors', async () => {
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);

      // Should still count as an execution even if it fails
      await expect(throttle.throttle(fn)).rejects.toThrow('Test error');
      
      // Next call should be throttled
      const executed = await throttle.throttle(() => Promise.resolve());
      expect(executed).toBe(false);
    });
  });

  describe('Long Running Operations', () => {
    it('should not block other processes during long execution', async () => {
      const longRunningFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      const quickFn = jest.fn();

      // Start long running operation
      const longRunningPromise = throttle.throttle(longRunningFn);

      // Try to execute quick operation immediately
      const quickResult = await throttle.throttle(quickFn);

      // Long running operation should complete
      await longRunningPromise;

      // Quick operation should have been throttled
      expect(quickResult).toBe(false);
      expect(longRunningFn).toHaveBeenCalledTimes(1);
      expect(quickFn).toHaveBeenCalledTimes(0);
    });
  });
}); 