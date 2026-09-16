import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'MotoLock',
  webDir: 'dist',
  server: {
    url: 'http://localhost:5173',
    cleartext: true
  }
};

export default config;