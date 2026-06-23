import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const dir = join(process.env.APPDATA, 'com.inboxtray.app');
const files = ['inboxtray.db', 'inboxtray.db-shm', 'inboxtray.db-wal'];

for (const f of files) {
  const p = join(dir, f);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log('deleted:', f);
  }
}
console.log('done');
