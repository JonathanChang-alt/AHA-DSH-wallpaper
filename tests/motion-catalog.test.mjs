import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMotionCatalog } from '../scripts/motion-catalog.mjs';
const options={wallpaperIds:['gilded-stage','portrait','teatime']};
test('portrait movies use only known IDs and cannot reuse welcome or wallpaper footage',()=>{
 const base={version:1,wallpapers:{},welcome:{},portraits:{peace:{file:'peace.mp4'}}};
 assert.equal(validateMotionCatalog(base,options).portraits.peace.file,'peace.mp4');
 assert.throws(()=>validateMotionCatalog({...base,portraits:{unknown:{file:'other.mp4'}}},options));
 assert.throws(()=>validateMotionCatalog({...base,welcome:{wink:{file:'PEACE.mp4'}}},options));
 assert.throws(()=>validateMotionCatalog({...base,wallpapers:{teatime:{file:'peace.mp4'}}},options));
});
test('motion metadata preserves gallery identity and allows partial character availability',()=>{
 const result=validateMotionCatalog({version:1,wallpapers:{'gilded-stage':{file:'stage-motion.mp4',posterFile:'stage-poster.webp'}},welcome:{wink:{file:'wink-alpha.webm'}}},options);
 assert.equal(result.wallpapers['gilded-stage'].file,'stage-motion.mp4');
 assert.deepEqual(Object.keys(result.welcome),['wink']);
});
test('authoring metadata rejects unknown IDs, resource URLs, paths and unsupported files',()=>{
 for(const file of ['../movie.mp4','C:\\movie.mp4','https://example.test/movie.mp4','file:///movie.mp4','movie.svg','movie.mp4?x']){
  assert.throws(()=>validateMotionCatalog({version:1,wallpapers:{'gilded-stage':{file}},welcome:{}},options));
 }
 assert.throws(()=>validateMotionCatalog({version:1,wallpapers:{unknown:{file:'movie.mp4'}},welcome:{}},options));
 assert.throws(()=>validateMotionCatalog({version:2,wallpapers:{},welcome:{}},options));
});
test('wind and welcome/wallpaper resources cannot accidentally share one file',()=>{
 assert.throws(()=>validateMotionCatalog({version:1,wallpapers:{'gilded-stage':{file:'wind.mp4'}},welcome:{}},options));
 assert.throws(()=>validateMotionCatalog({version:1,wallpapers:{'gilded-stage':{file:'movie.mp4'}},welcome:{wink:{file:'MOVIE.mp4'}}},options));
});
