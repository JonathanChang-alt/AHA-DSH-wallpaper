import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoPlayback } from '../src/client/video-playback.mjs';
class Video extends EventTarget {
  paused = true;
  currentTime = 0;
  src = '';
  playCalls = 0;
  playImpl = () => Promise.resolve();
  play() { this.playCalls++; return this.playImpl().then(() => { this.paused = false; this.dispatchEvent(new Event('playing')); }); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  removeAttribute(key) { if (key === 'src') this.src = ''; }
  load() {}
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('late play completion after suspension cannot restart media', async () => {
  const video = new Video(); let resolve;
  video.playImpl = () => new Promise(done => { resolve = done; });
  const player = createVideoPlayback(video, {src:'fixture.mp4'});
  player.setAllowed(true); player.setAllowed(false); resolve(); await settle();
  assert.equal(video.paused,true); assert.equal(player.getState().playing,false);
  assert.equal(video.muted,true); assert.equal(video.defaultMuted,true);
  player.dispose();
});
test('resume during an in-flight play request eventually plays without duplicate concurrent starts', async () => {
  const video = new Video(); let resolve;
  video.playImpl = () => new Promise(done => { resolve = done; });
  const player = createVideoPlayback(video, {src:'fixture.mp4',loop:true});
  player.setAllowed(true); player.setAllowed(false); player.setAllowed(true);
  assert.equal(video.playCalls,1);
  video.playImpl = () => Promise.resolve(); resolve(); await settle();
  assert.equal(video.paused,false); assert.equal(player.getState().playing,true);
  player.dispose();
});
test('disposal detaches media and defeats a pending play promise', async () => {
  const video = new Video(); let resolve; let changes=0;
  video.playImpl=()=>new Promise(done=>{resolve=done;});
  const player=createVideoPlayback(video,{src:'fixture.mp4',onChange:()=>changes++});
  player.setAllowed(true); player.dispose(); const before=changes;
  resolve(); await settle(); video.dispatchEvent(new Event('loadeddata'));
  assert.equal(video.paused,true); assert.equal(video.src,''); assert.equal(changes,before);
});
test('a blocked muted play can be retried by a user gesture without changing resources', async () => {
  const video = new Video();
  video.playImpl=()=>Promise.reject(Object.assign(new Error('policy'),{name:'NotAllowedError'}));
  const player=createVideoPlayback(video,{src:'fixture.mp4'});
  player.setAllowed(true); await settle(); assert.equal(player.getState().blocked,true);
  video.playImpl=()=>Promise.resolve(); player.retry(); await settle();
  assert.equal(player.getState().blocked,false); assert.equal(video.paused,false);
  player.dispose();
});
