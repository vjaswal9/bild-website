// Serialises structured data for a <script type="application/ld+json"> tag.
//
// JSON.stringify leaves "<" alone, so a business whose name or description
// contained a closing script tag followed by its own script would close the
// tag early and run that script on the public page. Escaping "<" (and the two
// line separators some parsers treat as newlines) as unicode escapes keeps the
// JSON identical for search engines but makes breaking out impossible.
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
