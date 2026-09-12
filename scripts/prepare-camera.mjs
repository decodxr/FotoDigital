// Offline asset pipeline. Downloads only this CC0 asset, verifies source hashes,
// then embeds geometry and optimized textures into self-contained glTF 2 files.
// Usage: node scripts/prepare-camera.mjs /absolute/path/to/camera-source-cache
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }));
const cache = resolve(process.argv[2] || '.sites-runtime/camera-source');
const destination = resolve('public/models/camera');
await mkdir(cache, { recursive: true });
await mkdir(destination, { recursive: true });

async function download(info, target) {
    const url = new URL(info.url);
    if (!['dl.polyhaven.org', 'api.polyhaven.com'].includes(url.hostname) || url.protocol !== 'https:') throw new Error('Unexpected asset host');
    await mkdir(resolve(target, '..'), { recursive: true });
    let bytes;
    try { bytes = await readFile(target); } catch { /* Fresh source cache. */ }
    if (!bytes) {
        execFileSync('curl', ['-fsSL', '--retry', '2', '--max-time', '90', '-A', 'FotoDigitalAssetPreparation/1.0', '-o', target, info.url], { stdio: 'inherit' });
        bytes = await readFile(target);
    }
    if (info.md5 && createHash('md5').update(bytes).digest('hex') !== info.md5) throw new Error('Source checksum mismatch: ' + target);
    return bytes;
}

const files = JSON.parse(await download({ url: 'https://api.polyhaven.com/files/Camera_01' }, join(cache, 'files.json')));
const source = files.gltf['2k'].gltf;
const document = JSON.parse(await download(source, join(cache, 'camera.gltf')));
for (const [path, info] of Object.entries(source.include)) await download(info, join(cache, path));
const geometry = await readFile(join(cache, document.buffers[0].uri));
const pad = (buffer, value = 0) => Buffer.concat([buffer, Buffer.alloc((4 - buffer.length % 4) % 4, value)]);

for (const [name, size, quality] of [['camera-studio', 2048, 87], ['camera-mobile', 1024, 83]]) {
    const gltf = structuredClone(document);
    const chunks = [pad(geometry)];
    let offset = chunks[0].length;
    for (const image of gltf.images) {
        const buffer = await sharp(join(cache, image.uri)).resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality, effort: 6 }).toBuffer();
        const view = gltf.bufferViews.length;
        gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length });
        delete image.uri;
        image.bufferView = view;
        image.mimeType = 'image/webp';
        const padded = pad(buffer);
        chunks.push(padded);
        offset += padded.length;
    }
    for (const texture of gltf.textures) {
        texture.extensions = { ...texture.extensions, EXT_texture_webp: { source: texture.source } };
        delete texture.source;
    }
    gltf.extensionsUsed.push('EXT_texture_webp');
    gltf.extensionsRequired = ['EXT_texture_webp'];
    gltf.asset.copyright = 'Camera 01 by Rajil Jose Macatangay / Poly Haven. CC0 1.0. Optimized by FOTO DIGITAL.';
    gltf.buffers = [{ byteLength: offset }];
    const json = pad(Buffer.from(JSON.stringify(gltf)), 32);
    const binary = Buffer.concat(chunks);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
    const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(json.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
    const output = Buffer.concat([header, jsonHeader, json, binHeader, binary]);
    await writeFile(join(destination, name + '.glb'), output);
    console.log(name, output.length, 'bytes', createHash('sha256').update(output).digest('hex'));
}
