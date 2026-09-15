/** Maps API validation details ([{ path, message }]) to a { field: message } object. */
export function fieldErrors(err) {
  const map = {};
  for (const detail of err?.details || []) {
    if (detail.path && !map[detail.path]) map[detail.path] = detail.message;
  }
  return map;
}
