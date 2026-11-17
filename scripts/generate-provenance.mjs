import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateMotionCatalog } from './motion-catalog.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const groups = [
  {id:'restored-static-theater',sourceName:'User-provided original theater avatar attachment, 2026-11-17',origin:'Restored by explicit user request; static PNG copied unchanged, no new generation.',files:['avatar-theater.png','avatar-theater.source.json'],sourceRecord:'avatar-theater.source.json',processing:'Original 512px square attachment embedded unchanged. Independent red-gold frame remains in CSS.'},
  {id:'user-selected-portraits-v2',sourceName:'User-selected avatar attachments 1,2,3',origin:'User-provided images, crop decisions recorded in avatar-portraits.source.json; duplicate fourth omitted.',files:['avatar-smile.webp','avatar-cheek-wink.webp','avatar-peace.webp','avatar-portraits.source.json'],sourceRecord:'avatar-portraits.source.json',processing:'Three original square references resized and WebP encoded; no generative edits or legacy Q artwork in these three assets. The restored original theater portrait has a separate source record.'},
  { id:'theater-portrait',sourceName:'official_aha_character_pv_cover_3840x1632.png',origin:'Local reference collection, official PV cover as recorded in research/deepseek-official-art-research.md; redistribution permission not verified.',files:['aha-portrait-pv.webp','aha-portrait-pv.source.json'],sourceRecord:'aha-portrait-pv.source.json',processing:'Full image resized to 1536px wide and WebP encoded. Non-destructive CSS clipping selects the face; the theater frame and curtain are separate DOM/CSS. No generative edits or reuse of welcome/wind artwork.' },
  {
    id: 'reference-card',
    sourceName: '01-A_官方立绘_透明卡_3180x2000.png',
    origin: 'User-provided reference collection; artwork source recorded by the earlier research task.',
    referencePage: 'https://www.taptap.cn/moment/848872290421574141',
    referenceStatus: 'Recorded in research/deepseek-official-art-research.md; this manifest does not certify redistribution permission.',
    files: ['gilded-stage.webp','gilded-stage-thumb.webp','wordmark.webp','gilt-corner.webp'],
    processing: 'Cropped selected regions and encoded WebP. Card is not a transparent character cutout; wordmark retains original red background.',
    crops: { 'gilded-stage.webp':[1050,220,3080,1790], 'wordmark.webp':[415,680,1050,1120], 'gilt-corner.webp':[125,355,465,650] },
  },
  { id:'portrait',sourceName:'01-B_官方立绘_白底全图_1546x1237.jpg',origin:'User-provided local reference collection; original publication URL not verified.',files:['portrait.webp','portrait-thumb.webp'],processing:'Resized/encoded WebP; original white background retained.' },
  { id:'teatime',sourceName:'01_4.7启动器动态背景_静止帧_2560x1440.jpg',origin:'User-provided local reference collection; original publication URL not verified.',files:['teatime.webp','teatime-thumb.webp'],processing:'Resized/encoded WebP from the supplied still frame.' },
  { id:'scarlet-trick',sourceName:'manga-red-white-original.png',origin:'User-provided image attachment on 2026-11-15; original publication URL and redistribution permission not verified.',files:['scarlet-trick.webp','scarlet-trick-thumb.webp','scarlet-trick.source.json'],sourceRecord:'scarlet-trick.source.json',processing:'Full original composition retained without mirroring or generative edits; lossless full-size WebP and a resized thumbnail. Red-black frame is rendered separately by CSS.' },
  { id:'wind',sourceName:'bb8eddc3f8f8de0f24cc9d63aa245822.mp4',origin:'User-provided phone recording, 2026-11-16; original publication and redistribution permission not verified.',files:['wind-aha-v2.webm','wind-aha-v2-poster.webp','wind-aha-v2.source.json'],sourceRecord:'wind-aha-v2.source.json',processing:'Extracted a continuous character-only segment. Removed border-connected white while preserving enclosed white hair, and excluded disconnected platform badges and phone UI. Encoded a silent alpha VP9 WebM; retained the source recording unchanged.' },
  ...[['wink','表情_02.png'],['heart','表情_08.png'],['shy','表情_05.png']].map(([id,sourceName])=>({
    id:`welcome-${id}`, sourceName,
    origin:'User-provided local chibi collection; original publication URL and redistribution permission not verified.',
    files:[`welcome-${id}.webp`],
    processing:'AI-derived transparent-background edit using built-in image_gen, then resized and encoded WebP. Not a pixel-identical extraction. Original source is retained.',
    promptRecord:'welcome-prompts.json',
  })),
  {id:'stage-frame-v3',sourceName:'gilded-stage.webp / gilt-corner.webp',origin:'User-approved frame completion derived from the local reference card using built-in image_gen.',files:['gilded-stage-scene.webp','gilded-stage-scene-thumb.webp','stage-gold-frame.webp'],processing:'Generated borderless perimeter scenery and a separate transparent nine-slice frame, encoded WebP. The renderer retains original central pixels in an independent protected layer. Original input artwork is unchanged.',promptRecord:'stage-edit-prompts.json'},
  {id:'stage-clear-backdrop',sourceName:'gilded-stage-motion-v1-poster.webp',origin:'Built-in image_gen derived empty theater scenery, matching the user-approved reference palette and curtains.',files:['gilded-stage-clear-backdrop.webp','stage-clear-backdrop.source.json'],sourceRecord:'stage-clear-backdrop.source.json',processing:'Generated sharp red curtain scenery without figures or foreground props, encoded WebP. Original video and protected static illustration remain unchanged and render above this background.'},
];
const wallpaperCatalog = JSON.parse(await fs.readFile(path.join(root,'assets/catalog.json'),'utf8'));
const motionCatalog = validateMotionCatalog(JSON.parse(await fs.readFile(path.join(root,'assets/motion-catalog.json'),'utf8')), {wallpaperIds:wallpaperCatalog.map(item=>item.id)});
for (const [kind, entries] of Object.entries(motionCatalog)) {
  for (const [id, entry] of Object.entries(entries)) {
    const sourceRecord = `${path.parse(entry.file).name}.source.json`;
    const hasSourceRecord = await fs.access(path.join(root,'assets',sourceRecord)).then(()=>true,()=>false);
    groups.push({
    id:`motion-${kind}-${id}`,sourceName:entry.file,
    origin:hasSourceRecord ? 'Author-generated motion derived from user-provided artwork; generation and processing recorded in the accompanying source record. Redistribution permission remains unconfirmed.' : 'Packaged motion catalog entry; original source, generation details and redistribution permission must be recorded before public release.',
    ...(hasSourceRecord ? {sourceRecord} : {}),
    files:[entry.file,...(entry.posterFile?[entry.posterFile]:[]),...(hasSourceRecord?[sourceRecord]:[])],processing:'Embedded unchanged from the packaged file; playback is muted at runtime.',
    });
  }
}
const assets = [];
for (const group of groups) {
  const { files, ...source } = group;
  for (const file of files) {
    const bytes = await fs.readFile(path.join(root,'assets',file));
    assets.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:source.id});
  }
}
await fs.writeFile(path.join(root,'assets/provenance.json'),JSON.stringify({
  version:1, usage:'Unofficial fan theme preview. MIT applies to original code only; this manifest does not clear media redistribution.',
  redistributionStatus:'unconfirmed', sources:groups.map(({files,...item})=>item),assets,
},null,2)+'\n');
console.log(`Recorded provenance and hashes for ${assets.length} media assets.`);
