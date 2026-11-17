const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const videoFile = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]*\.(mp4|webm)$/i.test(value);
const imageFile = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]*\.(webp|png|jpg|jpeg)$/i.test(value);

/** Authoring boundary: motion belongs to known gallery IDs and packaged files. */
export function validateMotionCatalog(value, { wallpaperIds, welcomeIds = ['wink', 'heart', 'shy'], portraitIds = ['theater', 'smile', 'cheek-wink', 'peace'] }) {
  if (!record(value) || value.version !== 1) throw new Error('Motion catalog version must be 1.');
  const result = { wallpapers: {}, welcome: {}, portraits: {} }, used = new Set(['wind.mp4', 'wind-aha-v2.webm']);
  for (const [group, ids] of [['wallpapers', wallpaperIds], ['welcome', welcomeIds], ['portraits', portraitIds]]) {
    const entries = group === 'portraits' && value[group] === undefined ? {} : value[group];
    if (!record(entries)) throw new Error(`Motion catalog ${group} must be an object.`);
    for (const [id, entry] of Object.entries(entries)) {
      if (!ids.includes(id) || !record(entry) || !Object.hasOwn(entry, 'file') || !videoFile(entry.file)) throw new Error(`Invalid motion resource: ${group}.${id}`);
      if (used.has(entry.file.toLowerCase())) throw new Error('Each character/video resource must have its own file.');
      used.add(entry.file.toLowerCase());
      if (entry.posterFile !== undefined && !imageFile(entry.posterFile)) throw new Error(`Invalid motion poster: ${group}.${id}`);
      result[group][id] = { file: entry.file, ...(entry.posterFile ? {posterFile: entry.posterFile} : {}) };
    }
  }
  return result;
}
