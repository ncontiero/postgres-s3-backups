import { ncontiero } from "@ncontiero/eslint-config";

export default ncontiero({
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  settings: {
    node: {
      version: ">=24",
    },
  },
});
