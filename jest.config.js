const { resolve } = require('path');

module.exports = {
  testTimeout: 120000,
  globalSetup: resolve(__dirname, './jest-setup.ts'),
  globalTeardown: resolve(__dirname, './jest-teardown.js'),
  testEnvironment: resolve(__dirname, './jest-environment.js'),
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  bail: 1,
  testFailureExitCode: 1,
};
