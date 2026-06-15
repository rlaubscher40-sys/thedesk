/**
 * Read a route parameter as a single string.
 *
 * Express 5 (@types/express 5) widened `req.params` values to
 * `string | string[]` to cover repeated / wildcard params. Our routes only use
 * simple named params (`:id`, `:n`, `:uuid`, `:kind`), which are always plain
 * strings at runtime — this narrows the type back to a string, taking the
 * first element on the off chance an array ever arrives and falling back to "".
 */
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
