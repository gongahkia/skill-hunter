import { ParquetWriter } from 'parquetjs';
import avro from 'avsc';
import { dump } from 'js-yaml';
import { create } from 'xmlbuilder2';

export class FormatConverter {
  static toCSV(data) {
    const headers = Object.keys(data[0]).join(',');
    return [headers, ...data.map(d => Object.values(d).join(','))].join('\n');
  }

  static toParquet(data) {
    const schema = new ParquetWriter.Schema({
      role: { type: 'UTF8' },
      content: { type: 'UTF8' },
      timestamp: { type: 'TIMESTAMP_MILLIS' }
    });
    // Implementation for Parquet streaming
  }

  static toAvro(data) {
    const type = avro.Type.forSchema({
      type: 'record',
      fields: [
        { name: 'role', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'timestamp', type: 'string' }
      ]
    });
    return type.toBuffer(data);
  }

  static toXML(data) {
    return create({ version: '1.0' })
      .ele('messages')
      .ele(data.map(msg => ({ message: msg })))
      .end({ prettyPrint: true });
  }

  static toYAML(data) {
    return dump(data);
  }
}