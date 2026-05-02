/**
 * Minimal {{var}} substitution. Sufficient for our notice templates;
 * swap in Handlebars later if templates need conditionals or partials.
 */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

export function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "0.00";
  return (cents / 100).toFixed(2);
}
