import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveGraphics} from '../turbo-tables/js/graphics.js';
const run = (g, seconds, fps, active = true) => {
 let changed = null;
 for (let i = 0; i < seconds * fps; i++) changed = g.sample(1 / fps, active) || changed;
 return changed;
};
const storage = () => { let value; return { getItem: () => value, setItem: (_k, v) => { value = v; } }; };
test('device hints provide conservative defaults without requiring hardware APIs', () => {
 assert.equal(new AdaptiveGraphics().quality, 'high');
 assert.equal(new AdaptiveGraphics({touch:true}).quality, 'medium');
 assert.equal(new AdaptiveGraphics({cores:2}).quality, 'low');
 assert.equal(new AdaptiveGraphics({memory:4}).quality, 'medium');
});
test('sustained poor performance steps down twice, isolated stalls do not', () => {
 const g = new AdaptiveGraphics();
 run(g, 4, 60); g.sample(0.4); run(g, 4, 60); assert.equal(g.quality, 'high');
 assert.equal(run(g, 10, 30), 'medium');
 assert.equal(run(g, 12, 25), 'low');
 assert.equal(run(g, 20, 15), null);
});
test('raw frame times detect very slow devices; inactive time and return frames are ignored', () => {
 const g = new AdaptiveGraphics();
 run(g, 30, 5, false); assert.equal(g.quality, 'high');
 assert.equal(g.sample(10), null);
 assert.equal(run(g, 12, 5), 'medium');
});
test('saved levels survive restart, stale or malformed records and denied storage are safe', () => {
 const disk = storage(), g = new AdaptiveGraphics({storage:disk});
 run(g, 12, 30);
 assert.equal(new AdaptiveGraphics({storage:disk}).quality, 'medium');
 assert.equal(new AdaptiveGraphics({storage:disk, now:Date.now()+8*86400000}).quality, 'high');
 disk.setItem('', '{broken'); assert.equal(new AdaptiveGraphics({storage:disk}).quality, 'high');
 const denied = {getItem(){throw Error();}, setItem(){throw Error();}};
 const other = new AdaptiveGraphics({storage:denied}); assert.equal(other.recover(), 'low');
});
test('upgrades wait for the next race and context recovery chooses light graphics', () => {
 const g = new AdaptiveGraphics({touch:true});
 run(g, 48, 60); assert.equal(g.quality, 'medium');
 run(g, 2, 60, false);
 assert.equal(g.beginRace(), 'high');
 assert.equal(g.recover(), 'low'); assert.equal(g.beginRace(), 'low');
});
