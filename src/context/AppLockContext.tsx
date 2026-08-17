import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type LockConfig, type LockMethod,
  readConfig, writeConfig, createConfig, verifySecret,
  markActive, shouldLock,
  registerBiometric, verifyBiometric, checkBiometricStatus, isBiometricPossible,
  type BiometricStatus,
} from '../utils/appLock';

interface AppLockContextType {
  config: LockConfig | null;
  isLocked: boolean;
  biometricAvailable: boolean;
  /** Carries why, so Settings can say the true thing when it is false. */
  biometricStatus: BiometricStatus | null;

  enable: (method: LockMethod, secret: string, autoLockMinutes: number) => Promise<void>;
  disable: () => void;
  unlock: (secret: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  lockNow: () => void;
  setAutoLockMinutes: (m: number) => void;
  enableBiometric: (label: string) => Promise<void>;
  disableBiometric: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<LockConfig | null>(() => readConfig());
  // Start locked if a lock exists — the very first paint must not show the app.
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const c = readConfig();
    return c ? shouldLock(c) : false;
  });
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const biometricAvailable = biometricStatus?.available === true;

  useEffect(() => {
    if (!isBiometricPossible()) {
      setBiometricStatus({ available: false, reason: 'unsupported' });
      return;
    }
    checkBiometricStatus().then(setBiometricStatus);
  }, []);

  // Re-lock when the app comes back from the background.
  useEffect(() => {
    if (!config) return;

    const onHide = () => { if (document.visibilityState === 'hidden') markActive(); };
    const onShow = () => {
      if (document.visibilityState === 'visible' && shouldLock(config)) setIsLocked(true);
    };

    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pagehide', markActive);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pagehide', markActive);
    };
  }, [config]);

  // While unlocked and in use, keep the clock fresh so a short glance away
  // does not force a re-entry.
  useEffect(() => {
    if (isLocked) return;
    markActive();
    const t = setInterval(markActive, 20_000);
    return () => clearInterval(t);
  }, [isLocked]);

  const persist = (next: LockConfig | null) => {
    writeConfig(next);
    setConfig(next);
  };

  const enable = useCallback(async (method: LockMethod, secret: string, autoLockMinutes: number) => {
    const next = await createConfig(method, secret, autoLockMinutes);
    persist(next);
    setIsLocked(false);
    markActive();
  }, []);

  const disable = useCallback(() => {
    persist(null);
    setIsLocked(false);
  }, []);

  const unlock = useCallback(async (secret: string) => {
    if (!config) return true;
    const ok = await verifySecret(config, secret);
    if (ok) {
      setIsLocked(false);
      markActive();
    }
    return ok;
  }, [config]);

  const unlockWithBiometric = useCallback(async () => {
    if (!config?.biometric || !config.credentialId) return false;
    try {
      const ok = await verifyBiometric(config.credentialId);
      if (ok) {
        setIsLocked(false);
        markActive();
      }
      return ok;
    } catch {
      return false;
    }
  }, [config]);

  const lockNow = useCallback(() => {
    if (config) setIsLocked(true);
  }, [config]);

  const setAutoLockMinutes = useCallback((m: number) => {
    if (!config) return;
    persist({ ...config, autoLockMinutes: m });
  }, [config]);

  const enableBiometric = useCallback(async (label: string) => {
    if (!config) throw new Error('Set a code first.');
    const credentialId = await registerBiometric(label);
    persist({ ...config, biometric: true, credentialId });
  }, [config]);

  const disableBiometric = useCallback(() => {
    if (!config) return;
    persist({ ...config, biometric: false, credentialId: undefined });
  }, [config]);

  return (
    <AppLockContext.Provider value={{
      config, isLocked, biometricAvailable, biometricStatus,
      enable, disable, unlock, unlockWithBiometric, lockNow,
      setAutoLockMinutes, enableBiometric, disableBiometric,
    }}>
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = () => {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider');
  return ctx;
};
