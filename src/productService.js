import { supabase } from "./supabaseClient";

const PRODUCT_TABLE = "tbl_product";
const VARIANT_TABLE = "tbl_variant";
const IMAGE_BUCKET = "product-images";

function mapVariantRow(row) {
  return {
    variant_id: row.variant_id,
    product_id: row.product_id,
    variant: row.variant,
    price: Number(row.price) || 0,
  };
}

function mapProductRow(row) {
  const variants = Array.isArray(row.tbl_variant) ? row.tbl_variant.map(mapVariantRow) : [];
  return {
    product_id: row.product_id,
    name: row.name || "",
    description: row.description || "",
    order_no: row.order_no,
    image_url: row.image_url || "",
    created_at: row.created_at || null,
    variants,
  };
}

export async function uploadImage(file) {
  const fileName = `${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(fileName, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

export async function addProduct({ name, description, order_no, image_url, imageFile }) {
  let nextImageUrl = image_url || "";
  if (imageFile) {
    nextImageUrl = await uploadImage(imageFile);
  }

  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .insert([
      {
        name,
        description,
        order_no: order_no ?? null,
        image_url: nextImageUrl,
      },
    ])
    .select("product_id")
    .single();

  if (error) throw error;
  return data.product_id;
}

export async function addVariant(productId, { variant, price }) {
  const { data, error } = await supabase
    .from(VARIANT_TABLE)
    .insert([
      {
        product_id: productId,
        variant,
        price,
      },
    ])
    .select("variant_id, product_id, variant, price")
    .single();

  if (error) throw error;
  return mapVariantRow(data);
}

export async function getProductsWithVariants() {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select("product_id, name, description, order_no, image_url, created_at, tbl_variant(variant_id, product_id, variant, price)")
    .order("order_no", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data || []).map(mapProductRow);
}

export async function deleteVariant({ variantId, productId, variant }) {
  let query = supabase.from(VARIANT_TABLE).delete();
  if (variantId != null) {
    query = query.eq("variant_id", variantId);
  } else {
    query = query.eq("product_id", productId).eq("variant", variant);
  }
  const { error } = await query;
  if (error) throw error;
}

export async function deleteProduct(productId) {
  const { error: variantError } = await supabase.from(VARIANT_TABLE).delete().eq("product_id", productId);
  if (variantError) throw variantError;

  const { error: productError } = await supabase.from(PRODUCT_TABLE).delete().eq("product_id", productId);
  if (productError) throw productError;
}

export async function updateProduct(productId, { name, description, order_no, imageFile }) {
  const payload = {
    name,
    description,
    order_no: order_no ?? null,
  };

  if (imageFile) {
    payload.image_url = await uploadImage(imageFile);
  }

  const { error } = await supabase.from(PRODUCT_TABLE).update(payload).eq("product_id", productId);
  if (error) throw error;
}
