import { IDistributedLock } from "@jbagatta/johnny-locke";

export function createDebouncer(
    lock: IDistributedLock,
    throttleKey: string, 
    intervalMs: number
  ) { 
    if (intervalMs < 1) {
      throw new Error("intervalMs must be at least 1");
    }

    return (fn: () => Promise<any>) => debounce(lock, throttleKey, intervalMs, fn)
  }

  function debounce(
    lock: IDistributedLock,
    throttleKey: string, 
    intervalMs: number,
    fn: () => Promise<any>
  ): void {
    const id = crypto.randomUUID()

    lock.withLock<string>(throttleKey, intervalMs, async () => id)
      .then(() => {
        setTimeout(async () => {
          try {
            await checkDebounce(lock, throttleKey, intervalMs, id, fn)
          }
          catch {
            console.error(`Error checking debounce key ${throttleKey}`)
          }
        }, intervalMs)
      })
      .catch(console.error)
  }

  async function checkDebounce(
    lock: IDistributedLock,
    throttleKey: string, 
    intervalMs: number,
    id: string, fn: () => Promise<any>
  ) {
    let execute = false

    await lock.withLock<string>(
      throttleKey, 
      intervalMs, 
      async (executor) => {
        execute = executor === id
        return executor ?? id
      }
    )

    if (execute) {
      await fn();
    }
  }
