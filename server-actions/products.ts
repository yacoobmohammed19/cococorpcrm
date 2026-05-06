"use server";

import { revalidatePath } from "next/cache";
import { ProductSchema } from "@/lib/schemas/products";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createProduct(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const parsed = ProductSchema.parse({
    org_id: orgId,
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    description: formData.get("description") || undefined,
    unit_price: formData.get("unit_price"),
    category: formData.get("category") || undefined,
    is_active: formData.get("is_active") !== "false",
  });
  const { error } = await supabase.from("dim_products").insert({
    ...parsed,
    location: (formData.get("location") as string) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/products");
}

export async function updateProduct(id: number, formData: FormData) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_products").update({
    name: formData.get("name"),
    sku: formData.get("sku") || null,
    description: formData.get("description") || null,
    unit_price: Number(formData.get("unit_price")),
    category: formData.get("category") || null,
    is_active: formData.get("is_active") !== "false",
    location: (formData.get("location") as string) || null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/products");
}

export async function deleteProduct(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_products")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/products");
}
