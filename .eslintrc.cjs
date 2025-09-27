module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended','plugin:@typescript-eslint/recommended'],
  env: { node: true, es6: true },
  ignorePatterns: ['dist','coverage','node_modules','gate-artifacts','tmp','*.log','apps','src/**/__tests__','src/**/*.test.ts','src/**/*.spec.ts'],
  rules: {
    // Keep strict linting but avoid blocking on legacy `any` usage
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-inner-declarations': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'warn',
    'no-case-declarations': 'error',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }]
  }
}
