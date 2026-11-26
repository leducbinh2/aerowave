import type { AeroWaveAPI } from '../shared/types';

declare global {
  interface Window {
    aerowave: AeroWaveAPI;
  }
}

export {};
