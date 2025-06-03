
export interface ThrottleConfiguration {
    executions: number;
    intervalMs: number;
}

export function perSecond(executions: number, seconds = 1): ThrottleConfiguration {
    return {
        executions,
        intervalMs: seconds * 1000,
    }
}

export function perMinute(executions: number, minutes = 1): ThrottleConfiguration {
    return {
        executions,
        intervalMs: minutes * 60_000,
    }
}

export function perHour(executions: number, hours = 1): ThrottleConfiguration {
    return {
        executions,
        intervalMs: hours * 3_600_000,
    }
}