/* ═══════════════════════════════════════════════════════════════════════
   Détection de personne — implémentation UNIQUE, partagée par tous les
   modes caméra de l'application (règle de base du projet).

   Trois garanties, non négociables :
   1. PLUSIEURS personnes sont suivies en même temps, chacune avec son
      propre squelette et sa propre couleur. Jamais « la première seulement ».
   2. Un squelette n'est tracé QUE si une personne est réellement détectée
      (assez de points fiables). Jamais de forme inventée à partir d'une
      simple zone de mouvement.
   3. Le modèle tourne sur l'appareil. Rien n'est envoyé nulle part.

   Usage :
     const P = await import('/ghost-box/lib/pose.js');
     await P.load();                      // charge le modèle (~5 Mo, une fois)
     const r = P.detect(videoElement);    // {people:[...], count} ou null
     if (r && r.count) P.drawAll(ctx, r.people, W, H, scale);
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Seuils volontairement SÉVÈRES ──
   Le modèle, laissé à ses valeurs par défaut, plaque un squelette sur à peu
   près n'importe quoi (fauteuil, rideau, ombre). Mieux vaut manquer une
   personne que d'en inventer une : c'est la règle du projet. */
export const VIS = 0.5;         // confiance minimale d'un point articulaire
export const MIN_POINTS = 10;   // points fiables exigés (sur 33) pour parler de « personne »
export const MIN_MEAN = 0.50;   // confiance moyenne exigée
export const MAX_PEOPLE = 4;    // personnes suivies simultanément
export const MIN_STREAK = 4;    // images consécutives avant d'afficher quoi que ce soit
export const MIN_HEIGHT = 0.07; // 7 % de la hauteur d'image : une personne à ~8 m reste détectable
/* Réglage : l'essentiel du filtrage vient des seuils du MODÈLE (ci-dessous) et de
   la persistance, pas de critères manuels trop serrés. Une version antérieure
   exigeait 14 % de hauteur — elle rendait aveugle au-delà de 4 m. */
/* seuils internes du modèle : c'est ici que se joue l'essentiel des faux positifs */
const DETECTION_CONF = 0.80;
const PRESENCE_CONF  = 0.80;
const TRACKING_CONF  = 0.70;

/* une couleur d'os par personne, pour les distinguer d'un coup d'œil */
export const COLORS = ['#E9B44C', '#5FD3A6', '#7FB2E5', '#E58AC8'];

export const CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],
  [0,11],[0,12]
];

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/'
            + 'pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarker = null, loading = null;

/** Charge le modèle une seule fois. Lève une erreur si le réseau échoue. */
export async function load(){
  if(landmarker) return landmarker;
  if(loading) return loading;
  loading = (async () => {
    const vision = await import(CDN + '/vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
    landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: 'VIDEO',
      numPoses: MAX_PEOPLE,
      minPoseDetectionConfidence: DETECTION_CONF,
      minPosePresenceConfidence: PRESENCE_CONF,
      minTrackingConfidence: TRACKING_CONF
    });
    return landmarker;
  })();
  try { return await loading; } finally { loading = null; }
}

export function ready(){ return !!landmarker; }

/** Juge un squelette : assez de points fiables pour être une vraie personne ? */
function judge(lms){
  let sum = 0, count = 0, strong = 0;
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for(const p of lms){
    if(p.visibility == null) continue;
    sum += p.visibility; count++;
    if(p.visibility >= VIS){
      strong++;
      if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
      if(p.y < minY) minY = p.y; if(p.y > maxY) maxY = p.y;
    }
  }
  const mean = count ? sum / count : 0;
  const h = maxY - minY, w = maxX - minX;
  // une silhouette humaine est plus haute que large, et pas minuscule.
  // (on ne borne PAS le rapport vers le haut : de profil, bras le long du corps,
  //  une personne est très étroite — ça reste une personne.)
  const shapeOk = h >= MIN_HEIGHT && h > w * 0.8;
  return { ok: strong >= MIN_POINTS && mean >= MIN_MEAN && shapeOk,
           pct: Math.round(mean * 100), strong, h: h, lms };
}

/**
 * Analyse une image de la vidéo.
 * Renvoie {people, count} où people ne contient QUE les personnes retenues,
 * triées de gauche à droite. Renvoie null si rien de convaincant.
 */
let streak = 0, rejected = 0, lastWhy = '';
export function stats(){ return { streak: streak, rejected: rejected, why: lastWhy }; }
/** Explication lisible du dernier refus — pour ne jamais laisser l'écran muet. */
export function why(){ return lastWhy; }

export function detect(video, ts){
  if(!landmarker || !video || !video.videoWidth){ streak = 0; return null; }
  let res;
  try { res = landmarker.detectForVideo(video, ts || performance.now()); }
  catch(e){ return null; }
  if(!res || !res.landmarks || !res.landmarks.length){
    streak = 0; lastWhy = 'le modèle ne voit aucune silhouette'; return null; }

  const people = [], refus = [];
  for(const lms of res.landmarks){
    const p = judge(lms);
    if(p.ok) people.push(p); else refus.push(p);
  }
  if(!people.length){
    if(streak > 0) rejected++;
    streak = 0;
    const r = refus[0];
    lastWhy = r
      ? ('silhouette vue mais écartée — ' +
         (r.h < MIN_HEIGHT ? 'trop petite dans l\'image (' + Math.round(r.h*100) + ' %, il en faut ' + Math.round(MIN_HEIGHT*100) + ')'
          : r.strong < MIN_POINTS ? 'seulement ' + r.strong + ' points nets sur ' + MIN_POINTS + ' requis'
          : 'confiance ' + r.pct + ' %, il en faut ' + Math.round(MIN_MEAN*100)))
      : 'rien de convaincant';
    return null;
  }

  // il faut que ça TIENNE plusieurs images : une détection d'un éclair est du bruit
  streak++;
  if(streak < MIN_STREAK){ lastWhy = 'silhouette repérée, confirmation en cours…'; return null; }
  lastWhy = '';

  // position horizontale moyenne → ordre stable de gauche à droite
  for(const p of people){
    let sx = 0, n = 0;
    for(const q of p.lms){ if(q.visibility == null || q.visibility >= VIS){ sx += q.x; n++; } }
    p.x = n ? sx / n : 0.5;
  }
  people.sort((a, b) => a.x - b.x);

  return { people, count: people.length, streak: streak };
}

/** Trace UN squelette (os puis articulations) dans la couleur demandée. */
export function draw(g, lms, W, H, S, colorIndex){
  S = S || 1;
  const color = COLORS[(colorIndex || 0) % COLORS.length];
  g.save();
  g.strokeStyle = color; g.lineWidth = 4 * S; g.lineCap = 'round';
  for(const [a, b] of CONNECTIONS){
    const p = lms[a], q = lms[b];
    if(!p || !q) continue;
    if((p.visibility != null && p.visibility < VIS) ||
       (q.visibility != null && q.visibility < VIS)) continue;
    g.beginPath(); g.moveTo(p.x * W, p.y * H); g.lineTo(q.x * W, q.y * H); g.stroke();
  }
  g.fillStyle = '#DDE6EA';
  for(const p of lms){
    if(p.visibility != null && p.visibility < VIS) continue;
    g.beginPath(); g.arc(p.x * W, p.y * H, 4.5 * S, 0, 7); g.fill();
  }
  g.restore();
}

/** Trace TOUTES les personnes détectées, numérotées et de couleurs distinctes. */
export function drawAll(g, people, W, H, S){
  if(!people || !people.length) return;
  S = S || 1;
  people.forEach((p, i) => {
    draw(g, p.lms, W, H, S, i);
    // numéro au-dessus de la tête, dans la couleur de la personne
    const head = p.lms[0];
    if(head && (head.visibility == null || head.visibility >= VIS)){
      g.save();
      g.fillStyle = COLORS[i % COLORS.length];
      g.font = '600 ' + Math.max(11, 15 * S | 0) + 'px monospace';
      g.textAlign = 'center';
      g.fillText(String(i + 1), head.x * W, Math.max(12 * S, head.y * H - 14 * S));
      g.restore();
    }
  });
}
