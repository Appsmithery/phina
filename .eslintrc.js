// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['node_modules', 'dist', 'supabase/functions'],
  overrides: [
    {
      files: ['public/sw.js'],
      env: { browser: true },
      globals: { self: 'readonly', URL: 'readonly' },
    },
  ],
};
