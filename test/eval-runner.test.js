import { execFile } from 'child_process';
import { promisify } from 'util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('extraction eval runner', () => {
  it('prints per-tag metrics and passes the macro F1 gate', async () => {
    const { stdout } = await execFileAsync('node', ['tools/eval/run.mjs'], {
      cwd: process.cwd()
    });
    const match = stdout.match(/macro_f1=(\d+\.\d+)/);

    expect(stdout).toContain('tag\tprecision\trecall\tf1');
    expect(match).toBeTruthy();
    expect(Number(match[1])).toBeGreaterThanOrEqual(0.6);
  });
});
