# Johnny Throttle

TypeScript utility library for throttling or debouncing function calls across a distributed system. 

Built on top of [JohnnyLocke](https://github.com/jbagatta/johnny-locke) distributed locking, JohnnyThrottle augments the `IDistributedLock` interface with `createThrottle` and `createDebounce` functions.

## Implementation

### Throttle

JohnnyThrottle makes use of a basic ring buffer stored inside of a distributed lock. The ring buffer is sized to the number of requested executions, and the value in each buffer position is an execution time of the function, in incrementing order of execution (with respect to the sliding buffer window). Simply put, if the current time is greater than the throttle window plus the timestamp of the earliest known execution, the function will execute.

The ring buffer is updated (and the lock is released) *before* the function is executed, so in practice this is throttling execution *attempts*, not *completions*. Execution failures still count against the throttle. This is done to minimize the lock window, which allows for long-running execution functions.

The throttle requires a stable associated key that is computable across all processes in the distributed environment for a given execution.

### Debounce

The debounce functions similarly, but with the goal of debouncing a function call across processes. A debouncing process will set it's own execution identifier within the distributed lock, then check that lock's value after the debounce timeout. If the identifier remains the same (i.e. no other process has evicted a prior ID and stored its own), then the debounced function is called. Otherwise, it's a no-op.

## Usage

```typescript
import { IDistributedLock, perMinute } from '@jbagatta/johnny-throttle';

// Example execution - email a user
async function sendEmail(to: string, subject: string) {
  console.log(`Sending email to ${to}: ${subject}`);
  // ... email sending logic ...
}

// Create a throttle, allow 2 executions per minute
const config = perMinute(2)
const throttle = lock.createThrottler(key, config);
async function throttleEmailRequest(to: string, subject: string) {
  const executed = await throttle(async () => {
    await sendEmail(to, subject);
  });

  if (executed) {
    console.log('Email was sent');
  } else {
    console.log('Email was throttled');
  }
}

// Create a debouncer on a 30s interval
const debounce = lock.createDebouncer(key, 30_000);
async function debounceEmailRequest(to: string, subject: string) {
  debounce(async () => {
    await sendEmail(to, subject);
  });
}
```

## Running Tests

Spin up a test environment with redis and nats servers using docker compose:
```
docker compose -f tests/docker-compose.yml up -d
```

and then run the tests:
```
npm run test
```

## License

MIT
