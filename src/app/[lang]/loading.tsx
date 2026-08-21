import { Spinner } from "@/components/atoms";
import en from "@/locales/en.json";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mist text-harbor">
      <Spinner size="lg" />
      <span className="sr-only">{en.loading.label}</span>
    </div>
  );
}
