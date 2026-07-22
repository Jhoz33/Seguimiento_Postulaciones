import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export const dataPath = join(process.cwd(), 'data', 'applications.json');

export function getApplications() {
  const content = readFileSync(dataPath, 'utf-8');
  return JSON.parse(content);
}
export function saveApplications(apps) {
  writeFileSync(dataPath, JSON.stringify(apps, null, 2));
}