module.exports = {
  displayName: 'web',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
        },
      },
    ],
  },
  setupFiles: ['<rootDir>/src/tests/setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/../../test/apps/web/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': '<rootDir>/../../test/common/style-mock.js',
  },
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/**/*.spec.tsx',
    '<rootDir>/src/**/*.spec.js',
    '<rootDir>/src/**/*.spec.jsx',
    '<rootDir>/../../test/apps/web/src/**/*.spec.ts',
    '<rootDir>/../../test/apps/web/src/**/*.spec.tsx',
    '<rootDir>/../../test/apps/web/src/**/*.spec.js',
    '<rootDir>/../../test/apps/web/src/**/*.spec.jsx',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/web',
};
