// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { plugin as Markdown, Mode } from "vite-plugin-markdown";
import replace from "@rollup/plugin-replace";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

// plugins/merge-chunks.ts
import { build } from "esbuild";
import fs from "fs/promises";
import path from "path";
import glob from "fast-glob";
function esbuildConsolidatePreloads(outDir) {
  return {
    name: "esbuild-consolidate-preloads",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const outAbs = path.resolve(outDir);
      const preloadFiles = await glob("*.js", { cwd: outAbs, absolute: true });
      const chunkDir = path.join(outAbs, "chunks");
      for (const preloadPath of preloadFiles) {
        const filename = path.basename(preloadPath);
        const tmpOut = preloadPath + ".tmp";
        const tmpMapOut = tmpOut + ".map";
        const mapPath = preloadPath + ".map";
        console.log(`[esbuild-consolidate] bundling ${filename} \u2192 ${filename}`);
        const chunkFiles = await glob("chunks/**/*.js", {
          cwd: outAbs,
          absolute: true
        });
        const chunks = /* @__PURE__ */ new Map();
        for (const chunkPath of chunkFiles) {
          const relativePath = path.relative(outAbs, chunkPath);
          const content = await fs.readFile(chunkPath, "utf8");
          chunks.set("./" + relativePath, {
            content,
            dir: path.dirname(chunkPath)
          });
        }
        await build({
          entryPoints: [preloadPath],
          outfile: tmpOut,
          bundle: true,
          format: "cjs",
          platform: "node",
          sourcemap: false,
          external: ["electron", "@deta/backend", "electron-chrome-extensions"],
          // Add other node builtins as needed
          loader: {
            ".js": "js"
          },
          plugins: [
            {
              name: "inline-chunks",
              setup(build2) {
                build2.onResolve({ filter: /^\.\.?\/.*/ }, (args) => {
                  const targetPath = path.resolve(args.resolveDir, args.path);
                  const relativePath = "./" + path.relative(outAbs, targetPath);
                  if (chunks.has(relativePath)) {
                    return { path: relativePath, namespace: "chunks" };
                  }
                  if (args.path.includes("chunks/")) {
                    const chunkPath = "./" + args.path.replace(/^\.\//, "");
                    if (chunks.has(chunkPath)) {
                      return { path: chunkPath, namespace: "chunks" };
                    }
                  }
                  return null;
                });
                build2.onLoad({ filter: /.*/, namespace: "chunks" }, (args) => {
                  const chunk = chunks.get(args.path);
                  if (!chunk) {
                    throw new Error(`Could not find chunk ${args.path}`);
                  }
                  return {
                    contents: chunk.content,
                    loader: "js",
                    resolveDir: chunk.dir
                  };
                });
              }
            }
          ],
          resolveExtensions: [".ts", ".js"],
          mainFields: ["module", "main"],
          banner: {
            js: "/* eslint-disable */"
          }
        });
        await fs.rename(tmpOut, preloadPath);
        try {
          await fs.rename(tmpMapOut, mapPath);
        } catch (err) {
        }
      }
      try {
        await fs.rm(chunkDir, { recursive: true, force: true });
        console.log(`[esbuild-consolidate] cleaned up ${chunkDir}`);
      } catch (err) {
        console.warn(`[esbuild-consolidate] cleanup failed:`, err);
      }
    }
  };
}

// electron.vite.config.ts
import { nodePolyfills } from "vite-plugin-node-polyfills";

// plugins/license.ts
import { join } from "path";
import licensePlugin from "rollup-plugin-license";

// plugins/concat.ts
import fs2 from "fs";
import "rollup";
import { createFilter } from "rollup-pluginutils";
function concat(options = {}) {
  const filter = createFilter(options.include, options.exclude);
  const groupedFiles = options.groupedFiles || [];
  return {
    name: "concat",
    generateBundle() {
      for (const group of groupedFiles) {
        const files = group.files || [];
        if (typeof group.outputFile === "undefined") {
          throw new Error(
            "You must specify an outputFile property for each set of files to be concatenated."
          );
        }
        let code = "";
        for (const file of files) {
          try {
            if (filter(file)) {
              const content = fs2.readFileSync(file, "utf8");
              code += `${content}
`;
            }
          } catch (err) {
            this.warn(`Error reading file "${file}": ${err}`);
          }
        }
        this.emitFile({
          type: "asset",
          fileName: group.outputFile,
          source: code
        });
      }
    }
  };
}

// plugins/license.ts
import fs3 from "fs";
var __electron_vite_injected_dirname = "/Users/guilhermevarela/Public/surf/app/plugins";
var createLicenseOutputPath = (process2) => {
  return join(__electron_vite_injected_dirname, "out", "licenses", `dependencies-${process2}.txt`);
};
var createDependencyPath = (packageName) => {
  return join(__electron_vite_injected_dirname, "..", "..", "node_modules", packageName, "package.json");
};
var readAllDependencies = (packageJsonPath) => {
  const visited = /* @__PURE__ */ new Set();
  const dependencies = [];
  const traverse = (path2) => {
    if (visited.has(path2)) return;
    visited.add(path2);
    const content = fs3.readFileSync(path2, "utf-8");
    const pkg = JSON.parse(content);
    if (pkg.name) {
      dependencies.push(path2);
    }
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
      ...pkg.optionalDependencies
    };
    for (const depName of Object.keys(allDeps || {})) {
      try {
        const depPath = createDependencyPath(depName);
        traverse(depPath);
      } catch {
      }
    }
  };
  traverse(packageJsonPath);
  return dependencies;
};
var createLicensePlugin = (process2) => {
  let additionalDependencies;
  if (process2 === "main") {
    additionalDependencies = readAllDependencies(join(__electron_vite_injected_dirname, "..", "package.json"));
  }
  return licensePlugin({
    thirdParty: {
      multipleVersions: false,
      output: {
        file: createLicenseOutputPath(process2)
      }
    },
    additionalDependencies
  });
};
var createConcatLicensesPlugin = () => {
  return concat({
    groupedFiles: [
      {
        files: [
          createLicenseOutputPath("main"),
          createLicenseOutputPath("preload"),
          createLicenseOutputPath("renderer"),
          createLicenseOutputPath("backend"),
          createLicenseOutputPath("backend-server")
        ],
        outputFile: join("assets", "dependencies.txt")
      }
    ]
  });
};

// plugins/rust-license.ts
import { spawnSync } from "child_process";
import { join as join2 } from "path";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
var NOTICE_FILE_VARIATIONS = [
  "NOTICE",
  "NOTICE.txt",
  "NOTICE.md",
  "Notice",
  "notice",
  "notice.txt",
  "notice.md"
];
var isApacheLicense = (license) => {
  if (!license) return false;
  const normalized = license.toLowerCase();
  return normalized.includes("apache");
};
var findNoticeInCargoRegistry = (packageName, version) => {
  const cargoHome = process.env.CARGO_HOME || join2(process.env.HOME || "", ".cargo");
  const registryPath = join2(cargoHome, "registry", "src");
  try {
    if (!existsSync(registryPath)) {
      console.warn(`Registry path does not exist: ${registryPath}`);
      return null;
    }
    const registries = readdirSync(registryPath);
    for (const registry of registries) {
      const packageDir = join2(registryPath, registry, `${packageName}-${version}`);
      if (existsSync(packageDir)) {
        for (const noticeFile of NOTICE_FILE_VARIATIONS) {
          const noticePath = join2(packageDir, noticeFile);
          if (existsSync(noticePath)) {
            console.log(`Found NOTICE file for ${packageName}@${version}: ${noticePath}`);
            return readFileSync(noticePath, "utf8");
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Could not search cargo registry for NOTICE file: ${error}`);
  }
  return null;
};
var generateCargoLicenseFile = (cargoTomlPath, outputPath) => {
  const absoluteCargoPath = join2(process.cwd(), "..", cargoTomlPath);
  console.log(
    `Generating cargo license file for ${cargoTomlPath} at ${outputPath} (absolute path: ${absoluteCargoPath})`
  );
  const templatePath = join2(absoluteCargoPath, "about.hbs");
  if (!existsSync(templatePath)) {
    throw new Error(
      `Template file not found at ${templatePath}. Please create an about.hbs file in your Cargo project root.`
    );
  }
  const configPath = join2(absoluteCargoPath, "about.toml");
  if (!existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Please create an about.toml file in your Cargo project root.`
    );
  }
  const result = spawnSync(
    "cargo",
    [
      "about",
      "generate",
      "--all-features",
      "--config",
      "about.toml",
      "--output-file",
      outputPath,
      "about.hbs"
    ],
    {
      cwd: absoluteCargoPath,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:${process.env.HOME}/.cargo/bin`
      }
    }
  );
  if (result.error) {
    throw new Error(`Failed to generate license info: ${result.error}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `cargo-about failed with status ${result.status}:
stdout: ${result.stdout}
stderr: ${result.stderr}`
    );
  }
  console.log(`Cargo about generated license info successfully`);
  if (!existsSync(outputPath)) {
    throw new Error(`cargo-about did not create output file at ${outputPath}`);
  }
  let content = readFileSync(outputPath, "utf8");
  const packageRegex = /Name: (.+?)\nVersion: (.+?)\nLicense: (.+?)\n/g;
  const insertions = [];
  let match;
  while ((match = packageRegex.exec(content)) !== null) {
    const [fullMatch, name, version, license] = match;
    if (isApacheLicense(license)) {
      const noticeContent = findNoticeInCargoRegistry(name, version);
      const insertIndex = match.index + fullMatch.length;
      if (noticeContent) {
        const noticeBlock = `
NOTICE:
\`\`\`
${noticeContent}
\`\`\`
`;
        insertions.push({ index: insertIndex, content: noticeBlock });
      }
    }
  }
  insertions.reverse();
  for (const { index, content: insertContent } of insertions) {
    content = content.slice(0, index) + insertContent + content.slice(index);
  }
  writeFileSync(outputPath, content);
  console.log(`License file written to ${outputPath}`);
};
var createRustLicensePlugin = (cargoTomlPath, outputName) => {
  const outputPath = join2(process.cwd(), "plugins", "out", "licenses", outputName);
  return {
    name: "vite-plugin-rust-license",
    generateBundle() {
      try {
        console.log(`Generating Rust license info for ${cargoTomlPath}...`);
        this.info(`Generating Rust license info for ${cargoTomlPath}...`);
        generateCargoLicenseFile(cargoTomlPath, outputPath);
      } catch (error) {
        this.warn(`Failed to generate Rust license info: ${error}`);
        console.error(error);
      }
    }
  };
};

// electron.vite.config.ts
var __electron_vite_injected_dirname2 = "/Users/guilhermevarela/Public/surf/app";
var IS_DEV = process.env.NODE_ENV === "development";
var silenceWarnings = IS_DEV || process.env.SILENCE_WARNINGS === "true";
var svelteOptions = silenceWarnings ? {
  onwarn: (warning, handler) => {
    if (warning.code.toLowerCase().includes("a11y")) return;
    handler(warning);
  }
} : {};
var silencedDeprecations = ["legacy-js-api", "mixed-decls"];
var cssConfig = silenceWarnings ? {
  preprocessorOptions: {
    scss: {
      silenceDeprecations: silencedDeprecations
    }
  }
} : {
  preprocessorOptions: {
    scss: {}
  }
};
var electron_vite_config_default = defineConfig({
  main: {
    envPrefix: "M_VITE_",
    plugins: [externalizeDepsPlugin(), createLicensePlugin("main")],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname2, "src/main/index.ts"),
          imageProcessor: resolve(__electron_vite_injected_dirname2, "src/main/workers/imageProcessor.ts")
        }
      }
    },
    define: {
      "import.meta.env.PLATFORM": JSON.stringify(process.platform),
      "process.platform": JSON.stringify(process.platform)
    },
    css: cssConfig
  },
  preload: {
    envPrefix: "P_VITE_",
    plugins: [
      svelte(svelteOptions),
      externalizeDepsPlugin({ exclude: ["@deta/backend"] }),
      esbuildConsolidatePreloads("out/preload"),
      cssInjectedByJsPlugin({
        jsAssetsFilterFunction: (asset) => asset.fileName.endsWith("webcontents.js"),
        injectCode: (cssCode, _options) => {
          return `window.addEventListener('DOMContentLoaded', () => { try{if(typeof document != 'undefined'){var elementStyle = document.createElement('style');elementStyle.id="webview-styles";elementStyle.appendChild(document.createTextNode(${cssCode}));document.head.appendChild(elementStyle);}}catch(e){console.error('vite-plugin-css-injected-by-js', e);} })`;
        }
      }),
      replace({
        "doc.documentElement.style": "{}"
      }),
      createLicensePlugin("preload")
    ],
    build: {
      rollupOptions: {
        input: {
          core: resolve(__electron_vite_injected_dirname2, "src/preload/core.ts"),
          webcontents: resolve(__electron_vite_injected_dirname2, "src/preload/webcontents.ts"),
          overlay: resolve(__electron_vite_injected_dirname2, "src/preload/overlay.ts"),
          resource: resolve(__electron_vite_injected_dirname2, "src/preload/resource.ts")
        }
      },
      sourcemap: false,
      minify: true
    },
    define: {
      "import.meta.env.PLATFORM": JSON.stringify(process.platform),
      "process.platform": JSON.stringify(process.platform)
    },
    css: cssConfig
  },
  renderer: {
    envPrefix: "R_VITE_",
    plugins: [
      Markdown({ mode: [Mode.MARKDOWN, Mode.HTML] }),
      svelte(svelteOptions),
      createLicensePlugin("renderer"),
      // needed for gray-matter dependency
      nodePolyfills({
        globals: {
          Buffer: true
        }
      }),
      createRustLicensePlugin("packages/backend", "dependencies-backend.txt"),
      createRustLicensePlugin("packages/backend-server", "dependencies-backend-server.txt"),
      createConcatLicensesPlugin()
    ],
    build: {
      sourcemap: false,
      rollupOptions: {
        input: {
          main: resolve(__electron_vite_injected_dirname2, "src/renderer/Core/core.html"),
          settings: resolve(__electron_vite_injected_dirname2, "src/renderer/Settings/settings.html"),
          pdf: resolve(__electron_vite_injected_dirname2, "src/renderer/PDF/pdf.html"),
          overlay: resolve(__electron_vite_injected_dirname2, "src/renderer/Overlay/overlay.html"),
          resource: resolve(__electron_vite_injected_dirname2, "src/renderer/Resource/resource.html")
        },
        external: [
          "html-minifier-terser/dist/htmlminifier.esm.bundle.js",
          "@internationalized/date"
        ],
        output: {
          format: "es",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]"
        }
      },
      minify: true
    },
    define: {
      "import.meta.env.PLATFORM": JSON.stringify(process.platform),
      "process.platform": JSON.stringify(process.platform)
    },
    css: cssConfig
  }
});
export {
  electron_vite_config_default as default
};
