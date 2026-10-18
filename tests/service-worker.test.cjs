const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
function fixture(){
  const handlers={},writes=[];
  vm.runInNewContext(source,{URL,Set,Promise,self:{location:{origin:'https://app.test',href:'https://app.test/sw.js'},
    addEventListener:(event,handler)=>handlers[event]=handler},
    caches:{open:async()=>({put:(key)=>writes.push(key)}),match:async()=>null},
    fetch:async()=>({ok:true,clone:()=>({})})});
  return {handlers,writes};
}
test('private cross-origin API and photo requests bypass the app cache',()=>{
  const f=fixture();let intercepted=false;
  f.handlers.fetch({request:{url:'https://project.supabase.co/storage/v1/object/profile-photos/private.jpg',method:'GET',mode:'cors'},respondWith:()=>intercepted=true});
  assert.equal(intercepted,false);
});
test('OAuth callback navigations bypass the cache',()=>{
  const f=fixture();let intercepted=false;
  f.handlers.fetch({request:{url:'https://app.test/?code=one-use-code',method:'GET',mode:'navigate'},respondWith:()=>intercepted=true});
  assert.equal(intercepted,false);
});
test('unknown same-origin pages cannot replace the offline app shell',()=>{
  const f=fixture();let intercepted=false;
  f.handlers.fetch({request:{url:'https://app.test/unknown-page',method:'GET',mode:'navigate'},respondWith:()=>intercepted=true});
  assert.equal(intercepted,false);
});
test('normal app navigation still refreshes the offline shell',async()=>{
  const f=fixture();let response;
  f.handlers.fetch({request:{url:'https://app.test/',method:'GET',mode:'navigate'},respondWith:value=>response=value});
  await response;assert.deepEqual(f.writes,['./index.html']);
});
test('embedded game navigation cannot replace the Maths Quest offline shell',async()=>{
 const f=fixture();let response;
 f.handlers.fetch({request:{url:'https://app.test/turbo-tables/index.html?embedded=1&token=session',method:'GET',mode:'navigate'},respondWith:value=>response=value});
 await response;assert.deepEqual(f.writes,['./turbo-tables/index.html']);
});
