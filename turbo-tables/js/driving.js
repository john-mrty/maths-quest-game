// Driving behaviour follows class automatically, without another setup choice.
export const DRIVING = {
  relaxed: { name: 'Relaxed', speed: 0.82, guidance: 0.3, edgeHelp: 0.35, steering: 0.85, pace: 0.86, skill: 0.68 },
  progressing: { name: 'Progressing', speed: 0.96, guidance: 0.1, edgeHelp: 0.15, steering: 0.97, pace: 1.03, skill: 0.9 },
  challenging: { name: 'Challenging', speed: 1, guidance: 0, edgeHelp: 0, steering: 1, pace: 1.06, skill: 0.94 },
};
export function drivingDefault(level) { return level <= 2 ? 'relaxed' : level === 3 ? 'progressing' : 'challenging'; }
export function drivingChoice(setup) { return drivingDefault(setup.levelId); }
export function itemAction(id) { return ({ball:'Shoot',jelly:'Drop',rocket:'Boost',bubble:'Protect'})[id] || 'Use'; }
