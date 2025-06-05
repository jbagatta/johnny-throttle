import { ThrottleConfiguration } from './config';
import { IDistributedLock, RedisDistributedLock, JetstreamDistributedLock } from '@jbagatta/johnny-locke';
import { Debounce } from './debounce';
import { Throttle } from './throttle';

export * from './config';

declare module "@jbagatta/johnny-locke" {
    export interface IDistributedLock {
        createDebouncer(key: string, intervalMs: number): (fn: () => Promise<any>) => void
        createThrottler(key: string, config: ThrottleConfiguration): (fn: () => Promise<any>) => void
    }
    export interface RedisDistributedLock {
        createDebouncer(key: string, intervalMs: number): (fn: () => Promise<any>) => void
        createThrottler(key: string, config: ThrottleConfiguration): (fn: () => Promise<any>) => void
    }
    export interface JetstreamDistributedLock {
        createDebouncer(key: string, intervalMs: number): (fn: () => Promise<any>) => void
        createThrottler(key: string, config: ThrottleConfiguration): (fn: () => Promise<any>) => void
    }
}

RedisDistributedLock.prototype.createDebouncer = redisDebouncer
RedisDistributedLock.prototype.createThrottler = redisThrottler
JetstreamDistributedLock.prototype.createDebouncer = natsDebouncer
JetstreamDistributedLock.prototype.createThrottler = natsThrottler

function redisDebouncer(this: RedisDistributedLock, key: string, intervalMs: number) {
    const debouncer = new Debounce(this, key, intervalMs)

    return debouncer.debounce
}

function redisThrottler(this: RedisDistributedLock, key: string, config: ThrottleConfiguration) {
    const throttler = new Throttle(this, key, config)

    return throttler.throttle
}

function natsDebouncer(this: JetstreamDistributedLock, key: string, intervalMs: number) {
    const debouncer = new Debounce(this, key, intervalMs)

    return debouncer.debounce
}

function natsThrottler(this: JetstreamDistributedLock, key: string, config: ThrottleConfiguration) {
    const throttler = new Throttle(this, key, config)

    return throttler.throttle
}
