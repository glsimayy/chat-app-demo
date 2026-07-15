module.exports = {
  collectCoverageFrom: [
    "**/*.ts",
    "!**/*.module.ts",
    "!main.ts",
    "!**/*.dto.ts",
    "!**/*.interface.ts",
    "!**/*.types.ts",
  ],
  coverageDirectory: "../coverage",
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.test.json" }],
  },
};
