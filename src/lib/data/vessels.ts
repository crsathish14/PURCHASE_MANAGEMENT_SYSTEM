import { createClient } from "@/lib/supabase/server";

export type Vessel = {
  id: string;
  name: string;
  imoNo: string;
  // Null for vessels created before PO numbers existed, until an admin sets it.
  vesselCode: string | null;
  masterOwners: string;
  companyName: string;
  address: string;
  createdAt: string;
};

export async function getVessels(): Promise<Vessel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vessels")
    .select("id, name, imo_no, vessel_code, master_owners, company_name, address, created_at")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    imoNo: row.imo_no,
    vesselCode: row.vessel_code,
    masterOwners: row.master_owners,
    companyName: row.company_name,
    address: row.address,
    createdAt: row.created_at,
  }));
}
