import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {raceSummary} from '../turbo-tables.js';
import {Progress,QuestionBank,LEVELS} from '../turbo-tables/js/maths.js';
const root=new URL('../',import.meta.url);
test('race results are validated before entering learner history',()=>{
 assert.equal(raceSummary({asked:4,correct:5,time:10}),null);assert.equal(raceSummary({asked:4,correct:2,time:NaN}),null);
 assert.deepEqual(raceSummary({asked:4,correct:3,time:120,rank:2,track:'meadow',classLevel:3}),{questions:4,correct:3,durationSeconds:120,rank:2,track:'meadow',classLevel:3});
});
test('maths memory is separate for learners even when names match, and returns updates to the host',()=>{
 let saved;const a=new Progress('same',{facts:{},history:[]},value=>saved=value),b=new Progress('same',{facts:{},history:[]},()=>{});
 a.record({key:'2x3'},false);assert.equal(a.facts['2x3'].wrong,1);assert.equal(saved.facts['2x3'].seen,1);assert.equal(b.facts['2x3'],undefined);
});
test('all imported class question banks generate correct distinct answer choices',()=>{
 for(const level of LEVELS){const bank=new QuestionBank(level,level.ops,new Progress('',{facts:{},history:[]},()=>{}));for(let i=0;i<300;i++){const q=bank.next();const expected={add:()=>q.a+q.b,sub:()=>q.a-q.b,mul:()=>q.a*q.b,div:()=>q.a/q.b}[q.op]();assert.equal(q.answer,expected);assert.equal(new Set(q.options).size,3);assert.equal(q.options[q.correctIndex],q.answer);}}
});
test('embedded messages require matching source, origin and session; results deduplicate and cleanup removes listeners',()=>{
 const listeners={},sent=[],parts={};let saves=0,finishes=0,closes=0;
 const frame={contentWindow:{postMessage:(m,origin)=>sent.push({m,origin})}},dialog={setAttribute(){},querySelector:s=>s==='iframe'?frame:(parts[s]||={}),addEventListener:(n,fn)=>listeners['dialog:'+n]=fn,remove(){},showModal(){},close(){listeners['dialog:close']();}};
 const h={document:{createElement:()=>dialog,body:{appendChild(){}}},window:{addEventListener:(n,fn)=>listeners[n]=fn,removeEventListener:n=>delete listeners[n]},URL,location:{origin:'https://app.test',href:'https://app.test/'},crypto:{randomUUID:()=> 'session'}};
 const source=fs.readFileSync(new URL('../turbo-tables.js',import.meta.url),'utf8').replaceAll('export function','function');vm.createContext(h);vm.runInContext(source,h);
 const learner={name:'Same name',classLevel:2};h.openTurboTables(learner,{save:()=>saves++,complete:()=>finishes++,close:()=>closes++});
 const message=(type,data,overrides={})=>listeners.message({source:frame.contentWindow,origin:'https://app.test',data:{source:'turbo-tables',token:'session',type,data},...overrides});
 message('ready',null,{origin:'https://bad.test'});message('ready',null,{source:{}});assert.equal(sent.length,0);message('ready');assert.equal(sent[0].m.data.name,'Same name');assert.equal(sent[0].m.data.classLevel,2);assert.equal(sent[0].m.data.avatar,'https://app.test/assets/avatars/fox.png');
 assert.equal(h.racerPortrait({avatarId:8}),'https://app.test/assets/avatars/badger.png');assert.equal(h.racerPortrait({photo:'data:image/png;base64,YQ=='}),'data:image/png;base64,YQ==');assert.equal(h.racerPortrait({photo:'javascript:alert(1)'}),'https://app.test/assets/avatars/fox.png');
 const result={runId:'run',asked:5,correct:4,time:80,rank:2,track:'meadow',classLevel:2};message('complete',result);message('complete',result);assert.equal(finishes,1);assert.equal(learner.turboTables.races,1);assert.equal(saves,1);dialog.close();assert.equal(listeners.message,undefined);assert.equal(frame.src,'about:blank');assert.equal(closes,1);
});
test('all transitive game imports are cached offline and the external font dependency is removed',()=>{
 const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),seen=new Set();
 function visit(name){if(seen.has(name))return;seen.add(name);assert.ok(sw.includes(`"./${name}"`),name+' is missing from app shell');const src=fs.readFileSync(new URL(name,root),'utf8');for(const m of src.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)){const n=m[1];if(n.startsWith('.'))visit(path.posix.normalize(path.posix.join(path.posix.dirname(name),n)));else if(n==='three')visit('turbo-tables/vendor/three/build/three.module.min.js');else if(n.startsWith('three/addons/'))visit(n.replace('three/addons/','turbo-tables/vendor/three/examples/jsm/'));}}
 visit('turbo-tables/js/main.js');assert.ok(seen.size>20);assert.doesNotMatch(fs.readFileSync(new URL('../turbo-tables/index.html',import.meta.url),'utf8'),/https?:\/\//);
 const adventure=fs.readFileSync(new URL('../adventure.js',import.meta.url),'utf8');assert.match(adventure,/renderHome\(l,save\);tablesTile\(l,save\);/);assert.doesNotMatch(adventure,/renderHome\(l,save\);racerTile/);
});
test('old standalone links return to Maths Quest to select a learner instead of collecting another name',()=>{
 let destination;const window={};window.parent=window;
 const source=fs.readFileSync(new URL('../turbo-tables/js/host.js',import.meta.url),'utf8').replaceAll('export function','function').replaceAll('export const','const');
 vm.runInNewContext('(async()=>{'+source+'})()',{window,location:{search:'',href:'https://app.test/turbo-tables/index.html',replace:url=>destination=url},URL,URLSearchParams});
 assert.equal(destination,'https://app.test/?game=turbo-tables');
});
test('a requested racer opens once after learner selection and consumes only its own URL parameter',()=>{
 const source=fs.readFileSync(new URL('../adventure.js',import.meta.url),'utf8'),start=source.indexOf('function tablesTile(l,save){'),end=source.indexOf('window.questAdventure=',start);
 let opens=0,replaced;const jobs=[];
 const document={getElementById:id=>id==='beatButton'?{before(){}}:null,createElement:()=>({click(){opens++;}})};
 vm.runInNewContext('let miniActive=false,requestedTurboTables=true;'+source.slice(start,end)+'tablesTile({},()=>{});tablesTile({},()=>{});',{
  document,location:{href:'https://app.test/?qa=1&game=turbo-tables'},URL,history:{state:null,replaceState:(_state,_title,url)=>replaced=String(url)},queueMicrotask:fn=>jobs.push(fn)
 });
 assert.equal(jobs.length,1);jobs[0]();assert.equal(opens,1);assert.equal(replaced,'https://app.test/?qa=1');
});
