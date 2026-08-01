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

export const VIS = 0.4;        // confiance minimale d'un point articulaire
export const MIN_POINTS = 8;   // points fiables exigés pour parler de « personne »
export const MIN_MEAN = 0.45;  // confiance moyenne exigée
export const MAX_PEOPLE = 4;   // personnes suivies simultanément

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
      numPoses: MAX_PEOPLE
    });
    return landmarker;
  })();
  try { return await loading; } finally { loading = null; }
}

export function ready(){ return !!landmarker; }

/** Juge un squelette : assez de points fiables pour être une vraie personne ? */
function judge(lms){
  let sum = 0, count = 0, strong = 0;
  for(const p of lms){
    if(p.visibility == null) continue;
    sum += p.visibility; count++;
    if(p.visibility >= VIS) strong++;
  }
  const mean = count ? sum / count : 0;
  return { ok: strong >= MIN_POINTS && mean >= MIN_MEAN,
           pct: Math.round(mean * 100), strong, lms };
}

/**
 * Analyse une image de la vidéo.
 * Renvoie {people, count} où people ne contient QUE les personnes retenues,
 * triées de gauche à droite. Renvoie null si rien de convaincant.
 */
export function detect(video, ts){
  if(!landmarker || !video || !video.videoWidth) return null;
  let res;
  try { res = landmarker.detectForVideo(video, ts || performance.now()); }
  catch(e){ return null; }
  if(!res || !res.landmarks || !res.landmarks.length) return null;

  const people = [];
  for(const lms of res.landmarks){
    const p = judge(lms);
    if(p.ok) people.push(p);
  }
  if(!people.length) return null;

  // position horizontale moyenne → ordre stable de gauche à droite
  for(const p of people){
    let sx = 0, n = 0;
    for(const q of p.lms){ if(q.visibility == null || q.visibility >= VIS){ sx += q.x; n++; } }
    p.x = n ? sx / n : 0.5;
  }
  people.sort((a, b) => a.x - b.x);

  return { people, count: people.length };
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
