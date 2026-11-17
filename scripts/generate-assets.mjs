import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { validateMotionCatalog } from './motion-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory = path.join(root,'assets');
const catalog = JSON.parse(fs.readFileSync(path.join(directory,'catalog.json'),'utf8'));
const portraits = JSON.parse(fs.readFileSync(path.join(directory,'portrait-catalog.json'),'utf8'));
if(!Array.isArray(portraits)||portraits.length!==4||new Set(portraits.map(x=>x.id)).size!==4||portraits.some(x=>!['theater','smile','cheek-wink','peace'].includes(x.id)))throw new Error('Invalid built-in portrait catalog.');
const motionCatalog = validateMotionCatalog(JSON.parse(fs.readFileSync(path.join(directory,'motion-catalog.json'),'utf8')), {wallpaperIds:catalog.map(item=>item.id)});
const asset = (filename) => {
  if(path.basename(filename)!==filename) throw new Error('Asset must be a bundled file');
  const mime={'.mp4':'video/mp4','.webm':'video/webm','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[path.extname(filename).toLowerCase()];
  if(!mime)throw new Error('Unsupported bundled asset format');
  return `data:${mime};base64,${fs.readFileSync(path.join(directory,filename)).toString('base64')}`;
};
const motion=entry=>({src:asset(entry.file),...(entry.posterFile?{poster:asset(entry.posterFile)}:{})});
const wallpapers=catalog.map(({file,thumbnail,originalFile,backdropFile,...item})=>({...item,kind:'image',src:asset(file),thumbnail:asset(thumbnail),...(originalFile?{originalSrc:asset(originalFile)}:{}),...(backdropFile?{backdropSrc:asset(backdropFile)}:{}),...(motionCatalog.wallpapers[item.id]?{motion:motion(motionCatalog.wallpapers[item.id])}:{})}));
const result={
 ART_WALLPAPERS:wallpapers,
 WORDMARK_DATA:asset('wordmark.webp'),
 PORTRAITS:portraits.map(({file,...item})=>({...item,src:asset(file),...(motionCatalog.portraits[item.id]?{motion:motion(motionCatalog.portraits[item.id])}:{})})),
 GOLD_CORNER_DATA:asset('gilt-corner.webp'),
 STAGE_FRAME_DATA:asset('stage-gold-frame.webp'),
 WIND_VIDEO_DATA:asset('wind-aha-v2.webm'),
 WIND_POSTER_DATA:asset('wind-aha-v2-poster.webp'),
 WIND_ASPECT_RATIO:1,
 // Alpha >=16 union across the 25 packaged frames, from wind-aha-v2.source.json.
 WIND_VISIBLE_BOUNDS:{left:132/512,top:16/512,right:504/512,bottom:486/512},
 WELCOME_ART:Object.fromEntries(['wink','heart','shy'].map(id=>[id,asset(`welcome-${id}.webp`)])),
 WELCOME_MOTION:Object.fromEntries(Object.entries(motionCatalog.welcome).map(([id,entry])=>[id,motion(entry)])),
};
const output=path.join(root,'src/client/assets.generated.mjs');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,'// Generated from bundled assets; do not hand edit.\n'+Object.entries(result).map(([key,value])=>`export const ${key} = ${JSON.stringify(value)};`).join('\n')+'\n');
console.log(`Embedded ${wallpapers.length} built-in wallpapers and local media.`);
