// https://docs.expo.dev/guides/using-eslint/
// Extend Expo utils + local expo rules (without expo/use-dom-exports) to avoid
// "Definition for rule 'expo/use-dom-exports' was not found" in some environments.
const path = require('path');

module.exports = {
  extends: [
    require.resolve('eslint-config-expo/utils/core.js'),
    require.resolve('eslint-config-expo/utils/typescript.js'),
    require.resolve('eslint-config-expo/utils/react.js'),
    path.join(__dirname, 'config', 'eslint-expo-rules.js'),
  ],
  ignorePatterns: ['node_modules', 'dist', 'supabase/functions'],
  globals: {
    __DEV__: 'readonly',
    ErrorUtils: false,
    FormData: false,
    XMLHttpRequest: false,
    alert: false,
    cancelAnimationFrame: false,
    cancelIdleCallback: false,
    clearImmediate: false,
    fetch: false,
    navigator: false,
    process: false,
    requestAnimationFrame: false,
    requestIdleCallback: false,
    setImmediate: false,
    window: false,
    'shared-node-browser': true,
  },
  settings: {
    'import/extensions': require('eslint-config-expo/utils/extensions.js').computeExpoExtensions(
      ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
      ['.android', '.ios', '.web', '.native']
    ),
    'import/resolver': {
      node: {
        extensions: require('eslint-config-expo/utils/extensions.js').computeExpoExtensions(
          ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
          ['.android', '.ios', '.web', '.native']
        ),
      },
    },
  },
  overrides: [
    {
      files: ['*.web.*'],
      env: { browser: true },
    },
    {
      files: ['public/sw.js'],
      env: { browser: true },
      globals: { self: 'readonly', URL: 'readonly' },
    },
  ],
};
