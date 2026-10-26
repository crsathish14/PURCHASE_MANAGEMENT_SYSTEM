import { createClient } from "@/lib/supabase/server";

export type Vendor = {
  id: string;
  name: string;
  pic: string;
  address: string;
  mail: string[];
  contact: string[];
  gst: string;
  createdAt: string;
};

export async function getVendors(): Promise<Vendor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id, name, pic, address, mail, contact, gst, created_at")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    pic: row.pic,
    address: row.address,
    mail: row.mail,
    contact: row.contact,
    gst: row.gst,
    createdAt: row.created_at,
  }));
}
