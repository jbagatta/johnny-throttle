# Johnny Throttle

A lightweight TypeScript utility library for throttling function calls across a distributed system. Built on top of `johnny-locke` [distributed locking](https://github.com/jbagatta/johnny-locke).

## Implementation

JohnnyThrottle makes use of a basic ring buffer store inside a distributed lock. The ring buffer is sized to the number of requested executions, and the value in each buffer position is an execution time of the function, in incrementing order of execution (with respect to the sliding buffer window). Simply put, if the current time is greater than the throttle window plus the timestamp of the earliest known execution, the function will execute.

The ring buffer is updated (and the lock is released) *before* the function is executed, so in practice this is throttling execution *attempts*. Execution failures still count against the throttle. This is done to minimize the lock window to allow for long-running execution functions.

The throttle requires a stable associated key that is computable across all processes in the distributed environment for a given execution.

## Usage

```typescript
import { Throttle, perMinute } from 'johnny-throttle';
import { IDistributedLock } from 'johnny-locke';

// allow 2 executions per minute (perSecond() and perHour() supported as well)
const config = perMinute(2)

// Create a throttle that allows 5 executions per minute
// the lock should be configured with a timeout matching the throttle:
// lockTimeoutMs = config.intervalMs / config.executions
const throttle = new Throttle(lock, config, key);


// Example execution - email a user
async function sendEmail(to: string, subject: string) {
  console.log(`Sending email to ${to}: ${subject}`);
  // ... email sending logic ...
}

async function handleEmailRequest(to: string, subject: string) {
  const executed = await throttle.throttle(async () => {
    await sendEmail(to, subject);
  });

  if (executed) {
    console.log('Email was sent');
  } else {
    console.log('Email was throttled');
  }
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
