var ZipWriter = (function() {
  var CRC_TABLE = (function() {
    var table = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function bytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return new TextEncoder().encode(String(value || ''));
  }

  function crc32(data) {
    data = bytes(data);
    var crc = 0xffffffff;
    for (var i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(input) {
    var date = input instanceof Date ? input : new Date();
    var year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function writer(size) {
    var view = new DataView(new ArrayBuffer(size));
    var offset = 0;
    return {
      u16: function(value) {
        view.setUint16(offset, value, true);
        offset += 2;
      },
      u32: function(value) {
        view.setUint32(offset, value >>> 0, true);
        offset += 4;
      },
      bytes: function(value) {
        new Uint8Array(view.buffer).set(value, offset);
        offset += value.length;
      },
      done: function() {
        return new Uint8Array(view.buffer);
      }
    };
  }

  function concat(parts, total) {
    var out = new Uint8Array(total);
    var offset = 0;
    parts.forEach(function(part) {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function localHeader(nameBytes, dataBytes, crc, stamp) {
    var out = writer(30 + nameBytes.length);
    out.u32(0x04034b50);
    out.u16(20);
    out.u16(0x0800);
    out.u16(0);
    out.u16(stamp.time);
    out.u16(stamp.date);
    out.u32(crc);
    out.u32(dataBytes.length);
    out.u32(dataBytes.length);
    out.u16(nameBytes.length);
    out.u16(0);
    out.bytes(nameBytes);
    return out.done();
  }

  function centralHeader(nameBytes, dataBytes, crc, stamp, offset) {
    var out = writer(46 + nameBytes.length);
    out.u32(0x02014b50);
    out.u16(20);
    out.u16(20);
    out.u16(0x0800);
    out.u16(0);
    out.u16(stamp.time);
    out.u16(stamp.date);
    out.u32(crc);
    out.u32(dataBytes.length);
    out.u32(dataBytes.length);
    out.u16(nameBytes.length);
    out.u16(0);
    out.u16(0);
    out.u16(0);
    out.u16(0);
    out.u32(0);
    out.u32(offset);
    out.bytes(nameBytes);
    return out.done();
  }

  function endRecord(fileCount, centralSize, centralOffset) {
    var out = writer(22);
    out.u32(0x06054b50);
    out.u16(0);
    out.u16(0);
    out.u16(fileCount);
    out.u16(fileCount);
    out.u32(centralSize);
    out.u32(centralOffset);
    out.u16(0);
    return out.done();
  }

  function create(files) {
    files = Array.isArray(files) ? files : [];
    var localParts = [];
    var centralParts = [];
    var offset = 0;
    var total = 0;

    files.forEach(function(file) {
      var nameBytes = bytes(file.name);
      var dataBytes = bytes(file.content);
      var stamp = dosDateTime(file.date);
      var crc = crc32(dataBytes);
      var local = localHeader(nameBytes, dataBytes, crc, stamp);
      var central = centralHeader(nameBytes, dataBytes, crc, stamp, offset);
      localParts.push(local, dataBytes);
      centralParts.push(central);
      offset += local.length + dataBytes.length;
      total += local.length + dataBytes.length + central.length;
    });

    var centralSize = centralParts.reduce(function(sum, part) {
      return sum + part.length;
    }, 0);
    var end = endRecord(files.length, centralSize, offset);
    total += end.length;
    return new Blob([concat(localParts.concat(centralParts).concat([end]), total)], { type: 'application/zip' });
  }

  function abortError() {
    var error = new Error('ZIP read cancelled');
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    return error;
  }

  function throwIfCancelled(signal) {
    if (signal && signal.aborted) throw abortError();
  }

  function inputBytes(input) {
    if (input instanceof Uint8Array) return Promise.resolve(input);
    if (input instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(input));
    return input.arrayBuffer().then(function(buffer) {
      return new Uint8Array(buffer);
    });
  }

  function findEndRecord(view, length) {
    var min = Math.max(0, length - 66000);
    for (var offset = length - 22; offset >= min; offset--) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    return -1;
  }

  function centralEntries(data, view, decoder) {
    var end = findEndRecord(view, data.length);
    if (end === -1) return [];
    var count = view.getUint16(end + 10, true);
    var offset = view.getUint32(end + 16, true);
    var rows = [];
    for (var i = 0; i < count; i++) {
      if (offset + 46 > data.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
      var compressedSize = view.getUint32(offset + 20, true);
      var uncompressedSize = view.getUint32(offset + 24, true);
      var localOffset = view.getUint32(offset + 42, true);
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('Unsupported ZIP64 entry');
      var nameLength = view.getUint16(offset + 28, true);
      var extraLength = view.getUint16(offset + 30, true);
      var commentLength = view.getUint16(offset + 32, true);
      var name = decoder.decode(data.slice(offset + 46, offset + 46 + nameLength));
      if (localOffset + 30 > data.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Invalid ZIP local header');
      var localNameLength = view.getUint16(localOffset + 26, true);
      var localExtraLength = view.getUint16(localOffset + 28, true);
      var dataStart = localOffset + 30 + localNameLength + localExtraLength;
      var dataEnd = dataStart + compressedSize;
      if (dataEnd > data.length) throw new Error('Invalid ZIP entry size');
      rows.push({
        name: name,
        method: view.getUint16(offset + 10, true),
        flags: view.getUint16(offset + 8, true),
        compressedSize: compressedSize,
        uncompressedSize: uncompressedSize,
        dataStart: dataStart,
        dataEnd: dataEnd
      });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return rows;
  }

  function localEntries(data, view, decoder) {
    var rows = [];
    var offset = 0;
    while (offset + 30 <= data.length && view.getUint32(offset, true) === 0x04034b50) {
      var compressedSize = view.getUint32(offset + 18, true);
      var uncompressedSize = view.getUint32(offset + 22, true);
      var nameLength = view.getUint16(offset + 26, true);
      var extraLength = view.getUint16(offset + 28, true);
      var nameStart = offset + 30;
      var dataStart = nameStart + nameLength + extraLength;
      var dataEnd = dataStart + compressedSize;
      if (dataEnd > data.length) throw new Error('Invalid ZIP entry size');
      rows.push({
        name: decoder.decode(data.slice(nameStart, nameStart + nameLength)),
        method: view.getUint16(offset + 8, true),
        flags: view.getUint16(offset + 6, true),
        compressedSize: compressedSize,
        uncompressedSize: uncompressedSize,
        dataStart: dataStart,
        dataEnd: dataEnd
      });
      offset = dataEnd;
    }
    return rows;
  }

  async function inflateRaw(data) {
    if (typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined') {
      try {
        var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (error) {
        if (typeof require === 'undefined') throw error;
      }
    }
    if (typeof require !== 'undefined') {
      var zlib = require('zlib');
      return new Uint8Array(zlib.inflateRawSync(typeof Buffer !== 'undefined' ? Buffer.from(data) : data));
    }
    throw new Error('ZIP deflate support is unavailable');
  }

  async function entryData(data, entry) {
    var compressed = data.slice(entry.dataStart, entry.dataEnd);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return inflateRaw(compressed);
    throw new Error('Unsupported ZIP compression method: ' + entry.method);
  }

  function yieldTurn() {
    return new Promise(function(resolve) {
      setTimeout(resolve, 0); // yield between entries for import UI responsiveness
    });
  }

  async function* entries(input, options) {
    options = options || {};
    var data = await inputBytes(input);
    var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    var decoder = new TextDecoder();
    var rows = centralEntries(data, view, decoder);
    if (!rows.length) rows = localEntries(data, view, decoder);
    for (var i = 0; i < rows.length; i++) {
      throwIfCancelled(options.signal);
      var row = rows[i];
      var content = await entryData(data, row);
      var entry = Object.assign({ index: i, total: rows.length, data: content }, row);
      if (typeof options.onEntry === 'function') options.onEntry(entry);
      yield entry;
      if (options.yield !== false) await yieldTurn();
    }
  }

  async function read(input, options) {
    var out = {};
    for await (var entry of entries(input, options)) {
      out[entry.name] = entry.data;
    }
    return out;
  }

  return {
    create: create,
    read: read,
    entries: entries,
    crc32: crc32
  };
})();

if (typeof module !== 'undefined') module.exports = ZipWriter;
