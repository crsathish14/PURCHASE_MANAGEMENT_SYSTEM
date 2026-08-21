// Ref: Design-docs/app/dashboard.html (`.avatar`) — fixed gradient
// background regardless of theme, so text stays hardcoded white rather than
// the `paper` token.
export type AvatarProps = {
  initials: string;
  size?: "sm" | "md";
};

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-[26px] w-[26px] text-[11px]",
  md: "h-8 w-8 text-xs",
};

export function Avatar({ initials, size = "sm" }: AvatarProps) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#3E63E0,#0B2A4A)] font-bold text-white ${SIZE_CLASSES[size]}`}
    >
      {initials}
    </span>
  );
}
