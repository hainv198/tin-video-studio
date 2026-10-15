export type IdGenerator = () => string;

export function randomIds(): IdGenerator {
  return () => globalThis.crypto.randomUUID();
}

export function sequentialIds(prefix: string): IdGenerator {
  let n = 0;
  return () => `${prefix}${++n}`;
}
