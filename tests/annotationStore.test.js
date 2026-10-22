const test = require('node:test');
const assert = require('node:assert/strict');
const {createStore, storageKey, MAX_NOTES} = require('../judgeman_v4/src/annotationStore.js');

function setup() {
  const values={}; let rejectWrites=false;
  const storage={
    async get(key) {await new Promise(resolve=>setTimeout(resolve,1));return structuredClone(key===null?values:{[key]:values[key]});},
    async set(items) {if(rejectWrites)throw new Error('synthetic quota');Object.assign(values,structuredClone(items));},
    async remove(key) {delete values[key];},
  };
  return {values,storage,broker:createStore(storage),failWrites:()=>{rejectWrites=true;}};
}

test('concurrent add requests retain all distinct notes; a restarted broker reads native persisted data', async () => {
  const {storage,broker}=setup();
  const notes=await Promise.all(Array.from({length:40},(_,i)=>broker.dispatch({action:'add',caseKey:'Synthetic/⚖️',text:`Synthetic ${i}`})));
  assert.equal(new Set(notes.map(n=>n.id)).size,40);
  const restarted=createStore(storage);
  const loaded=await restarted.dispatch({action:'load',caseKey:'Synthetic/⚖️'});
  assert.deepEqual(loaded.map(n=>n.text),Array.from({length:40},(_,i)=>`Synthetic ${i}`));
});

test('exact case identities cannot collide through punctuation replacement', async () => {
  const {broker}=setup();
  await broker.dispatch({action:'add',caseKey:'HC:A',text:'A'});
  await broker.dispatch({action:'add',caseKey:'HC?A',text:'B'});
  assert.equal((await broker.dispatch({action:'load',caseKey:'HC:A'}))[0].text,'A');
  assert.equal((await broker.dispatch({action:'load',caseKey:'HC?A'}))[0].text,'B');
});

test('storage failures reject writes and do not report a fabricated saved entry', async () => {
  const {broker,failWrites}=setup();
  await broker.dispatch({action:'add',caseKey:'S',text:'original'});failWrites();
  await assert.rejects(broker.dispatch({action:'add',caseKey:'S',text:'not saved'}),/quota/);
  assert.deepEqual((await broker.dispatch({action:'load',caseKey:'S'})).map(n=>n.text),['original']);
});

test('malformed stored records fail visibly and are retained without overwrite', async () => {
  for(const value of [null,42,[],{}, {schemaVersion:2,caseKey:'S',annotations:[42]},
    {schemaVersion:2,caseKey:'wrong',annotations:[]}]) {
    const {values,broker}=setup();values[storageKey('S')]=value;
    await assert.rejects(broker.dispatch({action:'load',caseKey:'S'}),/invalid/);
    await assert.rejects(broker.dispatch({action:'add',caseKey:'S',text:'new'}),/invalid/);
    assert.deepEqual(values[storageKey('S')],value);
  }
});

test('empty, exact-limit, oversize and non-string inputs have independent outcomes', async () => {
  const {broker}=setup();
  assert.equal(await broker.dispatch({action:'add',caseKey:'S',text:' '}),null);
  assert.equal(await broker.dispatch({action:'add',caseKey:'S',text:42}),null);
  assert.equal((await broker.dispatch({action:'add',caseKey:'S',text:'x'.repeat(8000)})).text.length,8000);
  await assert.rejects(broker.dispatch({action:'add',caseKey:'S',text:'x'.repeat(8001)}),/8000/);
  assert.equal((await broker.dispatch({action:'load',caseKey:'S'})).length,1);
});

test('the documented case count limit rejects the next write and retains existing notes', async () => {
  const {broker}=setup();
  const notes=Array.from({length:MAX_NOTES},(_,i)=>({id:`synthetic-${i}`,text:`Note ${i}`,paragraphRef:null,createdAt:'2026-01-01T00:00:00Z'}));
  await broker.dispatch({action:'save',caseKey:'S',annotations:notes});
  await assert.rejects(broker.dispatch({action:'add',caseKey:'S',text:'too many'}),/500/);
  assert.equal((await broker.dispatch({action:'load',caseKey:'S'})).length,500);
});
