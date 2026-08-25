import { createClient } from "@/lib/supabase/server";

export type Vessel = {
  id: string;
  name: string;
  imoNo: string;
  createdAt: string;
};

export async function getVessels(): Promise<Vessel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vessels")
    .select("id, name, imo_no, created_at")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    imoNo: row.imo_no,
    createdAt: row.created_at,
  }));
}
