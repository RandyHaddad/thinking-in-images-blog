import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";

const expected = [
  ["assets/hero-thinking-in-images.png", 1981, 792],
  ["assets/codex-merge-visual.png", 1670, 826],
  ["assets/for-humans-for-agents.png", 1234, 1100],
  ["assets/html-image-hybrid.png", 1478, 1140]
];

function pngSize(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Not a PNG");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

for (const [path, width, height] of expected) {
  const buffer = await readFile(path);
  const actual = pngSize(buffer);
  if (actual.width !== width || actual.height !== height) {
    throw new Error(`${path} is ${actual.width}x${actual.height}, expected ${width}x${height}`);
  }
  const { size } = statSync(path);
  if (size < 100_000) {
    throw new Error(`${path} looks unexpectedly small at ${size} bytes`);
  }
  console.log(`${path}: ${actual.width}x${actual.height}, ${(size / 1024).toFixed(0)} KB`);
}
