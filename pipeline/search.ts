import type { CollectivitesBuild } from './collectivites.ts';
import type { EtatBuild } from './etat.ts';
import type { SearchEntry } from '../src/schema.ts';

/**
 * Index plat nom → nœud, chargé à la demande au premier usage du champ de
 * recherche. Chaque entrée porte la liste ordonnée des shards à charger pour
 * que la chaîne d'ancêtres soit reconstituable côté client.
 */
export function buildSearchIndex(col: CollectivitesBuild, etat: EtatBuild): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const region of col.regions) {
    entries.push({
      i: region.id,
      n: region.label,
      c: 'Région',
      a: region.dep,
      s: region.shard ? [region.shard] : undefined,
    });
  }

  const contexteDepartement = new Map<string, { nom: string; shards: string[] }>();
  for (const [regCode, nodes] of col.regionShards) {
    const regionName = col.regions.find((r) => r.id === `reg:${regCode}`)?.label ?? '';
    const regionShard = `region/${regCode}.json`;
    for (const n of nodes) {
      if (n.level !== 'departement') continue;
      const depCode = n.id.slice('dep:'.length);
      const shards = [regionShard, `dept/${depCode}.json`];
      contexteDepartement.set(depCode, { nom: n.label, shards });
      entries.push({
        i: n.id,
        n: n.label,
        c: `Département · ${regionName}`,
        a: n.dep,
        s: shards,
      });
    }
  }

  for (const [depCode, nodes] of col.deptShards) {
    const contexte = contexteDepartement.get(depCode);
    const nom = contexte?.nom ?? depCode;
    const shards = contexte?.shards ?? [`dept/${depCode}.json`];
    for (const n of nodes) {
      if (n.level === 'commune') {
        entries.push({ i: n.id, n: n.label, c: `Commune · ${nom}`, a: n.dep, s: shards });
      } else if (n.level === 'epci') {
        entries.push({ i: n.id, n: n.label, c: `Intercommunalité · ${nom}`, a: n.dep, s: shards });
      }
    }
  }

  for (const m of etat.enfantsSphere) {
    entries.push({
      i: m.id,
      n: m.label,
      c: m.level === 'ministere' ? 'Ministère' : "Recettes de l'État",
      a: m.dep || m.rec,
      s: m.shard ? [m.shard] : undefined,
    });
  }
  for (const [code, nodes] of etat.shards) {
    const shard = `etat/${code}.json`;
    const parent = etat.enfantsSphere.find((m) => m.shard === shard);
    for (const n of nodes) {
      const kind =
        n.level === 'mission' ? 'Mission' : n.level === 'programme' ? 'Programme' : n.level === 'poste' ? 'Recette' : null;
      if (!kind) continue;
      entries.push({
        i: n.id,
        n: n.label,
        c: `${kind} · ${parent?.label ?? ''}`,
        a: n.dep || n.rec,
        s: [shard],
      });
    }
  }

  entries.sort((a, b) => Math.abs(b.a) - Math.abs(a.a));
  return entries;
}
