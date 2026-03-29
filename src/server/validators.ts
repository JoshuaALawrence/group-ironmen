const NAME_RE = /[^A-Za-z 0-9\-_]/;

export function validName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const len = name.length;
  if (len < 1 || len > 16) return false;
  // eslint-disable-next-line no-control-regex
  if (!/^[\x00-\x7F]*$/.test(name)) return false;
  if (NAME_RE.test(name)) return false;
  if (name.trim().length === 0) return false;
  return true;
}

export function validateMemberPropLength(
  propName: string,
  value: unknown,
  min: number,
  max: number
): void {
  if (value == null) return;
  if (!Array.isArray(value) && !Buffer.isBuffer(value)) {
    const message = `${propName} must be an array`;
    throw Object.assign(new Error(message), { statusCode: 400, publicMessage: 'Invalid member data' });
  }
  if (value.length < min || value.length > max) {
    const message = `${propName} length violated range constraint ${min}..=${max} actual=${value.length}`;
    throw Object.assign(
      new Error(message),
      { statusCode: 400, publicMessage: 'Invalid member data length' }
    );
  }
}
