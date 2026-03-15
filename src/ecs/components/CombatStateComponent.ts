import { Component } from '../Component';
import type { CombatantState, Faction } from '../../combat/CombatTypes';

export class CombatStateComponent extends Component {
    faction: Faction;
    role: string;
    state: CombatantState;
    stateTimer: number;
    invulnerabilityTimer: number;
    spawnProtectionTimer: number;

    constructor(faction: Faction, role: string) {
        super();
        this.faction = faction;
        this.role = role;
        this.state = 'idle';
        this.stateTimer = 0;
        this.invulnerabilityTimer = 0;
        this.spawnProtectionTimer = 0;
    }

    setState(state: CombatantState, duration: number = 0) {
        this.state = state;
        this.stateTimer = Math.max(0, duration);
    }

    setInvulnerable(duration: number) {
        this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer, Math.max(0, duration));
    }

    setSpawnProtection(duration: number) {
        this.spawnProtectionTimer = Math.max(this.spawnProtectionTimer, Math.max(0, duration));
    }

    canReceiveDamage() {
        return (
            this.state !== 'dead' &&
            this.state !== 'dying' &&
            this.invulnerabilityTimer <= 0 &&
            this.spawnProtectionTimer <= 0
        );
    }

    canMove() {
        return this.state !== 'dead' && this.state !== 'dying' && this.state !== 'staggered';
    }

    canAttack() {
        return this.state !== 'dead' && this.state !== 'dying' && this.state !== 'hurt' && this.state !== 'staggered';
    }

    isDead() {
        return this.state === 'dead';
    }

    update(deltaTime: number) {
        if (this.stateTimer > 0) {
            this.stateTimer = Math.max(0, this.stateTimer - deltaTime);
            if (this.stateTimer <= 0 && (this.state === 'hurt' || this.state === 'staggered' || this.state === 'spawning')) {
                this.state = 'idle';
            }
        }

        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - deltaTime);
        }

        if (this.spawnProtectionTimer > 0) {
            this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - deltaTime);
        }
    }
}

