import { isDefaultWallTitle, wallTitle } from "@/lib/utils";

export function MonumentTitle({
  title,
  className,
}: {
  title?: string | null;
  className?: string;
}) {
  const name = wallTitle({ title });
  if (isDefaultWallTitle(name)) {
    return (
      <h1 className={className ?? "monument-title"}>
        <span className="monument-the">THE</span>
        <span className="monument-wall">WALL</span>
      </h1>
    );
  }
  return (
    <h1 className={className ?? "monument-title"} data-custom="true">
      <span className="monument-wall">{name}</span>
    </h1>
  );
}
