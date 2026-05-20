/**
 * Returns the visible character count of a markdown string,
 * stripping syntax that is hidden when rendered (e.g. link URLs, image URLs).
 *
 * This is used for character limit validation so that hidden markdown
 * syntax doesn't count against the user's character budget.
 */
export function markdownVisibleLength(text: string): number {
  return stripMarkdownSyntax(text).length;
}

function stripMarkdownSyntax(text: string): string {
  let result = text;
  // Images: ![alt](url) → alt
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links: [text](url) → text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  return result;
}
