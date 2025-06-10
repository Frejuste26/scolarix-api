export default {
  clearMocks: true,
  coverageProvider: "v8",
  moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node"],
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],
  transform: {
    '^.+\\.js$': 'babel-jest', // Add this line if you encounter issues with ES6 modules
  },
  setupFiles: ['./jest.env.setup.js'], // Added this line
  setupFilesAfterEnv: ['./jest.setup.js'] // Optional: for global setup
};
