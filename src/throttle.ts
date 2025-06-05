import { IDistributedLock } from "@jbagatta/johnny-locke";
import { ThrottleConfiguration } from "./config";

interface ThrottleMetadata {
  config: ThrottleConfiguration;
  executionTimestamps: number[];
  cursor: number;
}

export class Throttle {
  constructor(
    private readonly lock: IDistributedLock,
    private readonly throttleKey: string, 
    private readonly config: ThrottleConfiguration
  ) { 
    if (config.executions < 1) {
      throw new Error("Executions must be at least 1");
    }
    if (config.intervalMs < 1) {
      throw new Error("Interval must be at least 1ms");
    }
  }

  async throttle(fn: () => Promise<any>): Promise<boolean> {
    let execute = false

    const lockTimeoutMs = this.config.intervalMs / this.config.executions;
    await this.lock.withLock<ThrottleMetadata>(
      this.throttleKey, 
      lockTimeoutMs, 
      async (throttleMetadata) => {
        this.validateAgainstExistingConfig(throttleMetadata?.config);
        const now = Date.now();

        const newMetadata = {
          executionTimestamps: throttleMetadata?.executionTimestamps ?? new Array(this.config.executions).fill(0),
          cursor: throttleMetadata?.cursor ?? 0,
          config: this.config,
        };

        const bufferPos = newMetadata.executionTimestamps[newMetadata.cursor];
        if (now - bufferPos > this.config.intervalMs) {
          newMetadata.executionTimestamps[newMetadata.cursor] = now;
          newMetadata.cursor = (newMetadata.cursor + 1) % this.config.executions;

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

  validateAgainstExistingConfig(existingConfig?: ThrottleConfiguration) {
    if (existingConfig) {
      if (this.config.executions !== existingConfig.executions) {
        throw new Error(`Configuration mismatch: requested ${this.config.executions} executions, but existing config has ${existingConfig.executions}`);
      }
      if (this.config.intervalMs !== existingConfig.intervalMs) {
        throw new Error(`Configuration mismatch: requested ${this.config.intervalMs}ms interval, but existing config has ${existingConfig.intervalMs}ms`);
      }
    }
  }
}