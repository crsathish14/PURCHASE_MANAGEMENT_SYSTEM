// Red asterisk marking a mandatory field. Purely visual (aria-hidden): the
// forms use noValidate + Zod, so there's no native `required` attribute to
// pair it with. Used by Label's `required` prop, and directly inside table
// headers / section headings that aren't a Label.
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-rust">
      *
    </span>
  );
}
