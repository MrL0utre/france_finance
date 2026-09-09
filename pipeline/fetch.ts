import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import { CACHE_DIR } from './config.ts';

const FORCE = process.argv.includes('--force');

/**
 * Télécharge une URL vers data/cache/<name>, en réutilisant le fichier existant.
 * Les exports OFGL/data.economie sont volumineux : on ne les retélécharge pas
 * sans --force.
 */
export async function download(url: string, name: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const dest = resolve(CACHE_DIR, name);

  // Le cache est indexé sur le nom de fichier. Sans mémoire de l'URL qui l'a
  // rempli, changer une requête — ajouter un agrégat à une API, par exemple —
  // réutiliserait silencieusement l'ancienne réponse, et le manque ne se
  // verrait qu'à la première lecture du champ absent. On garde donc l'URL à
  // côté du fichier, et un écart la fait retélécharger.
  const empreinte = `${dest}.url`;
  const memeUrl = existsSync(empreinte) && readFileSync(empreinte, 'utf8') === url;

  if (existsSync(dest) && memeUrl && !FORCE && statSync(dest).size > 0) {
    console.log(`  cache   ${name} (${mo(statSync(dest).size)})`);
    return dest;
  }
  if (existsSync(dest) && !memeUrl) console.log(`  requête modifiée, ${name} est retéléchargé`);

  console.log(`  fetch   ${name}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  if (!res.body) throw new Error(`réponse vide — ${url}`);

  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  const { renameSync } = await import('node:fs');
  renameSync(tmp, dest);
  writeFileSync(empreinte, url);
  console.log(`  ok      ${name} (${mo(statSync(dest).size)})`);
  return dest;
}

export async function* readCsv(
  path: string,
  delimiter = ';',
): AsyncGenerator<Record<string, string>> {
  const parser = createReadStream(path).pipe(
    parse({ columns: true, delimiter, skip_empty_lines: true, relax_quotes: true, bom: true }),
  );
  for await (const row of parser) yield row as Record<string, string>;
}

function mo(bytes: number): string {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} Mo` : `${(bytes / 1e3).toFixed(0)} Ko`;
}
