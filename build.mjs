import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(root,'dist');
if(out!==path.join(root,'dist')||!fs.existsSync(path.join(root,'index.html')))throw Error('Invalid output root');
// Only the verified generated dist directory can be replaced.
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const names=new Map();
for(const name of fs.readdirSync(path.join(root,'assets')).filter(n=>n.endsWith('.webp'))){
 const bytes=fs.readFileSync(path.join(root,'assets',name)),hash=createHash('sha256').update(bytes).digest('hex').slice(0,12),hashed=name.replace('.webp',`.${hash}.webp`);
 names.set(name,hashed);fs.writeFileSync(path.join(out,'assets',hashed),bytes);
}
for(const name of fs.readdirSync(root).filter(n=>/\.(html|css|js)$/.test(n))){
 let source=fs.readFileSync(path.join(root,name),'utf8');for(const [from,to] of names)source=source.replaceAll(from,to);
 fs.writeFileSync(path.join(out,name),source);
}
fs.cpSync(path.join(root,'vendor'),path.join(out,'vendor'),{recursive:true});
fs.copyFileSync(path.join(root,'_headers'),path.join(out,'_headers'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Static site ready in dist/ (versioned lossless assets; no legacy PNGs, source history, or test fixtures).');
