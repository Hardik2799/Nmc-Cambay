import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  FaBoxOpen,
  FaChevronDown,
  FaCheck,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaFacebook,
  FaInstagram,
  FaLock,
  FaMapLocationDot,
  FaPenToSquare,
  FaPhone,
  FaShareNodes,
  FaTrashCan,
  FaWhatsapp,
  FaXmark,
} from "react-icons/fa6";
import { createProduct, deleteProduct, setProductVariants, subscribeProducts, updateProduct, variantSortKey } from "./productsStore";

const whatsappUrl = "https://wa.me/c/919825412940";
const mapsDestination = "NANALAL MAGANLAL CHAVANAWALA, Gawara Rd, Vasda Wad, Rana Chakla, Khambhat, Gujarat 388620";
const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent("My Location")}&destination=${encodeURIComponent(mapsDestination)}&travelmode=driving`;
const ADMIN_USER = "nanamagan1950@gmail.com";
const ADMIN_PASS = "nmc.cambay@1950";
const ADMIN_SESSION_KEY = "nmc_admin_authed_v1";
const VARIANT_OPTIONS = ["250gm", "500gm", "1kg"];
const DESC_PREVIEW_MAX_WORDS = 5;

function DescriptionExcerpt({
  text,
  className = "",
  variant = "public",
  empty = null,
  expanded,
  onToggleExpanded,
  dialogMode = false,
}) {
  const [expandedLocal, setExpandedLocal] = useState(false);
  const isControlled = typeof expanded === "boolean" && typeof onToggleExpanded === "function";
  const isExpanded = isControlled ? expanded : expandedLocal;
  const { needsTruncate, preview, full } = useMemo(() => {
    const t = (text || "").trim();
    if (!t) return { needsTruncate: false, preview: "", full: "" };
    const words = t.split(/\s+/);
    if (words.length <= DESC_PREVIEW_MAX_WORDS) {
      return { needsTruncate: false, preview: t, full: t };
    }
    return { needsTruncate: true, preview: words.slice(0, DESC_PREVIEW_MAX_WORDS).join(" "), full: t };
  }, [text]);

  if (!(text || "").trim()) {
    if (empty === null) return null;
    return <span className="admin-muted">{empty}</span>;
  }

  const Tag = variant === "admin" ? "div" : "p";
  if (!needsTruncate) {
    return <Tag className={className}>{full}</Tag>;
  }

  const excerptText = dialogMode ? `${preview}...` : isExpanded ? full : `${preview}...`;

  return (
    <Tag className={className}>
      <span className="desc-excerpt-text">{excerptText}</span>{" "}
      <button
        type="button"
        className="desc-read-more"
        onClick={(e) => {
          e.stopPropagation();
          if (dialogMode) {
            onToggleExpanded?.();
            return;
          }
          if (isControlled) {
            onToggleExpanded();
            return;
          }
          setExpandedLocal((prev) => !prev);
        }}
        aria-expanded={dialogMode ? false : isExpanded}
        aria-label={dialogMode ? "Read full description in dialog" : isExpanded ? "Show less description" : "Read full description"}
      >
        {dialogMode ? "Read more" : isExpanded ? "Show less" : "Read more"}
      </button>
    </Tag>
  );
}

function sortProductsByOrder(list) {
  return [...list].sort((a, b) => {
    const aOrder = Number(a.orderNo);
    const bOrder = Number(b.orderNo);
    const aHasOrder = Number.isFinite(aOrder);
    const bHasOrder = Number.isFinite(bOrder);
    if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder;
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function sortVariants(variants = []) {
  return [...variants].sort((a, b) => {
    const aPrice = Number(a.price);
    const bPrice = Number(b.price);
    if (Number.isFinite(aPrice) && Number.isFinite(bPrice) && aPrice !== bPrice) {
      return aPrice - bPrice;
    }
    return variantSortKey(a.qty) - variantSortKey(b.qty);
  });
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toFixed(0);
}

function buildWhatsAppOrderUrl(items) {
  const lines = [];
  lines.push("NMC Order");
  lines.push("");
  let total = 0;
  for (const item of items) {
    const lineTotal = item.qty * item.price;
    total += lineTotal;
    lines.push(`- ${item.name} (${item.variant}) x ${item.qty} = ₹${formatMoney(lineTotal)}`);
  }
  lines.push("");
  lines.push(`Total: ₹${formatMoney(total)}`);
  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/919825412940?text=${text}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
  const formValidationText = [fieldErrors.email, fieldErrors.password].filter(Boolean).join(" ");

  const validate = () => {
    const nextErrors = { email: "", password: "" };
    const normalizedEmail = email.trim().toLowerCase();
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    const hasMinPasswordLength = password.length >= 8;
    const hasPasswordLetter = /[a-zA-Z]/.test(password);
    const hasPasswordNumber = /\d/.test(password);

    if (!normalizedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!isEmailValid) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (!hasMinPasswordLength || !hasPasswordLetter || !hasPasswordNumber) {
      nextErrors.password = "Password must be 8+ characters with letters and numbers.";
    }

    return { nextErrors, normalizedEmail, isValid: !nextErrors.email && !nextErrors.password };
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const { nextErrors, normalizedEmail, isValid } = validate();
    setFieldErrors(nextErrors);

    if (!isValid) {
      setError("");
      return;
    }

    if (normalizedEmail === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      setAuthed(true);
      setError("");
      return;
    }
    setError("Invalid credentials.");
  };

  const onLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthed(false);
  };

  if (!authed) {
    return (
      <div className="admin-shell admin-login-shell">
        <div className="admin-card admin-login-card">
          <div className="admin-login-brand">
            <img className="admin-login-logo" src="/nmc-logo-main.png" alt="NMC logo" />
          </div>
          <h2 className="admin-title">Admin Login</h2>
          <p className="admin-subtitle">Enter admin credentials to manage products.</p>
          <form className="admin-form admin-login-form" onSubmit={onSubmit} noValidate>
            <label className="admin-label">
              Email
              <div className="admin-input-wrap">
                <FaEnvelope className="admin-input-icon" aria-hidden="true" />
                <input
                  className={`admin-input admin-input-with-icon ${fieldErrors.email ? "admin-input-error" : ""}`}
                  type="email"
                  value={email}
                  placeholder="name@example.com"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                />
              </div>
            </label>

            <label className="admin-label">
              Password
              <div className="admin-input-wrap">
                <FaLock className="admin-input-icon" aria-hidden="true" />
                <input
                  className={`admin-input admin-input-with-icon admin-password-input ${fieldErrors.password ? "admin-input-error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                </button>
              </div>
            </label>
            {formValidationText ? <p className="admin-error admin-form-error-box">{formValidationText}</p> : null}
            <p className="admin-muted">Use your registered admin email and password.</p>
            {error ? <p className="admin-error admin-form-error-box">{error}</p> : null}
            <button className="btn btn-primary admin-submit" type="submit">
              Login
            </button>
          </form>
          <a className="admin-home" href="/">
            ← Back to website
          </a>
        </div>
      </div>
    );
  }

  return <AdminPanel onLogout={onLogout} />;
}

function AdminPanel({ onLogout }) {
  const [items, setItems] = useState([]);
  const [orderNo, setOrderNo] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [selectedImageSrc, setSelectedImageSrc] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [expandedAdminDescriptionId, setExpandedAdminDescriptionId] = useState(null);
  const [variantQty, setVariantQty] = useState(VARIANT_OPTIONS[0]);
  const [variantPrice, setVariantPrice] = useState("");
  const [variantDraftPrices, setVariantDraftPrices] = useState({});
  const [editingVariantKey, setEditingVariantKey] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [tableSort, setTableSort] = useState({ key: "orderNo", direction: "asc" });
  const imageInputRef = useRef(null);
  const DESCRIPTION_MAX_LENGTH = 5000;

  const showSuccess = (message) => {
    setSuccessMessage(message);
  };

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    const unsub = subscribeProducts(
      (next) => setItems(next),
      (e) => setError(e?.message || "Failed to load products.")
    );
    return () => unsub();
  }, []);

  const selectedProduct = items.find((p) => p.id === selectedProductId) || null;
  const sortedItems = useMemo(() => {
    const base = items.map((item) => ({
      ...item,
      sortedVariants: sortVariants(item.variants || []),
    }));

    const dir = tableSort.direction === "asc" ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      if (tableSort.key === "orderNo") {
        const aOrder = Number(a.orderNo);
        const bOrder = Number(b.orderNo);
        const aHas = Number.isFinite(aOrder);
        const bHas = Number.isFinite(bOrder);
        if (aHas && bHas && aOrder !== bOrder) return (aOrder - bOrder) * dir;
        if (aHas !== bHas) return (aHas ? -1 : 1) * dir;
        return (a.name || "").localeCompare(b.name || "") * dir;
      }

      if (tableSort.key === "name") return (a.name || "").localeCompare(b.name || "") * dir;
      if (tableSort.key === "desc") return (a.desc || "").localeCompare(b.desc || "") * dir;
      if (tableSort.key === "variants") return (((a.variants || []).length - (b.variants || []).length) * dir);
      return 0;
    });

    return sorted;
  }, [items, tableSort]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter((item) => {
      const nameMatch = (item.name || "").toLowerCase().includes(q);
      const descMatch = (item.desc || "").toLowerCase().includes(q);
      const variantMatch = (item.sortedVariants || []).some((v) => {
        const qtyMatch = String(v.qty || "").toLowerCase().includes(q);
        const priceMatch = String(v.price ?? "").toLowerCase().includes(q);
        return qtyMatch || priceMatch;
      });
      return nameMatch || descMatch || variantMatch;
    });
  }, [sortedItems, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);
  const pageStart = filteredItems.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const pageEnd = filteredItems.length === 0 ? 0 : Math.min(currentPage * itemsPerPage, filteredItems.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const toggleTableSort = (key) => {
    setTableSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortIndicator = (key) => {
    if (tableSort.key !== key) return "↕";
    return tableSort.direction === "asc" ? "↑" : "↓";
  };

  const getAvailableVariantQty = (product, preferredQty) => {
    const used = new Set((product?.variants || []).map((v) => v.qty));
    if (preferredQty && !used.has(preferredQty)) return preferredQty;
    return VARIANT_OPTIONS.find((opt) => !used.has(opt)) || "";
  };

  useEffect(() => {
    if (!expandedProductId) return;
    const expandedProduct = items.find((p) => p.id === expandedProductId);
    if (!expandedProduct) return;
    const nextQty = getAvailableVariantQty(expandedProduct, variantQty);
    if (nextQty && nextQty !== variantQty) setVariantQty(nextQty);
  }, [expandedProductId, items, variantQty]);

  useEffect(() => {
    if (!selectedProductId) {
      setOrderNo("");
      setName("");
      setDesc("");
      setSelectedImageFile(null);
      setSelectedImageName("");
      setSelectedImageSrc("");
      return;
    }
    if (!selectedProduct) {
      setOrderNo("");
      setName("");
      setDesc("");
      setSelectedImageFile(null);
      setSelectedImageName("");
      setSelectedImageSrc("");
      return;
    }
    setOrderNo(selectedProduct.orderNo != null ? String(selectedProduct.orderNo) : "");
    setName(selectedProduct.name || "");
    setDesc(selectedProduct.desc || "");
    setSelectedImageFile(null);
    setSelectedImageName("");
    setSelectedImageSrc("");
  }, [selectedProductId, selectedProduct]);

  const openAddForm = () => {
    setSelectedProductId(null);
    setOrderNo("");
    setName("");
    setDesc("");
    setSelectedImageFile(null);
    setSelectedImageName("");
    setSelectedImageSrc("");
    setError("");
    setIsProductFormOpen(true);
  };

  const openEditForm = (product) => {
    setSelectedProductId(product.id);
    setOrderNo(product.orderNo != null ? String(product.orderNo) : "");
    setName(product.name || "");
    setDesc(product.desc || "");
    setSelectedImageFile(null);
    setSelectedImageName("");
    setSelectedImageSrc("");
    setError("");
    setIsProductFormOpen(true);
  };

  const closeProductForm = () => {
    setIsProductFormOpen(false);
    setSelectedImageFile(null);
    setSelectedImageName("");
    setSelectedImageSrc("");
    setError("");
  };

  const onImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedImageFile(file);
      setSelectedImageName(file.name);
      setSelectedImageSrc(dataUrl);
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to load image.");
    }
  };

  const clearSelectedImage = () => {
    setSelectedImageFile(null);
    setSelectedImageName("");
    setSelectedImageSrc("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const addProduct = async () => {
    const trimmed = name.trim();
    const orderNoValue = orderNo.trim() === "" ? null : Number(orderNo);
    const trimmedDesc = desc.trim();
    if (!trimmed) {
      setError("Product name is required.");
      return;
    }
    if (!selectedImageSrc || !selectedImageFile) {
      setError("Product image is required.");
      return;
    }
    if (orderNoValue === null || !Number.isInteger(orderNoValue) || orderNoValue < 1) {
      setError("Order No is required and must be a positive integer.");
      return;
    }
    if (trimmedDesc.length > DESCRIPTION_MAX_LENGTH) {
      setError(`Description can be maximum ${DESCRIPTION_MAX_LENGTH} characters.`);
      return;
    }
    setError("");
    try {
      const id = await createProduct({ name: trimmed, desc: trimmedDesc, imageFile: selectedImageFile, orderNo: orderNoValue });
      setOrderNo("");
      setName("");
      setDesc("");
      setSelectedImageFile(null);
      setSelectedImageName("");
      setSelectedImageSrc("");
      setSelectedProductId(id);
      setIsProductFormOpen(false);
      showSuccess("Product added successfully.");
    } catch (e) {
      setError(e?.message || "Failed to add product.");
    }
  };

  const saveProduct = async () => {
    const trimmed = name.trim();
    if (!selectedProductId) return;
    const orderNoValue = orderNo.trim() === "" ? null : Number(orderNo);
    const trimmedDesc = desc.trim();
    const hasExistingImage = Boolean(selectedProduct?.imageUrl);
    if (!trimmed) {
      setError("Product name is required.");
      return;
    }
    if (!selectedImageSrc && !hasExistingImage) {
      setError("Product image is required.");
      return;
    }
    if (orderNoValue === null || !Number.isInteger(orderNoValue) || orderNoValue < 1) {
      setError("Order No is required and must be a positive integer.");
      return;
    }
    if (trimmedDesc.length > DESCRIPTION_MAX_LENGTH) {
      setError(`Description can be maximum ${DESCRIPTION_MAX_LENGTH} characters.`);
      return;
    }
    setError("");
    try {
      let nextImageFile = null;
      if (selectedImageSrc) nextImageFile = selectedImageFile;
      await updateProduct(selectedProductId, { name: trimmed, desc: trimmedDesc, imageFile: nextImageFile, orderNo: orderNoValue });
      setSelectedImageFile(null);
      setSelectedImageName("");
      setSelectedImageSrc("");
      setIsProductFormOpen(false);
      showSuccess("Product updated successfully.");
    } catch (e) {
      setError(e?.message || "Failed to update product.");
    }
  };

  const removeProduct = async (id) => {
    setError("");
    try {
      await deleteProduct(id);
      if (selectedProductId === id) {
        setSelectedProductId(null);
        setOrderNo("");
        setName("");
        setDesc("");
        setSelectedImageFile(null);
        setSelectedImageName("");
        setSelectedImageSrc("");
      }
      if (expandedProductId === id) setExpandedProductId(null);
      showSuccess("Product deleted successfully.");
    } catch (e) {
      setError(e?.message || "Failed to delete product.");
    }
  };

  const addOrUpdateVariant = async (productId) => {
    const priceNum = Number(variantPrice);
    if (!productId) return;
    if (!Number.isFinite(priceNum) || priceNum <= 0) return;
    const current = items.find((p) => p.id === productId);
    if (!current) return;
    const duplicateCount = (current.variants || []).filter((v) => v.qty === variantQty).length;
    if (duplicateCount > 0) {
      setError(`${variantQty} already exists for this product. Edit it instead of adding a duplicate.`);
      return;
    }
    const nextVariants = [...(current.variants || []), { qty: variantQty, price: priceNum }];
    setError("");
    try {
      await setProductVariants(productId, nextVariants);
      setVariantPrice("");
      showSuccess("Variant added successfully.");
    } catch (e) {
      setError(e?.message || "Failed to save variant.");
    }
  };

  const removeVariant = async (productId, qty) => {
    const current = items.find((p) => p.id === productId);
    if (!current) return;
    const nextVariants = (current.variants || []).filter((v) => v.qty !== qty);
    setError("");
    try {
      await setProductVariants(productId, nextVariants);
      showSuccess("Variant deleted successfully.");
    } catch (e) {
      setError(e?.message || "Failed to remove variant.");
    }
  };

  const updateVariantPrice = async (productId, qty) => {
    const current = items.find((p) => p.id === productId);
    if (!current) return;
    const key = `${productId}__${qty}`;
    const priceNum = Number(variantDraftPrices[key]);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return;
    const nextVariants = (current.variants || []).map((v) => (v.qty === qty ? { ...v, price: priceNum } : v));
    setError("");
    try {
      await setProductVariants(productId, nextVariants);
      setEditingVariantKey(null);
      showSuccess("Variant updated successfully.");
    } catch (e) {
      setError(e?.message || "Failed to update variant.");
    }
  };

  const modalPreviewUrl = useMemo(() => {
    if (selectedImageSrc) return selectedImageSrc;
    if (selectedProductId && selectedProduct?.imageUrl) return selectedProduct.imageUrl;
    return "";
  }, [selectedImageSrc, selectedProductId, selectedProduct]);
  const imageError = error.includes("image") ? error : "";
  const orderNoError = error.includes("Order No") ? error : "";
  const formGeneralError = error && !orderNoError && !imageError ? error : "";

  const requestDeleteProduct = (product) => {
    setConfirmDialog({
      type: "product",
      productId: product.id,
      title: "Delete Product",
      message: `Are you sure you want to delete ${product.name}? This action cannot be undone.`,
      confirmLabel: "Delete Product",
    });
  };

  const requestDeleteVariant = (product, qty) => {
    setConfirmDialog({
      type: "variant",
      productId: product.id,
      qty,
      title: "Delete Variant",
      message: `Are you sure you want to delete the ${qty} variant from ${product.name}?`,
      confirmLabel: "Delete Variant",
    });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === "product") {
      await removeProduct(confirmDialog.productId);
    } else if (confirmDialog.type === "variant") {
      await removeVariant(confirmDialog.productId, confirmDialog.qty);
    }
    setConfirmDialog(null);
  };

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div>
          <p className="admin-title">Admin</p>
          <p className="admin-subtitle">Manage products & variants</p>
        </div>
        <div className="admin-topbar-actions">
          <a className="btn btn-outline admin-view-website-btn" href="/">
            View website
          </a>
          <button className="btn btn-outline admin-logout-btn" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="admin-grid admin-grid-table">
        <div className="admin-card admin-table-wrap">
          <div className="admin-table-head">
            <h3 className="admin-card-title">Products Table</h3>
            <button className="btn btn-primary btn-sm" type="button" onClick={openAddForm}>
              Add Product
            </button>
          </div>
          <div className="admin-table-filters">
            <input
              className="admin-input admin-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product, description, variant qty, or variant price"
            />
          </div>
          {filteredItems.length === 0 ? (
            <p className="admin-muted">No products yet.</p>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th aria-label="Expand" />
                    <th>
                      <button type="button" className="admin-sort-btn" onClick={() => toggleTableSort("orderNo")}>
                        <span>Order No</span>
                        <span className="admin-sort-icon">{sortIndicator("orderNo")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-btn" onClick={() => toggleTableSort("name")}>
                        <span>Product</span>
                        <span className="admin-sort-icon">{sortIndicator("name")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-btn" onClick={() => toggleTableSort("desc")}>
                        <span>Description</span>
                        <span className="admin-sort-icon">{sortIndicator("desc")}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-sort-btn" onClick={() => toggleTableSort("variants")}>
                        <span>Variants</span>
                        <span className="admin-sort-icon">{sortIndicator("variants")}</span>
                      </button>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((p) => {
                  const isExpanded = expandedProductId === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr
                        className={`admin-product-row ${selectedProductId === p.id ? "selected" : ""} ${isExpanded ? "expanded" : ""}`}
                        onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                      >
                        <td>
                          <button
                            type="button"
                            className="admin-icon-btn admin-expand-trigger admin-variant-expand-btn"
                            aria-label={isExpanded ? "Collapse variants" : "Expand variants"}
                            title={isExpanded ? "Collapse variants" : "Expand variants"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedProductId(isExpanded ? null : p.id);
                            }}
                          >
                            <FaChevronDown className={`admin-expand-icon ${isExpanded ? "rotated" : ""}`} aria-hidden="true" />
                          </button>
                        </td>
                        <td>{p.orderNo != null ? p.orderNo : "-"}</td>
                        <td>{p.name}</td>
                        <td className="admin-td-desc">
                          <DescriptionExcerpt
                            text={p.desc}
                            variant="admin"
                            className="admin-table-desc"
                            empty="-"
                            expanded={expandedAdminDescriptionId === p.id}
                            onToggleExpanded={() =>
                              setExpandedAdminDescriptionId((prev) => (prev === p.id ? null : p.id))
                            }
                          />
                        </td>
                        <td>{(p.variants || []).length}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="admin-icon-btn admin-row-action-btn"
                              aria-label="Edit product"
                              title="Edit product"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditForm(p);
                              }}
                            >
                              <FaPenToSquare aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="admin-icon-btn admin-icon-btn-danger admin-row-action-btn admin-row-action-btn-danger"
                              aria-label="Delete product"
                              title="Delete product"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteProduct(p);
                              }}
                            >
                              <FaTrashCan aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr className={`admin-expand-row ${isExpanded ? "open" : ""}`}>
                        <td colSpan={6}>
                          <div className={`admin-expand-inner ${isExpanded ? "open" : ""}`}>
                            <div className="admin-subgrid">
                              <div className="admin-variant-row">
                                <label className="admin-label">
                                  Quantity
                                  <select
                                    className="admin-input"
                                    value={variantQty}
                                    onChange={(e) => setVariantQty(e.target.value)}
                                    disabled={VARIANT_OPTIONS.every((opt) => (p.variants || []).some((v) => v.qty === opt))}
                                  >
                                    {VARIANT_OPTIONS.map((v) => (
                                      <option key={v} value={v} disabled={(p.variants || []).some((existing) => existing.qty === v)}>
                                        {v}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="admin-label">
                                  Price
                                  <input
                                    className="admin-input"
                                    inputMode="numeric"
                                    value={variantPrice}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (/^\d*$/.test(value)) setVariantPrice(value);
                                    }}
                                    placeholder="e.g. 120"
                                  />
                                </label>
                                <button
                                  className="btn btn-primary admin-variant-add"
                                  type="button"
                                  onClick={() => addOrUpdateVariant(p.id)}
                                  disabled={VARIANT_OPTIONS.every((opt) => (p.variants || []).some((v) => v.qty === opt))}
                                >
                                  Add Variant
                                </button>
                              </div>
                              {VARIANT_OPTIONS.every((opt) => (p.variants || []).some((v) => v.qty === opt)) ? (
                                <p className="admin-muted admin-variant-all-added">All quantity options are already added for this product.</p>
                              ) : null}

                              <div className="admin-variant-list">
                                {(p.sortedVariants || []).map((v) => {
                                  const draftKey = `${p.id}__${v.qty}`;
                                  const isEditing = editingVariantKey === draftKey;
                                  return (
                                    <div key={v.qty} className="admin-variant-item">
                                      <p className="admin-list-title">
                                        {v.qty} - <span className="admin-variant-inline-price">₹{formatMoney(v.price)}</span>
                                      </p>
                                      {isEditing ? (
                                        <input
                                          className="admin-input admin-variant-price"
                                          inputMode="numeric"
                                          value={variantDraftPrices[draftKey] ?? String(v.price)}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (!/^\d*$/.test(value)) return;
                                            setVariantDraftPrices((prev) => ({
                                              ...prev,
                                              [draftKey]: value,
                                            }));
                                          }}
                                        />
                                      ) : null}
                                      <div className="admin-variant-actions">
                                        {isEditing ? (
                                          <>
                                            <button
                                              className="admin-icon-btn admin-icon-btn-sm"
                                              type="button"
                                              aria-label="Save variant price"
                                              title="Save"
                                              onClick={() => updateVariantPrice(p.id, v.qty)}
                                            >
                                              <FaCheck aria-hidden="true" />
                                            </button>
                                            <button
                                              className="admin-icon-btn admin-icon-btn-sm"
                                              type="button"
                                              aria-label="Cancel editing"
                                              title="Cancel"
                                              onClick={() => setEditingVariantKey(null)}
                                            >
                                              <FaXmark aria-hidden="true" />
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            className="admin-icon-btn admin-icon-btn-sm admin-variant-edit-btn"
                                            type="button"
                                            aria-label="Edit variant price"
                                            title="Edit"
                                            onClick={() => {
                                              setVariantDraftPrices((prev) => ({
                                                ...prev,
                                                [draftKey]: String(v.price),
                                              }));
                                              setEditingVariantKey(draftKey);
                                            }}
                                          >
                                            <FaPenToSquare aria-hidden="true" />
                                          </button>
                                        )}
                                        <button
                                          className="admin-icon-btn admin-icon-btn-sm admin-icon-btn-danger admin-variant-delete-btn"
                                          type="button"
                                          aria-label="Delete variant"
                                          title="Delete"
                                          onClick={() => requestDeleteVariant(p, v.qty)}
                                        >
                                          <FaTrashCan aria-hidden="true" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {(p.sortedVariants || []).length === 0 ? <p className="admin-muted">No variants yet.</p> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                  })}
                </tbody>
              </table>
              <div className="admin-pagination">
                <div className="admin-pagination-left">
                  <label className="admin-pagination-label">
                    Items per page:
                    <select
                      className="admin-pagination-select"
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </label>
                </div>
                <div className="admin-pagination-right">
                  <span className="admin-page-meta">
                    {pageStart}-{pageEnd} of {filteredItems.length}
                  </span>
                  <button
                    type="button"
                    className="admin-page-icon-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    aria-label="First page"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="admin-page-icon-btn"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="admin-page-icon-btn"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="admin-page-icon-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    aria-label="Last page"
                  >
                    »
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isProductFormOpen ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeProductForm}>
          <div className="admin-card admin-modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="admin-table-head">
              <h3 className="admin-card-title">{selectedProductId ? "Edit Product" : "Add Product"}</h3>
            </div>
            {formGeneralError ? <p className="admin-error">{formGeneralError}</p> : null}
            <label className="admin-label">
              <span className="admin-label-text">Product name <span className="admin-required-mark">*</span></span>
              <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="admin-label">
              <span className="admin-label-text">Product image <span className="admin-required-mark">*</span></span>
              {imageError ? <p className="admin-error admin-field-error">{imageError}</p> : null}
              <input
                ref={imageInputRef}
                className="admin-input admin-file-input"
                type="file"
                accept="image/*"
                onChange={onImageSelect}
              />
            </label>
            {selectedImageSrc ? (
              <button className="btn btn-outline btn-sm admin-remove-image-btn" type="button" onClick={clearSelectedImage}>
                Remove selected image
              </button>
            ) : null}
            {selectedImageName ? <p className="admin-muted">{selectedImageName}</p> : null}
            {modalPreviewUrl ? (
              <div className="admin-image-preview-wrap">
                <p className="admin-muted">Preview</p>
                <img className="admin-image-preview" src={modalPreviewUrl} alt="Product preview" loading="lazy" />
              </div>
            ) : null}
            <label className="admin-label">
              <span className="admin-label-text">Order No <span className="admin-required-mark">*</span></span>
              {orderNoError ? <p className="admin-error admin-field-error">{orderNoError}</p> : null}
              <input
                className="admin-input"
                inputMode="numeric"
                value={orderNo}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value)) setOrderNo(value);
                }}
                placeholder="e.g. 1"
              />
            </label>
            <label className="admin-label">
              Description
              <textarea
                className="admin-input admin-textarea"
                value={desc}
                maxLength={DESCRIPTION_MAX_LENGTH}
                onChange={(e) => setDesc(e.target.value)}
              />
            </label>
            <p className="admin-muted">Description: {desc.length}/{DESCRIPTION_MAX_LENGTH} characters</p>
            <div className="admin-form-actions admin-modal-actions">
              {selectedProductId ? (
                <>
                  <div className="admin-modal-primary-actions">
                    <button className="btn btn-outline admin-modal-cancel-btn" type="button" onClick={closeProductForm}>
                      Close
                    </button>
                    <button className="btn btn-primary" type="button" onClick={saveProduct}>
                      Update
                    </button>
                  </div>
                </>
              ) : (
                <div className="admin-modal-primary-actions">
                  <button className="btn btn-outline admin-modal-cancel-btn" type="button" onClick={closeProductForm}>
                    Close
                  </button>
                  <button className="btn btn-primary" type="button" onClick={addProduct}>
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div className="admin-confirm-backdrop" role="presentation" onClick={() => setConfirmDialog(null)}>
          <div className="admin-card admin-confirm-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-card-title">{confirmDialog.title}</h3>
            <p className="admin-confirm-text">{confirmDialog.message}</p>
            <div className="admin-confirm-actions">
              <button className="btn btn-outline" type="button" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button className="btn admin-confirm-delete-btn" type="button" onClick={confirmDeleteAction}>
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {successMessage ? <div className="admin-success-toast">{successMessage}</div> : null}
    </div>
  );
}

function PublicSite() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(() =>
    typeof window !== "undefined" && sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"
  );
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [openVariantProductId, setOpenVariantProductId] = useState(null);
  const [descriptionDialog, setDescriptionDialog] = useState(null);
  const productCardRefs = useRef({});

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!descriptionDialog) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setDescriptionDialog(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [descriptionDialog]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    if (descriptionDialog) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [descriptionDialog]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncAdminAuth = () => setIsAdminAuthed(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
    syncAdminAuth();
    window.addEventListener("storage", syncAdminAuth);
    window.addEventListener("focus", syncAdminAuth);
    return () => {
      window.removeEventListener("storage", syncAdminAuth);
      window.removeEventListener("focus", syncAdminAuth);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobileView(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [adminProducts, setAdminProducts] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const unsub = subscribeProducts(
      (next) => setAdminProducts(next),
      (e) => setLoadError(e?.message || "Failed to load products.")
    );
    return () => unsub();
  }, []);

  const publicProducts = useMemo(() => {
    return sortProductsByOrder(adminProducts).map((item) => ({
      ...item,
      sortedVariants: sortVariants(item.variants || []),
    }));
  }, [adminProducts]);
  const visibleProducts = useMemo(() => {
    if (isMobileView) return publicProducts;
    return showAllProducts ? publicProducts : publicProducts.slice(0, 4);
  }, [isMobileView, showAllProducts, publicProducts]);

  const toggleVariantOptions = (productId) => {
    setOpenVariantProductId((prev) => {
      const nextId = prev === productId ? null : productId;
      if (nextId) {
        const cardEl = productCardRefs.current[nextId];
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
      }
      return nextId;
    });
  };

  const openDescriptionDialog = (product) => {
    setDescriptionDialog({ id: product.id, name: product.name, desc: product.desc || "" });
  };

  const [cart, setCart] = useState({});

  const cartItems = useMemo(() => Object.values(cart).filter((x) => x.qty > 0), [cart]);

  const inc = (product, variant) => {
    const key = `${product.id}__${variant.qty}`;
    setCart((prev) => {
      const current = prev[key] || {
        key,
        productId: product.id,
        name: product.name,
        variant: variant.qty,
        price: Number(variant.price) || 0,
        qty: 0,
      };
      return { ...prev, [key]: { ...current, qty: current.qty + 1 } };
    });
  };

  const dec = (product, variant) => {
    const key = `${product.id}__${variant.qty}`;
    setCart((prev) => {
      const current = prev[key];
      if (!current) return prev;
      const nextQty = Math.max(0, current.qty - 1);
      return { ...prev, [key]: { ...current, qty: nextQty } };
    });
  };

  const total = useMemo(() => cartItems.reduce((sum, it) => sum + it.qty * it.price, 0), [cartItems]);
  const whatsAppOrderHref = useMemo(() => buildWhatsAppOrderUrl(cartItems), [cartItems]);

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="/" aria-label="Home">
          <img className="brand-logo" src="/nmc-logo-main.png" alt="Nanalal Maganlal Chavanawala logo" />
          <span className="brand-name">Nanalal Maganlal Chavanawala</span>
        </a>
        <nav>
          <a href="#products">Products</a>
          <a href="#contact">Contact</a>
          <a href="#social">Social</a>
        </nav>
        {isAdminAuthed ? (
          <a className="btn btn-outline nav-admin" href="/admin-login">
            Admin
          </a>
        ) : null}
        <a className="btn btn-primary nav-cta" href={whatsappUrl} target="_blank" rel="noreferrer">
          <FaWhatsapp aria-hidden="true" />
          <span>Order on WhatsApp</span>
        </a>
        <button
          type="button"
          className="menu-btn"
          aria-label="Open menu"
          aria-controls="mobile-menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
        >
          <span className="menu-btn-bars" aria-hidden="true" />
        </button>
      </header>

      <div className={`menu-backdrop ${isMenuOpen ? "open" : ""}`} onClick={() => setIsMenuOpen(false)} aria-hidden={!isMenuOpen} />
      <aside id="mobile-menu" className={`mobile-menu ${isMenuOpen ? "open" : ""}`} aria-hidden={!isMenuOpen}>
        <div className="mobile-menu-header">
          <span className="mobile-menu-title">Menu</span>
          <button type="button" className="menu-close" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>
            ×
          </button>
        </div>
        <nav className="mobile-menu-links" aria-label="Mobile">
          {isAdminAuthed ? (
            <a href="/admin-login" onClick={() => setIsMenuOpen(false)}>
              <FaLock aria-hidden="true" />
              Admin
            </a>
          ) : null}
          <a href="#products" onClick={() => setIsMenuOpen(false)}>
            <FaBoxOpen aria-hidden="true" />
            Products
          </a>
          <a href="#contact" onClick={() => setIsMenuOpen(false)}>
            <FaPhone aria-hidden="true" />
            Contact
          </a>
          <a href="#social" onClick={() => setIsMenuOpen(false)}>
            <FaShareNodes aria-hidden="true" />
            Social
          </a>
        </nav>
        <a className="btn btn-primary mobile-menu-cta" href={whatsappUrl} target="_blank" rel="noreferrer">
          <FaWhatsapp aria-hidden="true" />
          <span>Order on WhatsApp</span>
        </a>
      </aside>

      <main id="top">
        <section className="section hero">
          <div className="hero-copy">
            <div className="hero-text">
              <p className="badge">Since 1950</p>
              <h1>Nanalal Maganlal Chavanawala</h1>
              <p className="tagline" aria-label="Chakho Swaad Rakho Yaad">
                <span className="tagline-text">Chakho Swaad Rakho Yaad</span>
              </p>
              <p className="lead">Heritage Gujarati Namkeen & Sweets from Khambhat.</p>
              <div className="hero-desc">
                <p>
                  NMC – Nanalal Maganlal Chavanawala has been a trusted name in traditional Gujarati snacks and sweets since
                  1950, proudly rooted in Khambhat. Renowned for its iconic Papad Chavanu, Mix Chavanu, Halvasan, and
                  Suterfeni, NMC brings generations of authentic taste to every bite.
                </p>
                <p>
                  Crafted with time-honored recipes and an unwavering commitment to quality, each product reflects the rich
                  heritage of Gujarati Namkeen & Sweets. Whether you're craving a nostalgic flavor or discovering it for the first
                  time, NMC promises a delightful experience that keeps customers coming back for more.
                </p>
                <p>Visit NMC to experience the true taste of tradition — where every bite tells a story.</p>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-logo-wrap">
                <img className="hero-logo" src="/nmc-logo-main.png" alt="" />
              </div>
            </div>
          </div>
        </section>

        <section id="products" className="section section-alt">
          <h2>Products</h2>
          <p className="section-text">Choose variants and build your order.</p>
          <p className="mobile-swipe-hint" aria-hidden="true">
            Swipe right to see more products <span>→</span>
          </p>
          {!isMobileView && showAllProducts ? (
            <p className="desktop-scroll-hint" aria-hidden="true">
              Scroll down to see more products <span>↓</span>
            </p>
          ) : null}

          <div className="products-scroll-wrap">
            <div className="grid grid-4">
              {visibleProducts.map((p) => (
              <article
                key={p.id}
                className="card product product-admin"
                ref={(el) => {
                  if (!el) return;
                  productCardRefs.current[p.id] = el;
                }}
              >
                {p.imageUrl ? (
                  <img className="product-photo" src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" />
                ) : (
                  <div className="product-image" aria-hidden="true" />
                )}
                <h3>{p.name}</h3>
                {p.desc ? (
                  <DescriptionExcerpt
                    text={p.desc}
                    className="product-desc"
                    dialogMode
                    onToggleExpanded={() => openDescriptionDialog(p)}
                  />
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline btn-sm product-variant-toggle"
                  aria-label={openVariantProductId === p.id ? "Hide variants" : "Show variants"}
                  onClick={() => toggleVariantOptions(p.id)}
                >
                  <span className="product-variant-toggle-icon" aria-hidden="true">
                    {openVariantProductId === p.id ? "−" : "+"}
                  </span>
                  <span>{openVariantProductId === p.id ? "Hide options" : "Show options"}</span>
                </button>

                {(p.sortedVariants || []).length && openVariantProductId === p.id ? (
                  <div className="variant-list" aria-label={`${p.name} variants`}>
                    {(p.sortedVariants || []).map((v) => {
                        const key = `${p.id}__${v.qty}`;
                        const count = cart[key]?.qty || 0;
                        return (
                          <div key={v.qty} className="variant-row">
                            <div className="variant-meta">
                              <span className="variant-qty">{v.qty}</span>
                              <span className="variant-price">₹{formatMoney(v.price)}</span>
                            </div>
                            <div className="variant-controls">
                              <button type="button" className="qty-btn" onClick={() => dec(p, v)} aria-label="Decrease">
                                −
                              </button>
                              <span className="qty-count" aria-label="Quantity">
                                {count}
                              </span>
                              <button type="button" className="qty-btn" onClick={() => inc(p, v)} aria-label="Increase">
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (p.sortedVariants || []).length ? null : (
                  <p className="admin-muted">Variants coming soon.</p>
                )}
              </article>
              ))}
            </div>
          </div>
          {!isMobileView && !showAllProducts && publicProducts.length > 4 ? (
            <div className="section-cta">
              <button className="btn btn-outline see-all-products-btn" type="button" onClick={() => setShowAllProducts(true)}>
                See all products
              </button>
            </div>
          ) : null}

          {loadError ? <p className="admin-error">{loadError}</p> : null}

          {cartItems.length ? (
            <div className="invoice-card card">
              <h3>Invoice</h3>
              <div className="invoice-lines">
                {cartItems.map((it) => (
                  <div key={it.key} className="invoice-line">
                    <span className="invoice-name">
                      {it.name} ({it.variant}) × {it.qty} - ₹{formatMoney(it.qty * it.price)}
                    </span>
                    <div className="invoice-controls">
                      <button
                        type="button"
                        className="invoice-qty-btn"
                        aria-label={`Decrease ${it.name} (${it.variant}) quantity`}
                        onClick={() =>
                          setCart((prev) => {
                            const current = prev[it.key];
                            if (!current) return prev;
                            const nextQty = Math.max(0, (current.qty || 0) - 1);
                            return { ...prev, [it.key]: { ...current, qty: nextQty } };
                          })
                        }
                      >
                        −
                      </button>
                      <span className="invoice-qty-count" aria-label="Invoice quantity">
                        {it.qty}
                      </span>
                      <button
                        type="button"
                        className="invoice-qty-btn"
                        aria-label={`Increase ${it.name} (${it.variant}) quantity`}
                        onClick={() =>
                          setCart((prev) => {
                            const current = prev[it.key];
                            if (!current) return prev;
                            return { ...prev, [it.key]: { ...current, qty: (current.qty || 0) + 1 } };
                          })
                        }
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="invoice-remove-btn"
                        aria-label={`Remove ${it.name} (${it.variant})`}
                        onClick={() =>
                          setCart((prev) => ({
                            ...prev,
                            [it.key]: { ...prev[it.key], qty: 0 },
                          }))
                        }
                      >
                        <FaTrashCan aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="invoice-total">
                  <span>Total</span>
                  <span>₹{formatMoney(total)}</span>
                </div>
              </div>
              <a className="btn btn-primary invoice-cta" href={whatsAppOrderHref} target="_blank" rel="noreferrer">
                <FaWhatsapp aria-hidden="true" />
                <span>Send to WhatsApp</span>
              </a>
            </div>
          ) : null}
        </section>

        <section id="contact" className="section contact">
          <h2>Contact</h2>
          <p className="section-text">Visit us in Khambhat or reach out on call, email, or WhatsApp.</p>

          <div className="contact-layout">
            <article className="card contact-card">
              <div className="contact-item">
                <FaMapLocationDot aria-hidden="true" />
                <div>
                  <p className="contact-label">Address</p>
                  <p className="contact-value">Javahar Road, Khambhat, Gujarat, 388620</p>
                </div>
              </div>

              <div className="contact-item">
                <FaPhone aria-hidden="true" />
                <div>
                  <p className="contact-label">Call</p>
                  <a className="contact-value" href="tel:+919825412940">
                    +91 98254 12940
                  </a>
                  <a className="contact-value" href="tel:+919825741979">
                    +91 98257 41979
                  </a>
                </div>
              </div>

              <div className="contact-item">
                <FaEnvelope aria-hidden="true" />
                <div>
                  <p className="contact-label">Email</p>
                  <a className="contact-value" href="mailto:nanamagan1950@gmail.com">
                    nanamagan1950@gmail.com
                  </a>
                </div>
              </div>

              <div className="cta-row">
                <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noreferrer">
                  <FaWhatsapp aria-hidden="true" />
                  <span>WhatsApp Catalog</span>
                </a>
                <a
                  className="btn btn-outline btn-map-theme"
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaMapLocationDot aria-hidden="true" />
                  <span>Directions</span>
                </a>
              </div>
            </article>

            <div className="card contact-map-card">
              <iframe
                title="Nanalal Maganlal Chavanawala location"
                className="map"
                loading="lazy"
                src="https://maps.google.com/maps?q=NANALAL%20MAGANLAL%20CHAVANAWALA%2C%20Gawara%20Rd%2C%20Vasda%20Wad%2C%20Rana%20Chakla%2C%20Khambhat%2C%20Gujarat%20388620&t=&z=16&ie=UTF8&iwloc=&output=embed"
              />
            </div>
          </div>
        </section>

        <section id="social" className="section social-media">
          <h2>Social Media</h2>
          <p className="section-text">Follow us for fresh batches, festival specials, and new items.</p>

          <div className="social-media-grid">
            <a className="social-tile social-tile--instagram" href="https://www.instagram.com/nmc.cambay/" target="_blank" rel="noreferrer" aria-label="Open Instagram">
              <div className="social-tile-icon" aria-hidden="true">
                <svg className="insta-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" focusable="false">
                  <defs>
                    <linearGradient id="ig-bg" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#f58529" />
                      <stop offset="0.33" stopColor="#dd2a7b" />
                      <stop offset="0.66" stopColor="#8134af" />
                      <stop offset="1" stopColor="#515bd4" />
                    </linearGradient>
                  </defs>
                  <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#ig-bg)" />
                  <rect x="18" y="18" width="28" height="28" rx="10" fill="none" stroke="#fff" strokeWidth="4" />
                  <circle cx="32" cy="32" r="7" fill="none" stroke="#fff" strokeWidth="4" />
                  <circle cx="43.5" cy="20.5" r="3" fill="#fff" />
                </svg>
              </div>
              <div className="social-tile-text">
                <p className="social-tile-title">Instagram</p>
                <p className="social-tile-sub">@nmc.cambay</p>
              </div>
            </a>

            <a className="social-tile social-tile--facebook" href="https://www.facebook.com/nmccambay/about/" target="_blank" rel="noreferrer" aria-label="Open Facebook">
              <div className="social-tile-icon" aria-hidden="true">
                <svg className="fb-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" focusable="false">
                  <defs>
                    <linearGradient id="fb-bg" x1="14" y1="58" x2="50" y2="6" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#1877f2" />
                      <stop offset="1" stopColor="#0b5fd7" />
                    </linearGradient>
                  </defs>
                  <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#fb-bg)" />
                  <path fill="#ffffff" d="M36.8 22.6c0-2.5 1.2-3.9 4.1-3.9h4v-7.2h-6c-7.3 0-11.2 4.3-11.2 11.3v5.1h-6.6V35h6.6v17.5h8.1V35h6.8l1.1-7.1h-7.9v-5.3z" />
                </svg>
              </div>
              <div className="social-tile-text">
                <p className="social-tile-title">Facebook</p>
                <p className="social-tile-sub">nmccambay</p>
              </div>
            </a>
          </div>
        </section>

        {descriptionDialog ? (
          <div className="readmore-dialog-backdrop" onClick={() => setDescriptionDialog(null)}>
            <article
              className="card readmore-dialog-card"
              role="dialog"
              aria-modal="true"
              aria-label={`${descriptionDialog.name} description`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="readmore-dialog-head">
                <h3>{descriptionDialog.name}</h3>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setDescriptionDialog(null)}
                  aria-label="Close description dialog"
                >
                  <FaXmark aria-hidden="true" />
                </button>
              </div>
              <div className="readmore-dialog-body">{descriptionDialog.desc}</div>
            </article>
          </div>
        ) : null}
      </main>

      <footer className="mini-footer">© {new Date().getFullYear()} Nanalal Maganlal Chavanawala. All Rights Reserved.</footer>
    </div>
  );
}

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/admin-login") return <AdminLoginPage />;
  return <PublicSite />;
}
