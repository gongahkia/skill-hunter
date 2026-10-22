const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');

test('source packaging is reproducible and validation failure preserves successful outputs',()=>{
  const root=path.resolve(__dirname,'..');
  const cache=path.join(root,'node_modules','.cache');fs.mkdirSync(cache,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(cache,'judgeman-package-test-'));
  try {
    for(const entry of ['scripts','judgeman_v4','tests','Makefile','package.json','package-lock.json','README.md'])fs.cpSync(path.join(root,entry),path.join(fixture,entry),{recursive:true});
    const output=path.join(fixture,'artifacts');fs.mkdirSync(output);fs.writeFileSync(path.join(output,'keep-existing.txt'),'existing independent artifact');
    const options={cwd:fixture,env:{...process.env,JUDGEMAN_SUBMISSION_DIR:output,JUDGEMAN_TEMP_DIR:path.join(fixture,'tmp')},encoding:'utf8',timeout:20000};
    const first=spawnSync(process.execPath,['scripts/package-firefox-submission.mjs'],options);
    assert.equal(first.status,0,first.stderr);
    const archive=path.join(output,'judgeman-firefox-source-4.1.0.zip');
    const contents=spawnSync('unzip',['-Z1',archive],{encoding:'utf8'});
    assert.equal(contents.status,0);assert(contents.stdout.includes('judgeman_v4/src/annotationStore.js'));
    assert(contents.stdout.includes('tests/preservation.test.js'));assert(contents.stdout.includes('package-lock.json'));
    const before=Object.fromEntries(fs.readdirSync(output).map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex')]));
    fs.rmSync(path.join(fixture,'tests'),{recursive:true});
    const failed=spawnSync(process.execPath,['scripts/package-firefox-submission.mjs'],options);
    assert.notEqual(failed.status,0);assert.match(failed.stderr,/Missing required source path.*tests/);
    const after=Object.fromEntries(fs.readdirSync(output).map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex')]));
    assert.deepEqual(after,before);
  } finally {fs.rmSync(fixture,{recursive:true,force:true});}
});
