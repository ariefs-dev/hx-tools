/**
 * Order-preserving JSON parser for `.hlx` presets.
 *
 * `JSON.parse` cannot be used alone here: JavaScript objects hoist
 * integer-like keys ("100", "101") ahead of other keys and sort them
 * numerically, so a preset containing an IR table
 * (`"irUuidTable": { "033": ..., "100": ... }`) comes back in a different
 * order than it was written, and re-serializing it would reshuffle the file.
 *
 * This parser produces ordinary objects — so the rest of the app can treat a
 * preset as plain data — plus a side table recording each object's true key
 * order, which `encode` consults to write the file back exactly as it came in.
 */

import type { Json } from "./codec";

/** Original key order per object, keyed by object identity. */
export type KeyOrder = WeakMap<object, string[]>;

export type ParseResult = { value: Json; order: KeyOrder };

export function parseOrdered(text: string): ParseResult {
  const order: KeyOrder = new WeakMap();
  const parser = new Parser(text, order);
  const value = parser.parseValue();
  parser.skipWhitespace();
  if (!parser.atEnd()) parser.fail("Unexpected trailing content");
  return { value, order };
}

class Parser {
  private i = 0;

  constructor(
    private readonly src: string,
    private readonly order: KeyOrder
  ) {}

  atEnd(): boolean {
    return this.i >= this.src.length;
  }

  fail(message: string): never {
    throw new SyntaxError(`${message} at position ${this.i}`);
  }

  skipWhitespace(): void {
    while (this.i < this.src.length) {
      const c = this.src.charCodeAt(this.i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) this.i++;
      else break;
    }
  }

  parseValue(): Json {
    this.skipWhitespace();
    if (this.atEnd()) this.fail("Unexpected end of input");
    const c = this.src[this.i];
    switch (c) {
      case "{":
        return this.parseObject();
      case "[":
        return this.parseArray();
      case '"':
        return this.parseString();
      case "t":
        return this.parseLiteral("true", true);
      case "f":
        return this.parseLiteral("false", false);
      case "n":
        return this.parseLiteral("null", null);
      default:
        return this.parseNumber();
    }
  }

  private parseLiteral<T extends boolean | null>(word: string, value: T): T {
    if (this.src.startsWith(word, this.i)) {
      this.i += word.length;
      return value;
    }
    this.fail(`Expected ${word}`);
  }

  private parseObject(): { [key: string]: Json } {
    this.i++; // {
    const out: { [key: string]: Json } = {};
    const keys: string[] = [];
    this.skipWhitespace();
    if (this.src[this.i] === "}") {
      this.i++;
      this.order.set(out, keys);
      return out;
    }
    for (;;) {
      this.skipWhitespace();
      if (this.src[this.i] !== '"') this.fail("Expected object key");
      const key = this.parseString();
      this.skipWhitespace();
      if (this.src[this.i] !== ":") this.fail("Expected ':'");
      this.i++;
      const value = this.parseValue();
      // A duplicate key overwrites, matching JSON.parse; keep one entry.
      if (!(key in out)) keys.push(key);
      out[key] = value;
      this.skipWhitespace();
      const c = this.src[this.i];
      if (c === ",") {
        this.i++;
        continue;
      }
      if (c === "}") {
        this.i++;
        break;
      }
      this.fail("Expected ',' or '}'");
    }
    this.order.set(out, keys);
    return out;
  }

  private parseArray(): Json[] {
    this.i++; // [
    const out: Json[] = [];
    this.skipWhitespace();
    if (this.src[this.i] === "]") {
      this.i++;
      return out;
    }
    for (;;) {
      out.push(this.parseValue());
      this.skipWhitespace();
      const c = this.src[this.i];
      if (c === ",") {
        this.i++;
        continue;
      }
      if (c === "]") {
        this.i++;
        break;
      }
      this.fail("Expected ',' or ']'");
    }
    return out;
  }

  private parseString(): string {
    const start = this.i;
    this.i++; // opening quote
    let hasEscape = false;
    while (this.i < this.src.length) {
      const c = this.src[this.i];
      if (c === "\\") {
        hasEscape = true;
        this.i += 2;
        continue;
      }
      if (c === '"') {
        this.i++;
        const raw = this.src.slice(start, this.i);
        // Escapes are rare in presets; defer to JSON.parse only when present.
        return hasEscape ? (JSON.parse(raw) as string) : raw.slice(1, -1);
      }
      this.i++;
    }
    this.fail("Unterminated string");
  }

  private parseNumber(): number {
    const start = this.i;
    if (this.src[this.i] === "-") this.i++;
    while (this.i < this.src.length && /[0-9eE+\-.]/.test(this.src[this.i])) this.i++;
    const raw = this.src.slice(start, this.i);
    const value = Number(raw);
    if (raw === "" || Number.isNaN(value)) this.fail(`Invalid number "${raw}"`);
    return value;
  }
}
