const fs = require("fs/promises");
const path = require("path");

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, "dist");

const FILES = ["index.html", "styles.css", "app.js", "config.js"];

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const copyFile = async (filename) => {
  const from = path.join(ROOT_DIR, filename);
  const to = path.join(DIST_DIR, filename);
  await fs.copyFile(from, to);
};

const build = async () => {
  await ensureDir(DIST_DIR);
  await Promise.all(FILES.map(copyFile));
  console.log("Build complete -> dist/");
};

build().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
