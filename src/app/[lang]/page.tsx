import en from "@/locales/en.json";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastDemo } from "@/components/toast-demo";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
} from "@/components/atoms";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-mist px-6 py-16">
      <div className="w-full max-w-md rounded-lg border border-line bg-paper p-10 text-center shadow-(--shadow-e1)">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-harbor text-sm font-bold text-paper">
          P
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
          {en.home.title}
        </h1>
        <p className="mt-2 text-sm text-slate">{en.home.subtitle}</p>
        <div className="mt-6 flex justify-center">
          <ThemeToggle />
        </div>
      </div>

      <div className="w-full max-w-md rounded-lg border border-line bg-paper p-8 shadow-(--shadow-e1)">
        <h2 className="font-display text-lg font-semibold text-ink">
          Foundation components
        </h2>
        <p className="mt-1 text-xs text-slate">
          src/components/atoms — ported from Design-docs/design-spec.html
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">
            Create PO Request
          </Button>
          <Button variant="secondary" size="sm">
            Save draft
          </Button>
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
          <Button variant="danger" size="sm">
            Reject
          </Button>
          <Button variant="icon" aria-label="More actions">
            ⋮
          </Button>
          <Button variant="primary" size="sm" loading aria-label="Submitting">
            Submitting
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="amber">Pending RFQ</Badge>
          <Badge tone="teal">RFQ Issued</Badge>
          <Badge tone="moss">Awarded</Badge>
          <Badge tone="harbor">PO Raised</Badge>
          <Badge tone="rust">Overdue</Badge>
          <Badge tone="slate">Awaiting</Badge>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Avatar initials="AR" />
          <div className="text-left">
            <p className="text-xs font-bold text-ink">Arjun Rao</p>
            <p className="text-[11px] text-slate-lt">Procurement Officer</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <Label htmlFor="preview-vessel">Vessel</Label>
            <Select id="preview-vessel" defaultValue="mv-aster">
              <option value="mv-aster">MV Aster</option>
              <option value="mv-orion">MV Orion</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="preview-required-by" error>
              Required by
            </Label>
            <Input
              id="preview-required-by"
              defaultValue="14 Jul"
              error="Date can't be in the past"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink">
            <Checkbox defaultChecked />
            Notify me when a vendor responds
          </label>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <ToastDemo />
        </div>
      </div>
    </div>
  );
}
