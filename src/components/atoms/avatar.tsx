// Ref: Design-docs/app/dashboard.html (`.avatar`) — fixed gradient
// background regardless of theme, so text stays hardcoded white rather than
// the `paper` token.
export type AvatarProps = {
  initials: string;
};

export function Avatar({ initials }: AvatarProps) {
  return (
    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#3E63E0,#0B2A4A)] text-[11px] font-bold text-white">
      {initials}
    </span>
  );
}
