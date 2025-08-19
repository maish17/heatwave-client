import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.resolve(__dirname, '../fixtures');

export async function fileFromFixture(name: string, mime = 'application/pdf') {
  const filePath = path.join(fixturesDir, name);
  const buf = fs.readFileSync(filePath);
  return new File([buf], name, { type: mime });
}