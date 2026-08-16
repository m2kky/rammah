import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(projectRoot, "assets", "seo");
const appRoot = path.join(projectRoot, "app");
const portraitMaster = path.join(assetRoot, "portrait-icon-master.png");
const socialMaster = path.join(assetRoot, "social-card-master.png");
const iconPath = path.join(appRoot, "icon.png");
const applePath = path.join(appRoot, "apple-icon.png");
const socialPath = path.join(appRoot, "opengraph-image.png");
const faviconPath = path.join(appRoot, "favicon.ico");

const iconPng = (size) => sharp(portraitMaster)
  .resize(size, size, { fit: "cover", position: "centre" })
  .ensureAlpha()
  .png({ compressionLevel: 9, palette: false })
  .toBuffer();

const packIco = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;
  images.forEach(({ size, data }, index) => {
    const entry = index * 16;
    directory.writeUInt8(size === 256 ? 0 : size, entry);
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2);
    directory.writeUInt8(0, entry + 3);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map(({ data }) => data)]);
};

const dimensions = async (file) => {
  const { width, height } = await sharp(file).metadata();
  return { width, height };
};

const main = async () => {
  const portraitDimensions = await dimensions(portraitMaster);
  assert.equal(portraitDimensions.width, portraitDimensions.height, "Portrait master must be square.");

  await sharp(await iconPng(512)).toFile(iconPath);
  await sharp(await iconPng(180)).toFile(applePath);
  await sharp(socialMaster)
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toFile(socialPath);

  const faviconImages = await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, data: await iconPng(size) })),
  );
  for (const { data } of faviconImages) {
    assert.equal((await sharp(data).metadata()).hasAlpha, true, "ICO PNG frames must be RGBA.");
  }
  await writeFile(faviconPath, packIco(faviconImages));

  assert.deepEqual(await dimensions(iconPath), { width: 512, height: 512 });
  assert.deepEqual(await dimensions(applePath), { width: 180, height: 180 });
  assert.deepEqual(await dimensions(socialPath), { width: 1200, height: 630 });
  assert.equal((await readFile(faviconPath)).subarray(0, 4).toString("hex"), "00000100");

  console.log("Generated SEO assets:");
  console.log(`- ${iconPath} (512x512)`);
  console.log(`- ${applePath} (180x180)`);
  console.log(`- ${socialPath} (1200x630)`);
  console.log(`- ${faviconPath} (16x16, 32x32, 48x48)`);
};

await main();
