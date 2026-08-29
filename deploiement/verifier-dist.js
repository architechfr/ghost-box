/* ═══════════════════════════════════════════════════════════════════════
   verifier-dist.js — controle ce qui part vraiment en ligne.

   Le site a change d'origine (github.io -> Cloudflare). Une seule ressource
   manquante ne se verrait qu'en cave, hors reseau, au moment ou on ne peut
   plus rien y faire. On verifie donc sur dist/, l'arborescence exacte servie.

   Verifie : syntaxe de tous les scripts, existence de toute ressource citee
   par les pages, coherence de l'ENVELOPPE du service worker, et adresses
   gravees en dur qui ne correspondraient plus au lieu ou le site est servi.

   Usage : node deploiement/preparer-cf.js && node deploiement/verifier-dist.js
   ═══════════════════════════════════════════════════════════════════════ */

const fs=require('fs'), path=require('path'), cp=require('child_process');
const DIST=path.resolve(__dirname,'..','dist');
const SITE=path.join(DIST,'ghost-box');
let defauts=0;
const dire=(t,m)=>{ if(t==='X') defauts++; console.log((t==='X'?'  DEFAUT  ':'  ok      ')+m); };

function tous(d,ext,acc=[]){
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p=path.join(d,e.name);
    if(e.isDirectory()) tous(p,ext,acc); else if(p.endsWith(ext)) acc.push(p);
  }
  return acc;
}

/* 1. syntaxe */
console.log('\n1. Syntaxe des scripts');
let mauvais=0;
for(const f of tous(SITE,'.js')){
  try{ cp.execSync(`node --check "${f}"`,{stdio:'pipe'}); }
  catch(e){ dire('X',path.relative(SITE,f)+' : '+String(e.stderr).split('\n')[1]); mauvais++; }
}
if(!mauvais) dire('.',tous(SITE,'.js').length+' scripts, aucun defaut de syntaxe');

/* 2. ressources citees par les pages */
console.log('\n2. Ressources citees par les pages');
const CITE=/(?:src|href)\s*=\s*["']([^"']+)["']/g;
let manquantes=0, verifiees=0;
for(const f of tous(SITE,'.html')){
  const html=fs.readFileSync(f,'utf8');
  for(const m of html.matchAll(CITE)){
    let u=m[1].trim();
    if(/^(https?:|mailto:|tel:|data:|blob:|javascript:|#)/i.test(u)) continue;
    u=u.split('#')[0].split('?')[0];
    if(!u) continue;
    const cible = u.startsWith('/ghost-box/') ? path.join(SITE,u.slice('/ghost-box/'.length))
                : u.startsWith('/')           ? path.join(DIST,u.slice(1))
                : path.resolve(path.dirname(f),u);
    verifiees++;
    const ok = fs.existsSync(cible) || fs.existsSync(path.join(cible,'index.html'));
    if(!ok){ dire('X',path.relative(SITE,f)+' cite '+m[1]+' -> introuvable'); manquantes++; }
  }
}
if(!manquantes) dire('.',verifiees+' ressources citees, toutes presentes');

/* 3. enveloppe du service worker — on EVALUE le tableau (il est fait de
      concatenations et de .map : le lire au motif ne donnerait rien de juste) */
console.log('\n3. Enveloppe du service worker');
const sw=fs.readFileSync(path.join(SITE,'sw.js'),'utf8');
const version=(sw.match(/const VERSION\s*=\s*'([^']+)'/)||[,'?'])[1];
const racine=(sw.match(/const RACINE\s*=\s*'([^']+)'/)||[,'/ghost-box/'])[1];
const d=sw.indexOf('const ENVELOPPE'); const o=sw.indexOf('[',d); const f=sw.indexOf('\n];',o);
let entrees=[];
try{ entrees=new Function('RACINE','VERSION','return '+sw.slice(o,f+2))(racine,version); }
catch(e){ dire('X','ENVELOPPE illisible : '+e.message); }
let absentes=0;
for(const u of entrees.filter(u=>typeof u==='string' && !/^https?:/.test(u))){
  const rel=u.replace(new RegExp('^'+racine),'').split('?')[0];
  const cible=rel===''?path.join(SITE,'index.html'):path.join(SITE,rel);
  if(!(fs.existsSync(cible)||fs.existsSync(path.join(cible,'index.html')))){ dire('X','ENVELOPPE promet '+u+' : absent de dist/'); absentes++; }
}
if(!absentes) dire('.',entrees.length+' entrees d\'ENVELOPPE, toutes presentes (site en '+version+')');

/* 4. adresses gravees en dur — une adresse d'hebergement ecrite en dur
      survit aux demenagements et envoie les gens sur un site mort. Seule
      exception admise : le repli explicite marque URL_SECOURS. */
console.log('\n4. Adresses gravees en dur');
let dures=0;
for(const f of [...tous(SITE,'.html'),...tous(SITE,'.js'),...tous(SITE,'.json')]){
  for(const ligne of fs.readFileSync(f,'utf8').split('\n')){
    if(ligne.includes('URL_SECOURS')) continue;
    for(const m of ligne.matchAll(/https?:\/\/[a-zA-Z0-9._-]*(github\.io|pages\.dev|workers\.dev)[^\s'"]*/g)){
      dire('X',path.relative(SITE,f)+' : '+m[0]); dures++;
    }
  }
}
if(!dures) dire('.','aucune adresse d\'hebergement gravee en dur (hors repli explicite)');

/* 4 bis. rien d'interne ne doit partir en ligne */
console.log('\n4 bis. Ce qui ne doit pas etre publie');
const INTERDITS=['.wrangler','wrangler.toml','.git','.claude','node_modules','CLAUDE.md','.env'];
let fuites=0;
(function balayer(d){
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    if(INTERDITS.includes(e.name)){ dire('X','publie : '+path.relative(DIST,path.join(d,e.name))); fuites++; continue; }
    if(e.isDirectory()) balayer(path.join(d,e.name));
  }
})(DIST);
if(!fuites) dire('.','aucun fichier d\'outillage dans dist/');

/* 5. coherence des ?v=N */
console.log('\n5. Discipline des ?v=N');
const n=version.replace(/^v/,'');
const mauvaisV=new Set();
for(const f of tous(SITE,'.html')){
  for(const m of fs.readFileSync(f,'utf8').matchAll(/\?v=(\d+)/g)) if(m[1]!==n) mauvaisV.add(path.relative(SITE,f)+' : ?v='+m[1]);
}
if(mauvaisV.size){ for(const s of mauvaisV) dire('X',s+' alors que sw.js est en '+version); }
else dire('.','tous les ?v= sont a '+n);

console.log('\n'+(defauts?'>>> '+defauts+' DEFAUT(S)':'>>> tout est sain')+'\n');
process.exit(defauts?1:0);
