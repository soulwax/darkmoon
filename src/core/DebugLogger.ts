// File: src/core/DebugLogger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface DebugLogRecord {
    ts: string;
    level: LogLevel;
    channel: 'console' | 'debug';
    source?: string;
    event?: string;
    message?: string;
    args?: unknown[];
    data?: unknown;
}

const LOG_ENDPOINT = '/__darkmoon_log';
const LOCAL_STORAGE_KEY = 'darkmoon.debug.logs.v1';
const MAX_LOCAL_RECORDS = 500;

const LEVEL_STYLE: Record<LogLevel, string> = {
    debug: 'color:#8ec5ff;font-weight:700',
    info: 'color:#9df5a6;font-weight:700',
    warn: 'color:#ffd27a;font-weight:700',
    error: 'color:#ff8e8e;font-weight:700'
};

function safeClone(value: unknown) {
    const seen = new WeakSet<object>();

    try {
        const json = JSON.stringify(value, (_key, current) => {
            if (typeof current === 'bigint') return current.toString();
            if (typeof current === 'function') return `[Function ${current.name || 'anonymous'}]`;
            if (typeof current === 'symbol') return current.toString();
            if (current instanceof Error) {
                return {
                    name: current.name,
                    message: current.message,
                    stack: current.stack
                };
            }
            if (current && typeof current === 'object') {
                if (seen.has(current)) return '[Circular]';
                seen.add(current);
            }
            return current;
        });

        if (json === undefined) {
            if (value === undefined) return null;
            return String(value);
        }

        return JSON.parse(json) as unknown;
    } catch {
        return String(value);
    }
}

function formatTimeStamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
}

class DebugLoggerImpl {
    consolePatched: boolean;
    originalConsole: Partial<Record<LogLevel, (...args: unknown[]) => void>>;
    persistEnabled: boolean;

    constructor() {
        this.consolePatched = false;
        this.originalConsole = {};
        this.persistEnabled = true;
    }

    installConsoleBridge() {
        if (this.consolePatched) return;

        this.originalConsole.debug = console.debug.bind(console);
        this.originalConsole.info = console.info.bind(console);
        this.originalConsole.warn = console.warn.bind(console);
        this.originalConsole.error = console.error.bind(console);

        const bridge = (level: LogLevel) => {
            const original = this.originalConsole[level] || console.log.bind(console);
            return (...args: unknown[]) => {
                const stamp = formatTimeStamp();
                original(`%c[Darkmoon ${stamp}] [${level.toUpperCase()}]`, LEVEL_STYLE[level], ...args);

                const record: DebugLogRecord = {
                    ts: new Date().toISOString(),
                    level,
                    channel: 'console',
                    args: safeClone(args) as unknown[]
                };
                this.persist(record);
            };
        };

        console.debug = bridge('debug');
        console.info = bridge('info');
        console.warn = bridge('warn');
        console.error = bridge('error');
        // Keep `console.log` consistent with info-level formatting.
        console.log = bridge('info');

        this.consolePatched = true;
    }

    debug(source: string, event: string, data?: unknown) {
        this.emit('debug', source, event, data);
    }

    info(source: string, event: string, data?: unknown) {
        this.emit('info', source, event, data);
    }

    warn(source: string, event: string, data?: unknown) {
        this.emit('warn', source, event, data);
    }

    error(source: string, event: string, data?: unknown) {
        this.emit('error', source, event, data);
    }

    emit(level: LogLevel, source: string, event: string, data?: unknown) {
        const original = this.originalConsole[level] || console[level] || console.log;
        const stamp = formatTimeStamp();

        original(`%c[Darkmoon ${stamp}] [${source}] ${event}`, LEVEL_STYLE[level], data ?? '');

        const record: DebugLogRecord = {
            ts: new Date().toISOString(),
            level,
            channel: 'debug',
            source,
            event,
            data: safeClone(data)
        };
        this.persist(record);
    }

    persist(record: DebugLogRecord) {
        if (!this.persistEnabled) return;

        this.persistToLocalStorage(record);
        void this.persistToServer(record);
    }

    persistToLocalStorage(record: DebugLogRecord) {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as DebugLogRecord[]) : [];
            parsed.push(record);
            while (parsed.length > MAX_LOCAL_RECORDS) {
                parsed.shift();
            }
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
            // Ignore private mode/quota failures.
        }
    }

    async persistToServer(record: DebugLogRecord) {
        try {
            await fetch(LOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(record),
                keepalive: true
            });
        } catch {
            // Ignore network failures; local storage still captures logs.
        }
    }
}

export const DebugLogger = new DebugLoggerImpl();
