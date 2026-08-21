import en from "@/locales/en.json";

const STRENGTH_LABELS = [
  en.auth.requestAccess.strength.weak,
  en.auth.requestAccess.strength.weak,
  en.auth.requestAccess.strength.fair,
  en.auth.requestAccess.strength.good,
  en.auth.requestAccess.strength.strong,
];

export function passwordStrength(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password);

  return (
    <div>
      <div className="mt-2 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? "bg-moss" : "bg-line"}`} />
        ))}
      </div>
      <div className="mt-1.25 flex justify-between text-[11px] text-slate-lt">
        <span>{en.auth.requestAccess.strengthLabel}</span>
        {strength > 0 ? <b className="font-bold text-moss">{STRENGTH_LABELS[strength]}</b> : null}
      </div>
    </div>
  );
}
