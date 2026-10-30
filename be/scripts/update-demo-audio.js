import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vendors } from '../src/data/catalog.js';
import { openDatabase } from '../src/db.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const db = openDatabase(resolve(root, 'be/data/ganhmuusinh.sqlite'));
const find = db.prepare("SELECT payload FROM content WHERE kind = 'vendor' AND id = ?");
const update = db.prepare(
  "UPDATE content SET payload = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE kind = 'vendor' AND id = ?",
);

db.exec('BEGIN IMMEDIATE');
try {
  let updated = 0;
  for (const seed of vendors) {
    const row = find.get(seed.id);
    if (!row) continue;
    const current = JSON.parse(row.payload);
    if (current.dataType !== 'illustrative') continue;
    if (
      current.story === seed.story &&
      current.storyEn === seed.storyEn &&
      current.storyAudioUrl === seed.storyAudioUrl &&
      current.storyAudioUrlEn === seed.storyAudioUrlEn &&
      current.nameEn === seed.nameEn &&
      JSON.stringify(current.ingredientsEn) === JSON.stringify(seed.ingredientsEn) &&
      current.tipEn === seed.tipEn
    )
      continue;
    current.story = seed.story;
    current.storyEn = seed.storyEn;
    current.storyAudioUrl = seed.storyAudioUrl;
    current.storyAudioUrlEn = seed.storyAudioUrlEn;
    current.nameEn = seed.nameEn;
    current.ingredientsEn = seed.ingredientsEn;
    current.tipEn = seed.tipEn;
    update.run(JSON.stringify(current), seed.id);
    updated += 1;
  }
  db.exec('COMMIT');
  console.log(`Updated ${updated} illustrative demo vendors.`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
