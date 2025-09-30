import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.humhunch.superior-steam.sdPlugin";

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    sourcemap: isWatching,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
      return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
    },
  },
  plugins: [
    {
      name: "watch-externals",
      buildStart: function () {
        this.addWatchFile(`${sdPlugin}/manifest.json`);
      },
    },
    typescript({
      mapRoot: isWatching ? "./" : undefined,
    }),
    nodeResolve({
      browser: false,
      exportConditions: ["node"],
      preferBuiltins: true,
    }),
    commonjs(),
    {
      name: "copy-ps-list-vendor",
      buildEnd() {
        const src = path.join("node_modules", "ps-list", "vendor");
        const dest = path.join(sdPlugin, "bin", "vendor");

        // Create destination directory
        fs.mkdirSync(dest, { recursive: true });

        // Copy all files
        fs.readdirSync(src).forEach((file) => {
          fs.copyFileSync(path.join(src, file), path.join(dest, file));
        });

        console.log(`✓ Copied ps-list vendor files to ${dest}`);
      },
    },
    !isWatching && terser(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
      },
    },
  ],
};

export default config;
