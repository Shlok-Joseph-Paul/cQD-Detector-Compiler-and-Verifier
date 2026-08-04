import { Fragment, type ReactNode } from "react";

export interface MaterialLabelProps {
  value: string;
}

/** Render integer and decimal stoichiometries as subscripts. */
export function MaterialLabel({ value }: MaterialLabelProps) {
  const parts: ReactNode[] = value
    .split(/(\d+(?:\.\d+)?)/g)
    .map((part, index) =>
      /^\d+(?:\.\d+)?$/.test(part) ? (
        <sub key={`${part}-${index}`}>{part}</sub>
      ) : (
        <Fragment key={`${part}-${index}`}>{part}</Fragment>
      ),
    );
  return <span className="material-label">{parts}</span>;
}
