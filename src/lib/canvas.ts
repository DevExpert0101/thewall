export const SERIF = '"Georgia", "Times New Roman", serif';
export const MONO = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
export const SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines?: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n+/);
  for (const para of paragraphs) {
    let line = "";
    const words = para.split(/\s+/);
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
      if (maxLines && lines.length >= maxLines) return lines.slice(0, maxLines);
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
