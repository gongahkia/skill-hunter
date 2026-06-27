import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(repoRoot, 'schemas', 'dashboard-state.schema.json');
const outputPath = path.join(repoRoot, 'src', 'extension', 'lib', 'dashboard-state-validator.js');
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const ajv = new Ajv2020({
    code: {
        esm: true,
        lines: true,
        source: true,
    },
    strict: false,
});
const validate = ajv.compile(schema);
const code = standaloneCode(ajv, validate).trimEnd();

await writeFile(outputPath, `${code}\n`, 'utf8');
