import {
  addProduct,
  addVariant,
  deleteProduct as deleteProductRecord,
  deleteVariant,
  getProductsWithVariants,
  updateProduct as updateProductRecord,
} from "./productService";
const listeners = new Set();

function mapProductForUi(row) {
  const rawVariants = Array.isArray(row.variants) ? row.variants : [];
  return {
    id: row.product_id,
    name: row.name || "",
    desc: row.description || "",
    orderNo: row.order_no,
    imageUrl: row.image_url || "",
    variants: rawVariants.map((item) => ({
      variantId: item.variant_id,
      qty: item.variant,
      price: Number(item.price) || 0,
    })),
    createdAt: row.created_at || null,
    updatedAt: null,
  };
}

async function fetchProducts() {
  const rows = await getProductsWithVariants();
  return rows.map(mapProductForUi);
}

async function notifyWithLatest() {
  const items = await fetchProducts();
  listeners.forEach((fn) => fn(items));
}

export function variantSortKey(qty) {
  if (qty === "250gm") return 0;
  if (qty === "500gm") return 1;
  if (qty === "1kg") return 2;
  return 99;
}

export function subscribeProducts(onNext, onError) {
  fetchProducts()
    .then(onNext)
    .catch((err) => {
      if (onError) onError(err);
    });

  listeners.add(onNext);
  return () => listeners.delete(onNext);
}

export async function createProduct({ name, desc, imageFile, orderNo }) {
  const id = await addProduct({
    name,
    description: desc,
    order_no: orderNo ?? null,
    imageFile,
  });
  await notifyWithLatest();
  return id;
}

export async function updateProduct(productId, { name, desc, imageFile, orderNo }) {
  await updateProductRecord(productId, {
    name,
    description: desc,
    order_no: orderNo ?? null,
    imageFile,
  });
  await notifyWithLatest();
}

export async function deleteProduct(productId) {
  await deleteProductRecord(productId);
  await notifyWithLatest();
}

export async function upsertVariant(productId, { qty, price }) {
  const rows = await getProductsWithVariants();
  const product = rows.find((row) => row.product_id === productId);
  if (!product) throw new Error("Product not found.");
  const existing = (product.variants || []).find((item) => item.variant === qty);
  if (existing) {
    await deleteVariant({ variantId: existing.variant_id, productId, variant: qty });
  }
  await addVariant(productId, { variant: qty, price });
  await notifyWithLatest();
}

export async function setProductVariants(productId, variants) {
  const rows = await getProductsWithVariants();
  const product = rows.find((row) => row.product_id === productId);
  if (!product) throw new Error("Product not found.");

  const desiredByQty = new Map((variants || []).map((item) => [item.qty, Number(item.price)]));
  const current = Array.isArray(product.variants) ? product.variants : [];

  for (const item of current) {
    if (!desiredByQty.has(item.variant)) {
      await deleteVariant({ variantId: item.variant_id, productId, variant: item.variant });
      continue;
    }
    const nextPrice = desiredByQty.get(item.variant);
    if (Number(item.price) !== Number(nextPrice)) {
      await deleteVariant({ variantId: item.variant_id, productId, variant: item.variant });
      await addVariant(productId, { variant: item.variant, price: nextPrice });
    }
  }

  const currentQtySet = new Set(current.map((item) => item.variant));
  for (const [qty, price] of desiredByQty.entries()) {
    if (!currentQtySet.has(qty)) {
      await addVariant(productId, { variant: qty, price });
    }
  }

  await notifyWithLatest();
}

