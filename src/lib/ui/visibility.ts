export function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.hidden;
}
