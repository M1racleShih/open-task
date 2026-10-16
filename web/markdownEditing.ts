export type MarkdownTool = "bold" | "list" | "link";

export const textareaText = (text: string) => text.replace(/\r\n?/g, "\n");

/** Browsers normalize textarea newlines; map their UTF-16 offsets back to source. */
export function sourceOffset(text: string, offset: number) {
  let source = 0;
  for (
    let index = 0;
    index < offset && source < text.length;
    index++, source++
  ) {
    if (text[source] === "\r" && text[source + 1] === "\n") source++;
  }
  return source;
}

/** Preserve untouched source (including CRLF) around an ordinary textarea edit. */
export function editMarkdown(text: string, next: string) {
  const previous = textareaText(text);
  let start = 0;
  while (
    start < previous.length &&
    start < next.length &&
    previous[start] === next[start]
  )
    start++;
  let end = previous.length,
    nextEnd = next.length;
  while (
    end > start &&
    nextEnd > start &&
    previous[end - 1] === next[nextEnd - 1]
  ) {
    end--;
    nextEnd--;
  }
  const newline = text.match(/\r\n?|\n/)?.[0] ?? "\n";
  return (
    text.slice(0, sourceOffset(text, start)) +
    next.slice(start, nextEnd).replace(/\n/g, newline) +
    text.slice(sourceOffset(text, end))
  );
}

/** Only an explicit formatting command changes source; offsets refer to source. */
export function formatMarkdown(
  text: string,
  start: number,
  end: number,
  tool: MarkdownTool,
) {
  const selected = text.slice(start, end);
  if (tool === "list") {
    const before = text.slice(0, start);
    const lineStart =
      Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r")) + 1;
    // A selection ending at the next line's start does not include that line.
    const lineEnd =
      end > start && /[\r\n]/.test(text[end - 1])
        ? end - (text.slice(end - 2, end) === "\r\n" ? 2 : 1)
        : end;
    const fragment = text.slice(lineStart, lineEnd);
    const replacement = "- " + fragment.replace(/\r\n?|\n/g, "$&- ");
    return {
      text: text.slice(0, lineStart) + replacement + text.slice(lineEnd),
      start: start + 2,
      end: end + replacement.length - fragment.length,
    };
  }
  const replacement =
    tool === "bold" ? `**${selected}**` : `[${selected}](https://)`;
  return {
    text: text.slice(0, start) + replacement + text.slice(end),
    start: tool === "bold" ? start + 2 : start + selected.length + 3,
    end: tool === "bold" ? end + 2 : start + selected.length + 11,
  };
}
