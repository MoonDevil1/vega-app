const base = require('./app.json').expo;
const projectId = process.env.EXPO_UPDATES_PROJECT_ID;
module.exports = {
  expo: {
    ...base,
    ...(projectId ? {
      updates: { url: 'https://u.expo.dev/' + projectId, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0, requestHeaders: { 'expo-channel-name': 'production' } },
      runtimeVersion: { policy: 'appVersion' },
      extra: { ...base.extra, eas: { projectId } },
    } : {}),
  },
};
