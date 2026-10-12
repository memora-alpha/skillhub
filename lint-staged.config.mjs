import path from "node:path";

export function quoteShellArgument(value) {
  const escaped = value.replaceAll("'", String.raw`'\''`);
  return `'${escaped}'`;
}

function apiEslint(files) {
  const workspaceRoot = path.resolve("services/api");
  const fileArguments = files
    .map((file) =>
      path.relative(workspaceRoot, path.resolve(file)).replaceAll("\\", "/"),
    )
    .map(quoteShellArgument)
    .join(" ");

  return `pnpm --filter api exec eslint --fix -- ${fileArguments}`;
}

export default {
  "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md}": "prettier --write",
  "services/api/{src,test}/**/*.ts": apiEslint,
};
