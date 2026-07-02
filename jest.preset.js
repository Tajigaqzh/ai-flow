module.exports = {
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': '<rootDir>/../../test/style-mock.js',
  },
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
};
