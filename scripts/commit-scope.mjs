import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const WORKSPACE_GROUPS = ["apps", "packages", "services"];

function discoverWorkspaces() {
  return WORKSPACE_GROUPS.flatMap((group) => {
    const groupPath = path.join(REPO_ROOT, group);

    if (!existsSync(groupPath)) {
      return [];
    }

    return readdirSync(groupPath, { withFileTypes: true }).flatMap((entry) => {
      const root = `${group}/${entry.name}`;
      const manifestPath = path.join(REPO_ROOT, root, "package.json");

      if (!entry.isDirectory() || !existsSync(manifestPath)) {
        return [];
      }

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

        if (typeof manifest.name !== "string" || !manifest.name.trim()) {
          throw new TypeError("package name must be a non-empty string");
        }

        return [{ name: manifest.name.split("/").at(-1), root }];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(
          `Skipping invalid workspace manifest ${manifestPath}: ${reason}`,
        );
        return [];
      }
    });
  });
}

const WORKSPACES = discoverWorkspaces();

function normalizePath(file) {
  return file.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

function findWorkspace(file) {
  return WORKSPACES.find(
    ({ root }) => file === root || file.startsWith(`${root}/`),
  );
}

function findModule(file, workspace) {
  const modulePrefix = `${workspace.root}/src/modules/`;

  if (!file.startsWith(modulePrefix)) {
    return null;
  }

  return file.slice(modulePrefix.length).split("/")[0] || null;
}

export function getStagedFiles() {
  return (process.env.COMMITLINT_STAGED_FILES ?? "")
    .split(/\r?\n/u)
    .map(normalizePath)
    .filter(Boolean);
}

export function expectedScopeForFiles(files) {
  const normalizedFiles = files.map(normalizePath).filter(Boolean);

  if (normalizedFiles.length === 0) {
    return null;
  }

  const workspaces = normalizedFiles.map(findWorkspace);
  const workspace = workspaces[0];

  if (
    !workspace ||
    workspaces.some((candidate) => candidate?.name !== workspace.name)
  ) {
    return null;
  }

  const modules = normalizedFiles.map((file) => findModule(file, workspace));
  const module = modules[0];

  if (module && modules.every((candidate) => candidate === module)) {
    return `${workspace.name}/${module}`;
  }

  return workspace.name;
}

function isKnownScope(scope) {
  const [packageName, moduleName, extraSegment] = scope.split("/");
  const workspace = WORKSPACES.find(({ name }) => name === packageName);

  if (!workspace || extraSegment) {
    return false;
  }

  if (!moduleName) {
    return true;
  }

  return existsSync(
    path.join(REPO_ROOT, workspace.root, "src", "modules", moduleName),
  );
}

export function validateCommitScope(scope, files) {
  const expectedScope = expectedScopeForFiles(files);

  if (expectedScope && scope !== expectedScope) {
    return [
      false,
      `scope must be "${expectedScope}" for the staged files (example: feat(${expectedScope}): add feature)`,
    ];
  }

  if (!expectedScope && scope && !isKnownScope(scope)) {
    return [
      false,
      "scope must use a known package, optionally followed by a module: package/module",
    ];
  }

  return [true];
}
