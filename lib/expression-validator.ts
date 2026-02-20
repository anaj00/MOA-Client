const TOKEN_REGEX = /#\{[^}]+\}/g;
const TOKEN_FORMAT_REGEX = /^#\{[a-zA-Z0-9_.:-]+(?:\([a-zA-Z0-9_.]+\))?\}$/;

function hasBalancedPairs(value: string, open: string, close: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === open) depth += 1;
    if (ch === close) depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function hasBalancedQuotes(value: string): boolean {
  let singleOpen = false;
  let doubleOpen = false;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const prev = value[i - 1];
    if (ch === "'" && prev !== "\\" && !doubleOpen) singleOpen = !singleOpen;
    if (ch === '"' && prev !== "\\" && !singleOpen) doubleOpen = !doubleOpen;
  }

  return !singleOpen && !doubleOpen;
}

export function validateExpression(value: string): { valid: boolean; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true };

  if (!trimmed.includes("=>")) {
    return { valid: false, message: "Expression must use arrow function syntax, e.g. `() => ...`." };
  }

  if (!hasBalancedPairs(trimmed, "(", ")") || !hasBalancedPairs(trimmed, "{", "}")) {
    return { valid: false, message: "Expression has unbalanced parentheses or braces." };
  }

  if (!hasBalancedQuotes(trimmed)) {
    return { valid: false, message: "Expression has unbalanced quotes." };
  }

  const tokens = trimmed.match(TOKEN_REGEX) || [];
  for (const token of tokens) {
    if (!TOKEN_FORMAT_REGEX.test(token)) {
      return { valid: false, message: `Invalid token format: ${token}` };
    }
  }

  return { valid: true };
}
