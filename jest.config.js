// See https://jestjs.io/docs/en/configuration
module.exports = {
  // preset: 'ts-jest',
  transform: {
    '^.+\\.[t|j|e]sx?$': 'babel-jest',
  },
  // Automatically clear mock calls and instances before every test.
  // Equivalent to calling `jest.clearAllMocks()` before each test.
  // This does not remove any mock implementation that may have been provided.
  clearMocks: true,
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['js', 'es', 'json', 'jsx', 'ts', 'tsx'],
  testMatch: [
    '**/__tests__/**/*.[ejt]s?(x)',
    '**/?(*.)+(spec|test).[ejt]s?(x)',
  ],
  collectCoverageFrom: ['./src/**/*.{es,js,ts,tsx}'],
}
