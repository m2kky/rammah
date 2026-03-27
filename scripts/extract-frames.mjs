/**
 * extract-frames.mjs
 * Extracts frames from the services video as WebP images for smooth scroll scrubbing.
 * Usage: node scripts/extract-frames.mjs
 */

import ffmpegStatic from "ffmpeg-static";
import { createRequire } from "module";
import { execSync } from "child_process";
import { mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const INPUT  = path.join(projectRoot, "public", "videos", "ramah-turn.webm");
const OUTPUT = path.join(projectRoot, "public", "frames");
const FPS    = 24;   // frames per second to extract
const WIDTH  = 840;  // output width in px (height auto)
const QUALITY = 85;  // WebP quality 0-100

if (!existsSync(OUTPUT)) {
  mkdirSync(OUTPUT, { recursive: true });
  console.log("Created directory:", OUTPUT);
}

const ffmpeg = ffmpegStatic;
console.log("Using ffmpeg:", ffmpeg);
console.log("Extracting frames at", FPS, "fps ...");

const cmd = `"${ffmpeg}" -i "${INPUT}" -vf "fps=${FPS},scale=${WIDTH}:-1" -vcodec libwebp -quality ${QUALITY} "${path.join(OUTPUT, "frame%04d.webp")}" -y`;

console.log("Running:", cmd, "\n");

try {
  const result = execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] });
  console.log(result.toString());
} catch (err) {
  // ffmpeg writes to stderr even on success
  const output = err.stderr?.toString() || err.message;
  if (output.includes("Output #0")) {
    console.log("✅ Done! Frames saved to:", OUTPUT);
    // Count frames
    const { readdirSync } = await import("fs");
    const count = readdirSync(OUTPUT).filter(f => f.endsWith(".webp")).length;
    console.log(`   Total frames: ${count}`);
    console.log(`   Use frameCount=${count} in ServicesSection.tsx`);
  } else {
    console.error("❌ FFmpeg error:", output);
    process.exit(1);
  }
}
