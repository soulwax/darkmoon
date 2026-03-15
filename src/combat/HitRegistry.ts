export class HitRegistry {
    private cooldowns: Map<string, number>;

    constructor() {
        this.cooldowns = new Map();
    }

    tick(deltaTime: number) {
        for (const [key, remaining] of this.cooldowns.entries()) {
            const next = remaining - deltaTime;
            if (next <= 0) {
                this.cooldowns.delete(key);
            } else {
                this.cooldowns.set(key, next);
            }
        }
    }

    canHit(channel: string, targetId: number | string) {
        return !this.cooldowns.has(this._getKey(channel, targetId));
    }

    registerHit(channel: string, targetId: number | string, cooldown: number) {
        const key = this._getKey(channel, targetId);
        if (cooldown <= 0) {
            this.cooldowns.set(key, Number.EPSILON);
            return;
        }

        this.cooldowns.set(key, cooldown);
    }

    clearChannel(channel: string) {
        const prefix = `${channel}|`;
        for (const key of this.cooldowns.keys()) {
            if (key.startsWith(prefix)) {
                this.cooldowns.delete(key);
            }
        }
    }

    reset() {
        this.cooldowns.clear();
    }

    private _getKey(channel: string, targetId: number | string) {
        return `${channel}|${targetId}`;
    }
}

