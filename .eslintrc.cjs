module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { tsconfigRootDir: __dirname, project: './tsconfig.json' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended','plugin:@typescript-eslint/recommended'],
  env: { node: true, es6: true },
  ignorePatterns: ['dist','coverage','node_modules','gate-artifacts','tmp','*.log'],
  rules: {
    // Keep strict linting but avoid blocking on legacy `any` usage
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-inner-declarations': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'warn'
  }
}
