import { IDistributedLock } from "johnny-locke";

export class Debounce {
  constructor(
    private readonly lock: IDistributedLock, 
    private readonly intervalMs: number,
    private readonly throttleKey: string
  ) { 
    if (intervalMs < 1) {
      throw new Error("intervalMs must be at least 1");
    }
  }

  debounce(fn: () => Promise<any>): void {
    const id = crypto.randomUUID()

    this.lock.withLock<string>(this.throttleKey, this.intervalMs, async () => id)
      .then(() => {
        setTimeout(async () => {
          try {
            await this.checkDebounce.bind(this)(id, fn)
          }
          catch {
            console.error(`Error checking debounce key ${this.throttleKey}`)
          }
        }, this.intervalMs)
      })
      .catch(console.error)
  }

  private async checkDebounce(id: string, fn: () => Promise<any>) {
    let execute = false

    await this.lock.withLock<string>(
      this.throttleKey, 
      this.intervalMs, 
      async (executor) => {
        execute = executor === id
        return id
      }
    )

      if (execute) {
        await fn();
      }
  }
}