// Expo plugin rules without use-dom-exports (avoids "rule not found" when plugin resolution fails).
module.exports = {
  plugins: ['expo'],
  rules: {
    'expo/no-env-var-destructuring': ['error'],
    'expo/no-dynamic-env-var': ['error'],
  },
};
