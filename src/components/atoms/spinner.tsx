export type SpinnerSize = "sm" | "lg";

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export type SpinnerProps = {
  size?: SpinnerSize;
};

export function Spinner({ size = "sm" }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`animate-spin rounded-full border-current border-t-transparent ${SIZE_CLASSES[size]}`}
    />
  );
}
