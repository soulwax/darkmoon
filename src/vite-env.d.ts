// File: src/vite-env.d.ts

import type { Application } from './main';

declare global {
    interface Window {
        Darkmoon?: Application;
        DarkmoonApp?: typeof Application;
    }
}

export { };

