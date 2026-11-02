/**
 * Icon Generator Script
 * Run this once to generate all required icons for Tauri
 *
 * Prerequisites: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Simple PNG generator without external dependencies
// Creates a basic 32x32 gold-colored icon with camera shape

function createPNG(width, height) {
    // PNG file structure
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);  // width
    ihdrData.writeUInt32BE(height, 4); // height
    ihdrData.writeUInt8(8, 8);         // bit depth
    ihdrData.writeUInt8(6, 9);         // color type (RGBA)
    ihdrData.writeUInt8(0, 10);        // compression
    ihdrData.writeUInt8(0, 11);        // filter
    ihdrData.writeUInt8(0, 12);        // interlace

    const ihdr = createChunk('IHDR', ihdrData);

    // Create image data
    const rawData = [];

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    for (let y = 0; y < height; y++) {
        rawData.push(0); // filter byte
        for (let x = 0; x < width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < radius) {
                // Gold color gradient
                const intensity = 1 - (dist / radius) * 0.3;
                rawData.push(Math.floor(201 * intensity)); // R
                rawData.push(Math.floor(169 * intensity)); // G
                rawData.push(Math.floor(97 * intensity));  // B
                rawData.push(255);                         // A
            } else {
                // Transparent
                rawData.push(0);
                rawData.push(0);
                rawData.push(0);
                rawData.push(0);
            }
        }
    }

    // Compress with zlib
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
    const idat = createChunk('IDAT', compressed);

    // IEND chunk
    const iend = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);

    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc >>> 0, 0);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
    let crc = 0xFFFFFFFF;
    const table = makeCRCTable();

    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xFF];
    }

    return crc ^ 0xFFFFFFFF;
}

function makeCRCTable() {
    const table = new Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c;
    }
    return table;
}

// Create ICO file
function createICO(pngBuffers) {
    const numImages = pngBuffers.length;
    const headerSize = 6;
    const dirEntrySize = 16;

    let offset = headerSize + (dirEntrySize * numImages);
    const offsets = [];

    for (const png of pngBuffers) {
        offsets.push(offset);
        offset += png.length;
    }

    // ICO header
    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0);      // reserved
    header.writeUInt16LE(1, 2);      // type (1 = ICO)
    header.writeUInt16LE(numImages, 4);

    // Directory entries
    const entries = [];
    for (let i = 0; i < pngBuffers.length; i++) {
        const entry = Buffer.alloc(dirEntrySize);
        const png = pngBuffers[i];

        // Parse PNG dimensions
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);

        entry.writeUInt8(width > 255 ? 0 : width, 0);   // width
        entry.writeUInt8(height > 255 ? 0 : height, 1); // height
        entry.writeUInt8(0, 2);            // color palette
        entry.writeUInt8(0, 3);            // reserved
        entry.writeUInt16LE(1, 4);         // color planes
        entry.writeUInt16LE(32, 6);        // bits per pixel
        entry.writeUInt32LE(png.length, 8); // size
        entry.writeUInt32LE(offsets[i], 12); // offset

        entries.push(entry);
    }

    return Buffer.concat([header, ...entries, ...pngBuffers]);
}

// Main
const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate PNGs at different sizes
const sizes = [32, 128, 256];
const pngBuffers = [];

for (const size of sizes) {
    const png = createPNG(size, size);
    pngBuffers.push(png);

    if (size === 32) {
        fs.writeFileSync(path.join(iconsDir, '32x32.png'), png);
        fs.writeFileSync(path.join(iconsDir, 'icon.png'), png);
    } else if (size === 128) {
        fs.writeFileSync(path.join(iconsDir, '128x128.png'), png);
    } else if (size === 256) {
        fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png);
    }
}

// Create ICO file
const ico = createICO(pngBuffers);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);

// Create ICNS placeholder (macOS) - just copy the 256x256 PNG
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), pngBuffers[2]);

console.log('Icons generated successfully!');
console.log('Files created in:', iconsDir);