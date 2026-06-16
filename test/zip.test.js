import { describe, expect, it } from 'vitest';
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
});
