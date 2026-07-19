import { Fragment, type ReactNode } from "react";

export interface MaterialLabelProps {
  value: string;
}

/** Render chemical digits as subscripts while preserving the source label. */
export function MaterialLabel({ value }: MaterialLabelProps) {
  const parts: ReactNode[] = value
    .split(/(\d+)/g)
    .map((part, index) =>
      /^\d+$/.test(part) ? (
        <sub key={`${part}-${index}`}>{part}</sub>
      ) : (
        <Fragment key={`${part}-${index}`}>{part}</Fragment>
      ),
    );
  return <span className="material-label">{parts}</span>;
}
