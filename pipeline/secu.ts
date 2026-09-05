import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MANUAL_DIR } from './config.ts';
import type { Chantier, Node, SourceRef } from '../src/schema.ts';

export type Reference = {
  dette: {
    encours: number;
    dateEncours: string;
    dureeVieMoyenneAnnees: number;
    programmeFinancementAnnuel: number;
    source: { label: string; url: string };
    note: string;
    noteCharge: string;
  };
  macroeconomie: {
    pib: number;
    exercice: number;
    libelle: string;
    note: string;
    url: string;
    pibParEmploi: number;
    noteEmploi: string;
  };
  totalConsolideNational: {
    montant: number;
    exercice: number;
    libelle: string;
    note: string;
    url: string;
  };
  secu: {
    source: SourceRef;
    note: string;
    recettes: {
      montant: number;
      note: string;
      structure: { label: string; part: number }[];
      noteStructure: string;
    };
    solde: { montant: number; note: string };
    branches: {
      id: string;
      label: string;
      montant: number;
      note: string;
      derive?: boolean;
      enfants: { label: string; part: number }[];
    }[];
  };
};

export type SecuBuild = {
  enfantsSphere: Node[];
  totalDep: number;
  totalRec: number;
  solde: number;
};

export function readReference(): Reference {
  return JSON.parse(readFileSync(resolve(MANUAL_DIR, 'reference.json'), 'utf8')) as Reference;
}

export function readChantiers(): { chantiers: Chantier[] } {
  const lu = JSON.parse(readFileSync(resolve(MANUAL_DIR, 'chantiers.json'), 'utf8')) as {
    chantiers: Chantier[];
  };
  return { chantiers: lu.chantiers };
}

export function buildSecu(ref: Reference): SecuBuild {
  const nodes: Node[] = [];
  let totalDep = 0;

  for (const b of ref.secu.branches) {
    const id = `secu:${b.id}`;
    totalDep += b.montant;

    for (const [i, child] of b.enfants.entries()) {
      nodes.push({
        id: `${id}/${i}`,
        label: child.label,
        dep: Math.round(b.montant * child.part),
        rec: 0,
        level: 'poste',
        sphere: 'secu',
        parentId: id,
        nDep: 0,
        nRec: 0,
        nSol: 0,
        consolide: false,
        derive: true,
        src: 'secu',
      });
    }

    nodes.push({
      id,
      label: b.label,
      dep: b.montant,
      rec: 0,
      level: 'branche',
      sphere: 'secu',
      parentId: 'sphere:secu',
      nDep: b.enfants.length,
      nRec: 0,
      nSol: 0,
      consolide: false,
      note: b.note,
      derive: b.derive,
      src: 'secu',
    });
  }

  // Les recettes ne sont pas ventilables par branche dans la source : elles
  // forment leur propre sous-arbre, à côté des branches de dépense.
  const rec = ref.secu.recettes;
  for (const [i, poste] of rec.structure.entries()) {
    nodes.push({
      id: `secu:rec/${i}`,
      label: poste.label,
      dep: 0,
      rec: Math.round(rec.montant * poste.part),
      level: 'poste',
      sphere: 'secu',
      parentId: 'sphere:secu',
      nDep: 0,
      nRec: 0,
      nSol: 0,
      consolide: true,
      derive: true,
      note: rec.noteStructure,
      src: 'secu',
    });
  }

  nodes.sort((a, b) => b.dep + b.rec - (a.dep + a.rec));

  return {
    enfantsSphere: nodes,
    totalDep,
    totalRec: rec.montant,
    solde: ref.secu.solde.montant,
  };
}
