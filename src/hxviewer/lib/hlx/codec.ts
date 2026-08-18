/**
 * Byte-exact serializer for Line 6 Helix `.hlx` preset files.
 *
 * A `.hlx` is JSON, but written in a specific style that `JSON.stringify`
 * does not reproduce: a space before every colon (`"key" : value`), and
 * floats printed with C's `%.17g` rather than JavaScript's shortest
 * round-trip form. Exporting with plain `JSON.stringify` would silently
 * rewrite every number in the file.
 *
 * This is a port of `hx_cli/codec.py` from the sibling Python project, and
 * carries the same guarantee: parse a preset and re-serialize it unchanged
 * and you get the original bytes back. `verifyRoundTrip` in `editor.ts` uses
 * that as a safety check before letting the app export an edited preset.
 *
 * On int vs float: JavaScript can't tell `1` from `1.0` after parsing, but it
 * doesn't need to — `%.17g` strips trailing zeros, so a float 1.0 and an
 * integer 1 both render as `1`, which is exactly what Helix writes.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const PRECISION = 17;

/**
 * Exact decimal digits of a double, as `{ digits, exponent }` where the value
 * is `0.<digits> * 10^exponent`.
 *
 * Every double is exactly representable in decimal, so this is lossless.
 * We need it because `toPrecision` rounds halfway cases away from zero while
 * C's printf rounds half-to-even — a difference that shows up in the 17th
 * significant digit of real presets (e.g. -7.9000015258789062).
 */
function exactDigits(value: number): { digits: string; exponent: number } {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, Math.abs(value));
  const hi = buf.getUint32(0);
  const lo = buf.getUint32(4);
  const rawExp = (hi >>> 20) & 0x7ff;
  const rawMantissa = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);

  // Normal numbers carry an implicit leading 1; subnormals do not.
  const mantissa = rawExp === 0 ? rawMantissa : rawMantissa | (1n << 52n);
  const exp2 = (rawExp === 0 ? 1 : rawExp) - 1075; // 1075 = bias 1023 + 52 mantissa bits

  let digits: string;
  let pointFromRight: number;
  if (exp2 >= 0) {
    digits = (mantissa << BigInt(exp2)).toString();
    pointFromRight = 0;
  } else {
    // m / 2^k == m * 5^k / 10^k, so the result is exact in decimal.
    const k = -exp2;
    digits = (mantissa * 5n ** BigInt(k)).toString();
    pointFromRight = k;
  }

  const exponent = digits.length - pointFromRight;
  return { digits: digits.replace(/^0+/, "") || "0", exponent };
}

/** Round a digit string to `precision` significant digits, half-to-even. */
function roundHalfEven(digits: string, precision: number): { digits: string; carried: boolean } {
  if (digits.length <= precision) return { digits: digits.padEnd(precision, "0"), carried: false };

  const kept = digits.slice(0, precision);
  const rest = digits.slice(precision);
  const firstDropped = rest[0];
  const restNonZero = /[1-9]/.test(rest.slice(1));

  let roundUp: boolean;
  if (firstDropped > "5") roundUp = true;
  else if (firstDropped < "5") roundUp = false;
  else if (restNonZero) roundUp = true;
  else roundUp = (kept.charCodeAt(precision - 1) - 48) % 2 === 1; // exact tie -> to even

  if (!roundUp) return { digits: kept, carried: false };

  const bumped = (BigInt(kept) + 1n).toString();
  // Carrying past the leading digit widens the number (999 -> 1000).
  if (bumped.length > kept.length) return { digits: bumped.slice(0, precision), carried: true };
  return { digits: bumped.padStart(precision, "0"), carried: false };
}

/** C's `%.17g`: 17 significant digits, trailing zeros and bare points removed. */
export function formatFloat(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Cannot serialize non-finite number: ${value}`);
  if (value === 0) return Object.is(value, -0) ? "-0" : "0";

  const sign = value < 0 ? "-" : "";
  const exact = exactDigits(value);
  const rounded = roundHalfEven(exact.digits, PRECISION);
  const digits = rounded.digits;
  // decExp is the power-of-ten exponent in scientific form: 0.<digits> * 10^decExp
  const decExp = exact.exponent + (rounded.carried ? 1 : 0);

  // %g uses exponential form when the scientific exponent is < -4 or >= precision.
  const sciExp = decExp - 1;
  if (sciExp < -4 || sciExp >= PRECISION) {
    const mantissa = trimZeros(`${digits[0]}.${digits.slice(1)}`);
    const expSign = sciExp < 0 ? "-" : "+";
    return `${sign}${mantissa}e${expSign}${String(Math.abs(sciExp)).padStart(2, "0")}`;
  }

  if (decExp <= 0) return `${sign}${trimZeros(`0.${"0".repeat(-decExp)}${digits}`)}`;
  if (decExp >= digits.length) return `${sign}${digits}${"0".repeat(decExp - digits.length)}`;
  return `${sign}${trimZeros(`${digits.slice(0, decExp)}.${digits.slice(decExp)}`)}`;
}

function trimZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Serialize to Helix's exact `.hlx` layout (no trailing newline).
 *
 * Pass the `order` table from `parseOrdered` to reproduce the original key
 * order; without it, JavaScript's own ordering is used, which hoists
 * integer-like keys and would reshuffle IR tables.
 */
export function encode(value: Json, order?: WeakMap<object, string[]>): string {
  return encodeValue(value, 0, order);
}

function encodeValue(value: Json, indent: number, order?: WeakMap<object, string[]>): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return formatFloat(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return encodeArray(value, indent, order);
  return encodeObject(value, indent, order);
}

function orderedKeys(value: object, order?: WeakMap<object, string[]>): string[] {
  const own = Object.keys(value);
  const recorded = order?.get(value);
  if (!recorded) return own;
  // Honour the recorded order, then append anything added since parsing and
  // drop anything removed, so edits that change the shape still serialize.
  const present = new Set(own);
  const kept = recorded.filter((k) => present.has(k));
  const seen = new Set(kept);
  return [...kept, ...own.filter((k) => !seen.has(k))];
}

function encodeObject(
  value: { [key: string]: Json },
  indent: number,
  order?: WeakMap<object, string[]>
): string {
  const keys = orderedKeys(value, order);
  if (keys.length === 0) return "{}";
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  const items = keys.map(
    (k) => `${padIn}${JSON.stringify(k)} : ${encodeValue(value[k], indent + 1, order)}`
  );
  return `{\n${items.join(",\n")}\n${pad}}`;
}

function encodeArray(value: Json[], indent: number, order?: WeakMap<object, string[]>): string {
  if (value.length === 0) return "[]";
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  const items = value.map((v) => `${padIn}${encodeValue(v, indent + 1, order)}`);
  return `[\n${items.join(",\n")}\n${pad}]`;
}
