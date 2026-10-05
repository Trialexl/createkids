export const MIN_CHILD_AGE = 5;
export const MAX_CHILD_AGE = 17;

export const defaultChildren = [
  { id: 'younger', name: 'Ребёнок', age: 7 },
  { id: 'teen', name: 'Подросток', age: 14 }
];

export function normalizeChildren(value, fallback = defaultChildren) {
  if (!Array.isArray(value) || value.length < 1) {
    return fallback.map((child) => ({ ...child }));
  }
  const children = [];
  const ids = new Set();
  for (const item of value) {
    const id = String(item?.id ?? '').trim();
    const name = String(item?.name ?? '').trim();
    const age = Number(item?.age);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || ids.has(id) || !name || name.length > 40) {
      return fallback.map((child) => ({ ...child }));
    }
    if (!Number.isInteger(age) || age < MIN_CHILD_AGE || age > MAX_CHILD_AGE) {
      return fallback.map((child) => ({ ...child }));
    }
    ids.add(id);
    children.push({ id, name, age });
  }
  return children;
}

export function childAgeLabel(age) {
  const number = Number(age);
  const remainder100 = number % 100;
  const remainder10 = number % 10;
  const word = remainder100 >= 11 && remainder100 <= 14
    ? 'лет'
    : remainder10 === 1
      ? 'год'
      : remainder10 >= 2 && remainder10 <= 4
        ? 'года'
        : 'лет';
  return `${number} ${word}`;
}
