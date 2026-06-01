import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tunombre.superlista',
  appName: 'SuperLista',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;