const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Safari sync adds every extension script to the actual Xcode resource phase and is idempotent',async()=>{
  const {syncResourceReferences}=await import('../scripts/safari-resource-references.mjs');
  const original=fs.readFileSync(path.join(__dirname,'fixtures/safari-project.pbxproj'),'utf8');
  const files=['annotationStore.js','background.js','panelStyles.js','logger.js','annotations.js','contentApp.js','popup.html'];
  const updated=syncResourceReferences(original,files);
  assert.equal(syncResourceReferences(updated,files),updated);
  for(const file of files){
    const refLines=updated.split('\n').filter(line=>line.includes('isa = PBXFileReference;')&&line.includes(`path = Resources/${file};`));
    assert.equal(refLines.length,1,file);
    const ref=refLines[0].trim().split(' ')[0];
    const buildLine=updated.split('\n').find(line=>line.includes('isa = PBXBuildFile;')&&line.includes(`fileRef = ${ref} `));
    assert(buildLine,file);const build=buildLine.trim().split(' ')[0];
    const phases=[...updated.matchAll(/isa = PBXResourcesBuildPhase;[\s\S]*?\n\t\t\};/g)];
    assert(phases.some(phase=>phase[0].includes(`${build} /* ${file} in Resources */`)),file);
  }
});
