const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('Turbo Trail tile displays the selected learner’s personal best, including new learners',()=>{
 const source=fs.readFileSync(new URL('../adventure.js',`file://${__filename}`),'utf8');
 const start=source.indexOf('function racerTile(l,save){'),end=source.indexOf(' b.onclick=async',start);
 function label(l){let record;const copy={appendChild(node){record=node}},button={querySelector:()=>copy};const document={getElementById:()=>null,createElement:tag=>tag==='button'?button:{}};vm.runInNewContext(source.slice(start,end)+'\n}\nracerTile(l,()=>{});',{document,l});return record.textContent;}
 assert.equal(label({turboBest:7,turboLongestSeconds:125}),'Personal best: 7 sums · Longest race: 2:05');
 assert.equal(label({turboBest:1}),'Personal best: 1 sum · Longest race: 0:00');
 assert.equal(label({}),'Personal best: 0 sums · Longest race: 0:00');
 assert.equal(label({turboBest:3,turboLongestSeconds:64}),'Personal best: 3 sums · Longest race: 1:04');
});
test('longest race saves per learner without a shorter race replacing it',()=>{
 const source=fs.readFileSync(new URL('../adventure.js',`file://${__filename}`),'utf8');
 const start=source.indexOf('complete:({questions,correct,independent,helped,best,durationSeconds'),end=source.indexOf('});}catch',start);
 const callback=source.slice(start+'complete:'.length,end);
 const learner=()=>({sessions:0,totalAttempts:0,totalCorrect:0,helped:0,completedResults:[]});
 const a=learner(),b=learner();function finish(l,durationSeconds){const h={l,award:()=>null,save(){},crypto:{randomUUID:()=> 'test'},Date};vm.createContext(h);vm.runInContext('complete='+callback,h);h.complete({questions:3,correct:0,independent:0,helped:0,best:0,durationSeconds});}
 finish(a,130);finish(a,60);finish(b,25);assert.equal(a.turboLongestSeconds,130);assert.equal(b.turboLongestSeconds,25);assert.equal(a.completedResults[1].durationSeconds,60);
});
function api(){const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../adventure.js',`file://${__filename}`),'utf8'),context);return context.window.questAdventure}
test('partial rounds earn no decoration or world progress',()=>{const a=api(),l={};assert.equal(a.award(l,{index:4,total:8}),null);assert.equal(l.adventure,undefined)});
test('full rounds earn unique decorations, including rounds completed with help',()=>{const a=api(),l={};for(let i=0;i<12;i++)a.award(l,{index:8,total:8,correct:2,helped:6});assert.equal(l.adventure.unlocked.length,9);assert.equal(new Set(l.adventure.unlocked).size,9);assert.equal(l.adventure.placed.length,5);assert.equal(l.adventure.rounds,12)});
test('invalid stored decorations and destinations are repaired',()=>{const a=api(),l={adventure:{destination:'unknown',unlocked:['tree','tree','bad'],placed:['bad','rocket','tree'],rounds:-3}};a.state(l);assert.equal(l.adventure.destination,'meadow');assert.equal(l.adventure.unlocked.join(','),'tree');assert.equal(l.adventure.placed.join(','),'tree');assert.equal(l.adventure.rounds,0)});
test('rerendering preserves selection references and serialised progress',()=>{const a=api(),l={};const first=a.state(l);a.state(l);first.destination='harbour';a.award(l,{index:3,total:3});const restored=JSON.parse(JSON.stringify(l));a.state(restored);assert.equal(restored.adventure.destination,'harbour');assert.equal(restored.adventure.unlocked[0],'tree');assert.equal(restored.adventure.rounds,1)});
