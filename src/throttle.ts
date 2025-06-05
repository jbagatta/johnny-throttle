import { IDistributedLock } from "@jbagatta/johnny-locke";
import { ThrottleConfiguration } from "./config";

interface ThrottleMetadata {
  config: ThrottleConfiguration;
  executionTimestamps: number[];
  cursor: number;
}

export function createThrottler(
  lock: IDistributedLock,
  throttleKey: string, 
  config: ThrottleConfiguration
) { 
    if (config.executions < 1) {
      throw new Error("Executions must be at least 1");
    }
    if (config.intervalMs < 1) {
      throw new Error("Interval must be at least 1ms");
    }

    return async (fn: () => Promise<any>) => await throttle(lock, throttleKey, config, fn)
  }

  async function throttle(
    lock: IDistributedLock,
    throttleKey: string, 
    config: ThrottleConfiguration,
    fn: () => Promise<any>
  ): Promise<boolean> {
    let execute = false

    const lockTimeoutMs = config.intervalMs / config.executions;
    await lock.withLock<ThrottleMetadata>(
      throttleKey, 
      lockTimeoutMs, 
      async (throttleMetadata) => {
        validateAgainstExistingConfig(config, throttleMetadata?.config);
        const now = Date.now();

        const newMetadata = {
          executionTimestamps: throttleMetadata?.executionTimestamps ?? new Array(config.executions).fill(0),
          cursor: throttleMetadata?.cursor ?? 0,
          config: config,
        };

        const bufferPos = newMetadata.executionTimestamps[newMetadata.cursor];
        if (now - bufferPos > config.intervalMs) {
          newMetadata.executionTimestamps[newMetadata.cursor] = now;
          newMetadata.cursor = (newMetadata.cursor + 1) % config.executions;

          execute = true;
        }

        return newMetadata;
      }
    );

    if (execute) {
      await fn();
    }
    return execute;
  }

  function validateAgainstExistingConfig(config: ThrottleConfiguration, existingConfig?: ThrottleConfiguration) {
    if (existingConfig) {
      if (config.executions !== existingConfig.executions) {
        throw new Error(`Configuration mismatch: requested ${config.executions} executions, but existing config has ${existingConfig.executions}`);
      }
      if (config.intervalMs !== existingConfig.intervalMs) {
        throw new Error(`Configuration mismatch: requested ${config.intervalMs}ms interval, but existing config has ${existingConfig.intervalMs}ms`);
      }
    }
  
}