import { LOGO_R_PATH, LOGO_R_VIEWBOX } from "./logo-r-path";

type LogoRProps = {
  className?: string;
  /**
   * Accessible name when the R stands alone. Omit when it sits next to text
   * (inside <Logo /> or a labelled link) so it stays decorative.
   */
  title?: string;
};

/** Official Tech Resolute "R". Color comes from the text color (currentColor). */
export function LogoR({ className, title }: LogoRProps) {
  const a11y = title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true, focusable: false } as const);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={LOGO_R_VIEWBOX}
      fill="currentColor"
      className={className}
      {...a11y}
    >
      <path d={LOGO_R_PATH} />
    </svg>
  );
}
