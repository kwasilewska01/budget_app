export type PwaState = {
    offline: boolean;
    offlineReady: boolean;
    canInstall: boolean;
    installed: boolean;
    updateAvailable: boolean;
    persisted: boolean;
    install: () => Promise<void>;
    applyUpdate: () => Promise<void>;
    requestPersistence: () => Promise<void>;
};
