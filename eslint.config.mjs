import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'uploads/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
      'prefer-const': 'error',
    },
  },
  {
    // Migrations and seeds are executed by the Knex CLI; the table-builder callbacks
    // there are inherently untyped, so the return-type rule adds noise without value.
    files: ['src/database/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  prettier,
);
