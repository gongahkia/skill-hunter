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

  async function read(input) {
    var data = input instanceof Uint8Array
      ? input
      : new Uint8Array(input instanceof ArrayBuffer ? input : await input.arrayBuffer());
    var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    var decoder = new TextDecoder();
    var entries = {};
    var offset = 0;
    while (offset + 30 <= data.length && view.getUint32(offset, true) === 0x04034b50) {
      var method = view.getUint16(offset + 8, true);
      if (method !== 0) throw new Error('Unsupported ZIP compression method: ' + method);
      var compressedSize = view.getUint32(offset + 18, true);
      var nameLength = view.getUint16(offset + 26, true);
      var extraLength = view.getUint16(offset + 28, true);
      var nameStart = offset + 30;
      var dataStart = nameStart + nameLength + extraLength;
      var dataEnd = dataStart + compressedSize;
      if (dataEnd > data.length) throw new Error('Invalid ZIP entry size');
      var name = decoder.decode(data.slice(nameStart, nameStart + nameLength));
      entries[name] = data.slice(dataStart, dataEnd);
      offset = dataEnd;
    }
    return entries;
  }

  return {
    create: create,
    read: read,
    crc32: crc32
  };
})();

if (typeof module !== 'undefined') module.exports = ZipWriter;
