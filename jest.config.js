const { resolve } = require('path');

module.exports = {
  globalSetup: resolve(__dirname, './jest-setup.js'),
  globalTeardown: resolve(__dirname, './jest-teardown.js'),
  testEnvironment: resolve(__dirname, './jest-environment.js'),
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
};
