import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const source = path.resolve(process.argv[2] || '../../work/rules');
const dest = path.resolve('data.json');
const groups = ['FSAE_Rules_2027_V1', 'FSAE_Driverless_2027_V1'];
const docs = [];
for (const group of groups) {
  for (const file of fs.readdirSync(path.join(source, group))) {
    if (!file.endsWith('.md') || file.startsWith('Formula_SAE_Driverless_Implementation')) continue;
    const body = fs.readFileSync(path.join(source, group, file), 'utf8');
    const prefix = file.startsWith('00') ? (group.includes('Driverless') ? 'D0' : '00') : file.split(' - ')[0];
    const name = file.replace(/\.md$/, '').replace(/^[^-]+ - /, '');
    docs.push({ id: prefix, title: name, path: `${group}/${file}`, group: group.includes('Driverless') ? 'driverless' : 'main', markdown: body });
  }
}
const order = ['00','GR','AD','PS','V','F','T','VE','IC','EV','IN','S','D','D0','DA','DT','DO','DI','DS','DD'];
docs.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
const sha = execFileSync('git', ['-C',source,'rev-parse','HEAD'], {encoding:'utf8'}).trim();
const data = { repo:'ppmend/FSAE_RULES_2027', branch:'main', sha, fetchedAt:new Date().toISOString(), docs };
fs.writeFileSync(dest, JSON.stringify(data));
console.log(`Wrote ${docs.length} sections from ${sha.slice(0, 7)} to ${dest}`);
