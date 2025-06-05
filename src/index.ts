import { ThrottleConfiguration } from './config';
import { IDistributedLock, RedisDistributedLock, JetstreamDistributedLock } from '@jbagatta/johnny-locke';
import { createDebouncer } from './debounce';
import { createThrottler } from './throttle';

export * from './config';

declare module "@jbagatta/johnny-locke" {
    export interface IDistributedLock {
        createDebouncer(key: string, intervalMs: number): (fn: () => Promise<any>) => void
        createThrottler(key: string, config: ThrottleConfiguration): (fn: () => Promise<any>) => Promise<boolean>
    }
    export interface RedisDistributedLock {
        createDebouncer(key: string, intervalMs: number): (fn: () => Promise<any>) => void
        createThrottler(key: string, config: ThrottleConfiguration): (fn: () => Promise<any>) => Promise<boolean>
    }
    export interface JetstreamDistributedLock {
        createDebouncer(key: string, intervalMs: number): (fn: () => Promise<any>) => void
        createThrottler(key: string, config: ThrottleConfiguration): (fn: () => Promise<any>) => Promise<boolean>
    }
}

RedisDistributedLock.prototype.createDebouncer = redisDebouncer
RedisDistributedLock.prototype.createThrottler = redisThrottler
JetstreamDistributedLock.prototype.createDebouncer = natsDebouncer
JetstreamDistributedLock.prototype.createThrottler = natsThrottler

function redisDebouncer(this: RedisDistributedLock, key: string, intervalMs: number) {
    return createDebouncer(this, key, intervalMs)
}

function redisThrottler(this: RedisDistributedLock, key: string, config: ThrottleConfiguration) {
    return createThrottler(this, key, config)
}

function natsDebouncer(this: JetstreamDistributedLock, key: string, intervalMs: number) {
    return createDebouncer(this, key, intervalMs)
}

function natsThrottler(this: JetstreamDistributedLock, key: string, config: ThrottleConfiguration) {
    return createThrottler(this, key, config)
}

export { IDistributedLock, RedisDistributedLock, JetstreamDistributedLock }