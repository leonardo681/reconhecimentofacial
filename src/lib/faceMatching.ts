import { FACE_MATCH_DISTANCE_THRESHOLD } from "./faceDescriptorSimilarity";

/** Descritor facial de 128 dimensões (Float32Array no face-api.js). */
export type Descriptor = ArrayLike<number>;

export interface LabeledDescriptor<P> {
  person: P;
  descriptor: Descriptor;
}

export interface FaceAssignment<P> {
  person: P | null;
  distance: number | null;
}

/** Distância euclidiana entre dois descritores (menor = mais parecidos). */
export function euclideanDistance(a: Descriptor, b: Descriptor): number {
  if (a.length !== b.length) {
    throw new Error("Descritores com tamanhos diferentes");
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Associa cada rosto detectado a uma pessoa da base, sem repetir a mesma pessoa
 * em dois rostos da mesma imagem. Os pares (rosto, pessoa) abaixo do limiar são
 * escolhidos do mais próximo para o mais distante; os rostos que sobrarem ficam
 * como desconhecidos. Uma pessoa pode ter várias fotos na base: vale a mais próxima.
 */
export function assignFaces<P extends { id: string }>(
  faces: Descriptor[],
  base: LabeledDescriptor<P>[],
  threshold: number = FACE_MATCH_DISTANCE_THRESHOLD,
): FaceAssignment<P>[] {
  const pairs: { face: number; person: P; distance: number }[] = [];

  faces.forEach((face, faceIndex) => {
    const bestPerPerson = new Map<string, { person: P; distance: number }>();
    for (const entry of base) {
      const distance = euclideanDistance(face, entry.descriptor);
      const previous = bestPerPerson.get(entry.person.id);
      if (!previous || distance < previous.distance) {
        bestPerPerson.set(entry.person.id, { person: entry.person, distance });
      }
    }
    for (const { person, distance } of bestPerPerson.values()) {
      if (distance < threshold) pairs.push({ face: faceIndex, person, distance });
    }
  });

  pairs.sort((a, b) => a.distance - b.distance);

  const result: FaceAssignment<P>[] = faces.map(() => ({ person: null, distance: null }));
  const usedPeople = new Set<string>();
  const assignedFaces = new Set<number>();
  for (const pair of pairs) {
    if (assignedFaces.has(pair.face) || usedPeople.has(pair.person.id)) continue;
    result[pair.face] = { person: pair.person, distance: pair.distance };
    assignedFaces.add(pair.face);
    usedPeople.add(pair.person.id);
  }
  return result;
}
