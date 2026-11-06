const { withDangerousMod } = require("expo/config-plugins");
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");

// The existing Expo 58 wrapper predates the installed Android Gradle Plugin's
// 9.4.1 minimum. Preserve newer versions and custom distributions.
function updateWrapper(source) {
  return source.replace(
    /^(distributionUrl=https\\?:\/\/services\.gradle\.org\/distributions\/gradle-)9\.3\.1(-bin\.zip)\r?$/m,
    (_, prefix, suffix) => `${prefix}9.4.1${suffix}`,
  );
}

function withAndroidGradle(config) {
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const target = path.join(
        mod.modRequest.platformProjectRoot,
        "gradle",
        "wrapper",
        "gradle-wrapper.properties",
      );
      const source = await readFile(target, "utf8");
      const next = updateWrapper(source);
      if (next !== source) await writeFile(target, next);
      return mod;
    },
  ]);
}
module.exports = withAndroidGradle;
module.exports.updateWrapper = updateWrapper;
