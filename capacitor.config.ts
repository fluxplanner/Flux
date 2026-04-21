import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fluxplanner.app',
  appName: 'Flux Planner',
  webDir: 'www',
  backgroundColor: '#0a0b10',
  ios: {
    contentInset: 'always',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
    scheme: 'flux',
    backgroundColor: '#0a0b10',
  },
  android: {
    backgroundColor: '#0a0b10',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0a0b10',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0b10',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_flux_notif',
      iconColor: '#00bfff',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
