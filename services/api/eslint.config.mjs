import { config } from "@skillhub/eslint-config/base";

export default [...config, { ignores: ["src/generated/**"] }];
