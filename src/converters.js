import { ParquetWriter } from 'parquetjs';
import avro from 'avsc';
import { dump } from 'js-yaml';
import { create } from 'xmlbuilder2';

export class FormatConverter {
  static toCSV(data) {
    const headers = ['role', 'content', 'id'].join(',');
    return [headers, ...data.map(d => 
      `"${[d.role, d.content, d.id].map(field => 
        field.replace(/"/g, '""')).join('","')}"`
    )].join('\n');
  }

  static async toParquet(data) {
    const schema = new ParquetWriter.Schema({
      role: { type: 'UTF8' },
      content: { type: 'UTF8' },
      id: { type: 'UTF8' }
    });

    const writer = await ParquetWriter.openBuffer(schema);
    for(const record of data) {
      await writer.appendRow(record);
    }
    await writer.close();
    return writer.toBuffer();
  }

  static toAvro(data) {
    const type = avro.Type.forSchema({
      type: 'record',
      name: 'ChatMessage',
      fields: [
        { name: 'role', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'id', type: 'string' }
      ]
    });
    return type.toBuffer(data);
  }

  static toXML(data) {
    const root = create({ version: '1.0' })
      .ele('messages');
    
    data.forEach(msg => {
      root.ele('message')
        .ele('role').txt(msg.role).up()
        .ele('content').txt(msg.content).up()
        .ele('id').txt(msg.id).up();
    });

    return root.end({ prettyPrint: true });
  }

  static toYAML(data) {
    return dump(data);
  }

  static toNDJSON(data) {
    return data.map(JSON.stringify).join('\n');
  }

  static toTSV(data) {
    const headers = ['role', 'content', 'id'].join('\t');
    return [headers, ...data.map(d => 
      [d.role, d.content, d.id]
        .map(field => field.replace(/\t/g, ' '))
        .join('\t')
    )].join('\n');
  }
}