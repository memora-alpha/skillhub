// API stores plain text: first line is the title; remaining lines are optional detail.
export function sessionContentParts(content: string) {
  const index = content.indexOf("\n");
  return index < 0
    ? { title: content, description: "" }
    : {
        title: content.slice(0, index).replace(/\r$/, ""),
        description: content.slice(index + 1),
      };
}
export function sessionContentText(title: string, description: string) {
  const heading = title.replace(/[\r\n]+/g, " ");
  return description ? `${heading}\n${description}` : heading;
}
