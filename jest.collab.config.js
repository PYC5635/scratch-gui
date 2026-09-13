// Jest config for the collaboration engine unit tests. These are pure-logic
// tests that don't need the enzyme/jsdom setup files from the main config
// (which currently fail to load under this node/jest combination because a
// hoisted modern cheerio requires `node:`-prefixed core modules).
// Run with: npm run test:collab
module.exports = {
    setupFiles: [],
    testMatch: ['<rootDir>/test/unit/collaboration/**/*.test.js'],
    // jest 21's default babel-jest drives babel-core 6, which cannot load the
    // babel 7 plugins in .babelrc ("Requires Babel ^7.0.0-0"). Use the same
    // babel 7 transformer as the main jest config.
    transform: {
        '^.+\\.(js|jsx|mjs|cjs)$': '<rootDir>/test/helpers/babel7-jest-transformer.js'
    },
    moduleNameMapper: {
        '\\.(css|less)$': '<rootDir>/test/__mocks__/styleMock.js'
    }
};
