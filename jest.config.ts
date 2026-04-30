export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/testing/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};