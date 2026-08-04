/* ═══════════════════════════════════════════════════════════════════════
   Détection de visage — implémentation UNIQUE, partagée par tous les modes.

   Pourquoi séparée de la silhouette : ce ne sont pas les mêmes situations.
   La silhouette veut un CORPS entier — tête, épaules, hanches — et rate donc
   un visage seul dans un miroir, à une fenêtre, ou dans l'entrebâillement
   d'une porte. Le visage, lui, se voit à partir de quelques dizaines de
   pixels et sans le reste du corps. Les deux se complètent, ils ne se
   remplacent pas : on peut les allumer ensemble.

   ── Le piège, et il est SÉRIEUX ici ──
   La paréidolie — voir un visage dans une tache, un rideau, une prise
   électrique — est le biais le plus puissant de ce loisir, et un détecteur
   de visage laissé à ses réglages d'usine en fabrique à la chaîne. Les
   seuils sont donc volontairement sévères, et un visage n'est affiché
   qu'après plusieurs images consécutives au même endroit. Mieux vaut manquer
   un vrai visage que d'en inventer un : c'est la règle du projet, et elle
   vaut doublement ici.

   Le modèle tourne sur l'appareil. Rien n'est envoyé nulle part.

   Usage :
     const V = await import('/ghost-box/lib/visage.js');
     await V.load();
     const r = V.detect(videoElement);      // {faces:[...], count} ou null
     if (r && r.count) V.drawAll(ctx, r.faces, W, H);
   ═══════════════════════════════════════════════════════════════════════ */

/* ── seuils sévères, pour les raisons ci-dessus ── */
export const CONF_MIN   = 0.72;   // confiance du modèle (défaut usine : 0,5)
export const MIN_STREAK = 5;      // images consécutives avant d'afficher
export const MIN_TAILLE = 0.045;  // 4,5 % de la hauteur d'image au minimum
export const MAX_VISAGES = 6;
/* tolérance de suivi entre deux images : un vrai visage ne saute pas d'un
   bord à l'autre en 40 ms. Un faux positif, si. */
const DERIVE_MAX = 0.12;

export const COULEUR = '#7FB2E5';

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/'
            + 'blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let detecteur = null, chargement = null;
let streak = 0, dernier = null, lastWhy = '';

export async function load(){
  if(detecteur) return detecteur;
  if(chargement) return chargement;
  chargement = (async () => {
    const vision = await import(CDN + '/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
    detecteur = await vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: 'VIDEO',
      minDetectionConfidence: CONF_MIN
    });
    return detecteur;
  })();
  try { return await chargement; } finally { chargement = null; }
}

export function ready(){ return !!detecteur; }
export function why(){ return lastWhy; }
export function stats(){ return { streak: streak, why: lastWhy }; }

/** Un visage détecté est-il crédible ? Taille, confiance, et stabilité. */
function juger(d, H){
  const bb = d.boundingBox;
  if(!bb) return false;
  const conf = (d.categories && d.categories[0] && d.categories[0].score) || 0;
  if(conf < CONF_MIN){ lastWhy = 'confiance trop faible'; return false; }
  if(bb.height / H < MIN_TAILLE){ lastWhy = 'trop petit pour être sûr'; return false; }
  // un visage a des proportions : ni un trait, ni un carré démesuré
  const ratio = bb.width / Math.max(1, bb.height);
  if(ratio < 0.55 || ratio > 1.7){ lastWhy = 'proportions non humaines'; return false; }
  return true;
}

export function detect(video, ts){
  if(!detecteur || !video || !video.videoWidth) return null;
  let res;
  try{ res = detecteur.detectForVideo(video, ts || performance.now()); }
  catch(e){ return null; }
  const H = video.videoHeight, W = video.videoWidth;
  const bruts = (res && res.detections) ? res.detections : [];

  const gardes = bruts.filter(d => juger(d, H)).slice(0, MAX_VISAGES).map(d => ({
    x: d.boundingBox.originX / W,
    y: d.boundingBox.originY / H,
    w: d.boundingBox.width / W,
    h: d.boundingBox.height / H,
    conf: (d.categories && d.categories[0] && d.categories[0].score) || 0
  }));

  /* ── persistance : un visage doit RESTER au même endroit ──
     Sans cela, une tache qui « passe » pour un visage une image sur vingt
     ferait clignoter un cadre, et l'œil humain, lui, y verrait un visage. */
  if(!gardes.length){
    streak = 0; dernier = null;
    if(!lastWhy) lastWhy = 'aucun visage';
    return { faces: [], count: 0, streak: 0 };
  }
  const p = gardes[0];
  if(dernier && Math.abs(p.x - dernier.x) < DERIVE_MAX && Math.abs(p.y - dernier.y) < DERIVE_MAX) streak++;
  else streak = 1;
  dernier = p;

  if(streak < MIN_STREAK){
    lastWhy = 'en cours de confirmation (' + streak + '/' + MIN_STREAK + ')';
    return { faces: [], count: 0, streak: streak };
  }
  lastWhy = '';
  return { faces: gardes, count: gardes.length, streak: streak };
}

/** Cadre + repère, sur des coordonnées normalisées (0-1). */
export function drawAll(g, faces, W, H){
  if(!faces || !faces.length) return;
  g.save();
  g.strokeStyle = COULEUR;
  g.lineWidth = Math.max(2, W/320);
  g.shadowColor = COULEUR; g.shadowBlur = 12;
  g.font = Math.max(11, W/38|0) + 'px "IBM Plex Mono",ui-monospace,monospace';
  faces.forEach((f, i) => {
    const x = f.x*W, y = f.y*H, w = f.w*W, h = f.h*H;
    // des coins plutôt qu'un rectangle plein : on garde le visage visible
    const c = Math.min(w, h) * 0.28;
    g.beginPath();
    g.moveTo(x, y+c);       g.lineTo(x, y);       g.lineTo(x+c, y);
    g.moveTo(x+w-c, y);     g.lineTo(x+w, y);     g.lineTo(x+w, y+c);
    g.moveTo(x+w, y+h-c);   g.lineTo(x+w, y+h);   g.lineTo(x+w-c, y+h);
    g.moveTo(x+c, y+h);     g.lineTo(x, y+h);     g.lineTo(x, y+h-c);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = COULEUR;
    g.fillText('visage ' + Math.round(f.conf*100) + '%', x, Math.max(12, y - 6));
    g.shadowBlur = 12;
  });
  g.restore();
}
