import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'zlib';
import { evalSrc } from './helpers.js';

const { ZipWriter } = evalSrc('zip.js');

async function readStoredEntries(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const entries = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries[name] = decoder.decode(bytes.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return entries;
}

function u16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function u32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function bytes(value) {
  return new TextEncoder().encode(value);
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function compressedZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach((file) => {
    const name = bytes(file.name);
    const original = bytes(file.content);
    const compressed = new Uint8Array(deflateRawSync(original));
    const crc = ZipWriter.crc32(original);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 6, 0x0800);
    u16(localView, 8, 8);
    u32(localView, 14, crc);
    u32(localView, 18, compressed.length);
    u32(localView, 22, original.length);
    u16(localView, 26, name.length);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u16(centralView, 8, 0x0800);
    u16(centralView, 10, 8);
    u32(centralView, 16, crc);
    u32(centralView, 20, compressed.length);
    u32(centralView, 24, original.length);
    u16(centralView, 28, name.length);
    u32(centralView, 42, offset);
    central.set(name, 46);
    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  });
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, files.length);
  u16(endView, 10, files.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, offset);
  return new Blob([concat(locals.concat(centrals).concat([end]))], { type: 'application/zip' });
}

describe('ZipWriter', () => {
  it('builds a valid stored ZIP with UTF-8 file paths', async () => {
    const blob = ZipWriter.create([
      { name: 'Rakuzaichi/Chat 1.md', content: '# Chat 1\n' },
      { name: 'Rakuzaichi/Claude.md', content: 'hello' }
    ]);
    const entries = await readStoredEntries(blob);
    const readEntries = await ZipWriter.read(blob);

    expect(blob.type).toBe('application/zip');
    expect(entries['Rakuzaichi/Chat 1.md']).toBe('# Chat 1\n');
    expect(entries['Rakuzaichi/Claude.md']).toBe('hello');
    expect(new TextDecoder().decode(readEntries['Rakuzaichi/Chat 1.md'])).toBe('# Chat 1\n');
  });

  it('computes standard CRC-32 values', () => {
    expect(ZipWriter.crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });

  it('reads deflated ZIP entries through the async iterator', async () => {
    const blob = compressedZip([
      { name: 'export/messages.json', content: '[{"id":"m1"}]' },
      { name: 'export/meta.json', content: '{"ok":true}' }
    ]);
    const seen = [];
    const readEntries = await ZipWriter.read(blob, { onEntry: (entry) => seen.push(entry.name) });

    expect(new TextDecoder().decode(readEntries['export/messages.json'])).toBe('[{"id":"m1"}]');
    expect(new TextDecoder().decode(readEntries['export/meta.json'])).toBe('{"ok":true}');
    expect(seen).toEqual(['export/messages.json', 'export/meta.json']);
  });
});
