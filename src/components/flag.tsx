import { cn } from "@/lib/cn";
import { isoForFifa } from "@/lib/flags";

/**
 * Renders a country flag as an icon (flag-icons SVG sprite) from a FIFA code.
 * `size` is the flag height in pixels (width follows the 4:3 ratio).
 */
export function Flag({
  code,
  size = 18,
  className,
  title,
}: {
  code?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const iso = isoForFifa(code);

  if (!iso) {
    // Fallback for undefined teams / unmapped codes.
    return (
      <span
        title={title}
        className={cn(
          "inline-block rounded-[2px] bg-muted align-middle",
          className,
        )}
        style={{ width: size * 1.333, height: size }}
      />
    );
  }

  return (
    <span
      title={title}
      className={cn("fi", `fi-${iso}`, "rounded-[2px] align-middle shadow-sm", className)}
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
    />
  );
}
