export const localUrl = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
  ? `${import.meta.env.BASE_URL}${value.slice(1)}` : value;

export function withBase(value) {
  if (Array.isArray(value)) return value.map(withBase);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withBase(item)]));
  return localUrl(value);
}
