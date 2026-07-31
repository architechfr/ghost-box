-- ══════════════════════════════════════════════════════════════
--  Inventaire des capteurs — à charger après schema-postgres.sql
--  bruit_typique = ce qui fait bouger le capteur sans rien d'inexpliqué.
--  Cette colonne n'est pas décorative : c'est elle qui te permettra
--  d'écarter 90 % des « anomalies » avant même de les analyser.
-- ══════════════════════════════════════════════════════════════

insert into capteur (code, libelle, unite, plateforme, api, dispo_ios, dispo_android, bruit_typique, notes) values

-- ─── AUDIO ───────────────────────────────────────────────────
('audio_rms','Niveau sonore','dBFS','web','getUserMedia + AnalyserNode',true,true,
 'Respiration, vêtements, ventilation, circulation, main sur le boîtier',
 'Déjà implémenté dans l''app d''enregistrement. Base la plus fiable.'),
('audio_bande','Énergie par bande','dBFS','web','AnalyserMode FFT 2048',true,true,
 'Bourdonnement 50 Hz du secteur, sifflement des alimentations',
 'Séparer 100-300 / 300-3000 / 3000-8000 Hz donne trois entrées indépendantes.'),
('audio_ultrason','Bande 15-20 kHz','dBFS','web','AnalyserNode, bins hauts',true,true,
 'Détecteurs de mouvement, écrans, télécommandes, moustiques',
 'Le micro du téléphone coupe sous ~50 Hz : les infrasons ne sont PAS captables.'),

-- ─── MOUVEMENT ───────────────────────────────────────────────
('accel','Accéléromètre','m/s²','web','DeviceMotionEvent · Accelerometer',true,true,
 'Ta main, tes pas, le vent, un plancher qui vibre, un camion dehors',
 'iOS : DeviceMotionEvent.requestPermission() obligatoire, sur geste utilisateur.'),
('gyro','Gyroscope','rad/s','web','DeviceMotionEvent.rotationRate · Gyroscope',true,true,
 'Micro-tremblements de la main, dérive thermique du MEMS',
 'Très bruité au repos : excellent générateur d''aléa, mauvais détecteur.'),
('orientation','Orientation','°','web','DeviceOrientationEvent',true,true,
 'Rotation du poignet, recalibration automatique du système',
 'alpha/beta/gamma. Sur iOS alpha est relatif au démarrage, pas au nord.'),
('boussole','Cap magnétique','°','web','webkitCompassHeading · AbsoluteOrientationSensor',true,true,
 'Aimants de coque, enceintes, armature métallique, voiture',
 'Le seul accès indirect au magnétomètre sur iPhone.'),

-- ─── CHAMP MAGNÉTIQUE (le « EMF ») ──────────────────────────
('magnetometre','Magnétomètre 3 axes','µT','web','Magnetometer (Generic Sensor API)',false,true,
 'Aimant du rabat de housse, écouteurs, câble d''alimentation, ferraille du béton, ascenseur',
 'Chrome Android uniquement, HTTPS + permission ''magnetometer''. ABSENT sur iOS. '
 'Mesure le champ statique, pas les champs alternatifs d''un vrai détecteur EMF.'),
('magneto_delta','Variation du champ','µT/s','web','dérivée de magnetometre',false,true,
 'Ton propre déplacement dans un champ constant',
 'Plus intéressant que la valeur brute : c''est le changement qui compte.'),

-- ─── LUMIÈRE ET IMAGE ────────────────────────────────────────
('lumiere','Luminosité ambiante','lux','web','AmbientLightSensor',false,true,
 'Ta main au-dessus du téléphone, un phare, une ampoule qui clignote',
 'Chrome Android derrière un flag. À remplacer par camera_lum.'),
('camera_lum','Luminance moyenne caméra','0-255','web','getUserMedia + canvas',true,true,
 'Auto-exposition de la caméra qui compense en permanence',
 'Désactiver l''exposition auto si possible, sinon le capteur mesure surtout lui-même.'),
('camera_diff','Différence image à image','%','web','canvas + comparaison de trames',true,true,
 'Bruit du capteur en basse lumière, insectes, poussière, reflets',
 'La base des caméras « SLS ». Sans profondeur, un portemanteau devient une silhouette.'),
('profondeur','Carte de profondeur','m','natif','ARKit LiDAR · ARCore Depth',true,true,
 'Surfaces sombres, vitres, miroirs, tissus qui absorbent l''infrarouge',
 'Le squelette des apps SLS vient d''un modèle de pose entraîné sur des humains : '
 'il est conçu pour trouver des corps, donc il en trouve.'),

-- ─── ENVIRONNEMENT ───────────────────────────────────────────
('pression','Pression atmosphérique','hPa','natif','Sensor.TYPE_PRESSURE · CMAltimeter',true,true,
 'Ouverture d''une porte, ascenseur, chauffage, météo',
 'Non exposé au web. Très sensible : détecte une porte qui claque à l''autre bout.'),
('temp_ambiante','Température ambiante','°C','natif','Sensor.TYPE_AMBIENT_TEMPERATURE',false,true,
 'Chaleur du processeur, ta main, le soleil',
 'Rare sur les téléphones récents. Souvent absent.'),
('temp_batterie','Température batterie','°C','natif','BatteryManager Android',false,true,
 'Charge, usage du GPU, poche',
 'Souvent utilisé comme substitut de température : mesure surtout ton téléphone.'),
('humidite','Humidité relative','%','natif','Sensor.TYPE_RELATIVE_HUMIDITY',false,true,
 'Ta respiration à proximité',
 'Quasiment disparu des appareils du marché.'),

-- ─── ÉNERGIE ET RÉSEAU ───────────────────────────────────────
('batterie','Niveau de batterie','%','web','Battery Status API',false,true,
 'Écran allumé, GPS actif, froid ambiant',
 'La « chute de batterie inexpliquée » du folklore : le froid suffit à l''expliquer.'),
('reseau','Débit et latence','Mb/s · ms','web','Network Information API',false,true,
 'Encombrement de la cellule, murs, distance à l''antenne',
 'downlink et rtt changent en permanence : source d''aléa très riche.'),
('gps','Position et précision','m','web','Geolocation API',true,true,
 'Multi-trajet en intérieur, canyon urbain',
 'La dérive de précision en intérieur est un excellent générateur d''entropie.'),
('wifi_rssi','Puissance Wi-Fi','dBm','natif','WifiManager Android',false,true,
 'Corps humains, portes, four à micro-ondes',
 'Non accessible au web pour raisons de vie privée.'),
('bluetooth_rssi','Puissance Bluetooth','dBm','natif','Web Bluetooth (limité) · natif',true,true,
 'Autres appareils, absorption par le corps',
 'Le web n''autorise pas le scan passif : il faut un appairage explicite.'),
('nfc','Étiquette NFC','—','web','Web NFC',false,true,
 'Aucune lecture sans contact physique',
 'Chrome Android. Utile pour marquer des points fixes dans un lieu.'),

-- ─── INTERACTION ─────────────────────────────────────────────
('toucher','Pression tactile','0-1','web','PointerEvent.pressure',true,true,
 'Ton doigt',
 'À exclure de tout mapping : tu contrôlerais toi-même la sortie.'),
('pas','Podomètre','pas','natif','TYPE_STEP_COUNTER · CMPedometer',true,true,
 'Tes propres pas',
 'Idem : à exclure, sauf pour horodater tes déplacements.');

-- ─── Mappings de départ ──────────────────────────────────────
insert into mapping (nom, capteur_id, mode, plage_min, plage_max, seuil_delta, cadence_ms)
select 'Champ magnétique — variations', id, 'delta', 20, 80, 2.5, 1500 from capteur where code='magnetometre';
insert into mapping (nom, capteur_id, mode, plage_min, plage_max, seuil_delta, cadence_ms)
select 'Niveau sonore — pics', id, 'delta', -70, -10, 6, 1200 from capteur where code='audio_rms';
insert into mapping (nom, capteur_id, mode, plage_min, plage_max, cadence_ms)
select 'Bande audio médium — direct', id, 'direct', -80, -20, 1800 from capteur where code='audio_bande';
insert into mapping (nom, capteur_id, mode, cadence_ms)
select 'TÉMOIN — aléatoire à graine fixe', id, 'temoin', 1500 from capteur where code='audio_rms';
