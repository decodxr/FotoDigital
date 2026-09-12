import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cameraPose, chapterAt, scrollProgress } from '../lib/shared/camera-motion.ts';

test('Camera scroll accounts for the sticky header and bounds both ends', () => {
    assert.equal(scrollProgress(500, 2400, 600, 150), 0);
    assert.equal(scrollProgress(150, 2400, 600, 150), 0);
    assert.equal(scrollProgress(-750, 2400, 600, 150), 0.5);
    assert.equal(scrollProgress(-1650, 2400, 600, 150), 1);
    assert.equal(scrollProgress(-2400, 2400, 600, 150), 1);
    assert.ok(Number.isFinite(scrollProgress(0, 600, 600, 150)));
    const shortScreen = [500, 250, 0, -250, -500].map(top => scrollProgress(top, 900, 900, 150, 740));
    assert.ok(shortScreen.every(value => value > 0 && value < 1));
    assert.ok(shortScreen.every((value, index) => index === 0 || value > shortScreen[index - 1]));
});

test('Chapters and the full camera turn stay synchronized in either scroll direction', () => {
    assert.deepEqual([0, 0.32, 0.34, 0.66, 0.68, 1].map(chapterAt), [0, 0, 1, 1, 2, 2]);
    assert.deepEqual([1, 0.5, 0].map(chapterAt), [2, 1, 0]);
    assert.ok(Math.abs(cameraPose(1).yaw - cameraPose(0).yaw - Math.PI * 2) < 1e-9);
    assert.equal(cameraPose(-10).yaw, cameraPose(0).yaw);
    assert.equal(cameraPose(10).yaw, cameraPose(1).yaw);
});

for (const [name, limit, checksum] of [
    ['camera-studio', 4_200_000, '46db5ea6f13b67882ca0413b6a656181f4f4bab40da008bafcc69447e90df14e'],
    ['camera-mobile', 1_800_000, '3161710278ececb52ba6151a3db679bd61f55c0d10f145b672127d30331ef8ab'],
]) test(name + ' is a licensed, self-contained glTF asset within its transfer budget', async () => {
    const bytes = await readFile(new URL('../public/models/camera/' + name + '.glb', import.meta.url));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.ok(bytes.length < limit);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), checksum);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const binaryLength = bytes.readUInt32LE(20 + jsonLength);
    assert.match(gltf.asset.copyright, /Rajil Jose Macatangay/);
    assert.match(gltf.asset.copyright, /CC0/);
    assert.ok(gltf.materials.some(material => material.name === 'Camera_01_lens'));
    assert.equal(gltf.images.length, 9);
    assert.ok(gltf.images.every(image => !image.uri && image.mimeType === 'image/webp'));
    assert.ok(gltf.buffers.every(buffer => !buffer.uri));
    for (const view of gltf.bufferViews) assert.ok((view.byteOffset || 0) + view.byteLength <= binaryLength);
    for (const texture of gltf.textures) assert.ok(texture.extensions.EXT_texture_webp.source < gltf.images.length);
});
