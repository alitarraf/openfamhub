import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node
    },
    rules: {
      // `_`-prefixed = deliberately unused (e.g. destructuring `uid` out of the
      // roster before sending it to the client, `_req` in handlers).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
];
