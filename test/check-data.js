global.window={};require('../data.js');const D=window.TP_DATA;let have=' ';let bad=0;
for(const z of D.ZONES){for(const m of z.missions){have+=m.keys;for(const l of m.lines)for(const ch of l)if(!have.includes(ch)){console.log('BAD',m.id,JSON.stringify(ch),l);bad++}}
 have+=z.newKeys;for(const l of z.boss.lines)for(const ch of l)if(!have.includes(ch)){console.log('BAD boss',z.id,ch);bad++}}
const L=Object.keys(D.LETTERS);console.log('letters',L.length,'order',new Set(D.ORDER).size,'mission-text key violations:',bad);
process.exit(bad ? 1 : 0);
