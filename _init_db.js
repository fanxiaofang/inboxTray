import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const dir = join(process.env.APPDATA, 'com.inboxtray.app');
const dbPath = join(dir, 'inboxtray.db');

if (!existsSync(dbPath)) {
  writeFileSync(dbPath, '');
  console.log('created empty db at:', dbPath);
} else {
  console.log('db already exists');
}
