import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Product, ProductInquiry } from '../types';
import { INITIAL_PRODUCTS, INITIAL_INQUIRIES } from '../utils/mockData';
import { fetchWithCache, invalidateClientCache } from '../utils/apiClient';
import { compressImage } from '../utils/imageCompressor';
import { DebouncedSearch } from '../components/DebouncedSearch';
import { ProductSkeleton } from '../components/SkeletonLoader';
import {
  Store,
  ShoppingBag,
  Package,
  MessageSquare,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Phone,
  Inbox,
} from 'lucide-react';

export const NormalDashboard: React.FC = () => {
  const { user, token } = useAuth();

  // Sub-mode tab: 'buy' | 'sell' | 'inbox' (Only appears for normal users)
  const [subMode, setSubMode] = useState<'buy' | 'sell' | 'inbox'>(() => {
    try {
      const pref = localStorage.getItem('foundersgate_normal_pref');
      if (pref === 'sell' || pref === 'buy') return pref;
    } catch {}
    return 'buy';
  });

  // Products & Inquiries state
  const [products, setProducts] = useState<Product[]>([]);
  const [inquiries, setInquiries] = useState<ProductInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Add Product Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('35.00');
  const [category, setCategory] = useState('Artisanal Goods');
  const [stock, setStock] = useState('10');
  const [imageUrl, setImageUrl] = useState('');
  const [compressedInfo, setCompressedInfo] = useState<{ sizeKb: number; originalSizeKb: number } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Inquire Modal State (for Buyers)
  const [inquiryProduct, setInquiryProduct] = useState<Product | null>(null);
  const [buyerMessage, setBuyerMessage] = useState('Hi! I am interested in purchasing this product. Is it in stock for immediate delivery?');
  const [buyerPhone, setBuyerPhone] = useState(user?.phone_number ? `${user.country_code} ${user.phone_number}` : '+1 555-0199');

  // Load Products & Inquiries
  const loadData = useCallback(async () => {
    try {
      const data = await fetchWithCache<Product[]>('/products', {}, 2000, token);
      setProducts(data.length > 0 ? data : INITIAL_PRODUCTS);
    } catch {
      setProducts(INITIAL_PRODUCTS);
    }

    try {
      const inq = await fetchWithCache<ProductInquiry[]>('/vendor/inquiries', {}, 2000, token);
      setInquiries(inq.length > 0 ? inq : INITIAL_INQUIRIES);
    } catch {
      setInquiries(INITIAL_INQUIRIES);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 4s so products added by any seller appear live for all buyers
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle Image File Selection with Client-Side Canvas Compression
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const res = await compressImage(file, 1000, 0.78);
      setImageUrl(res.dataUrl);
      setCompressedInfo({ sizeKb: res.sizeKb, originalSizeKb: res.originalSizeKb });
    } catch (err: any) {
      alert('Error compressing image: ' + err.message);
    } finally {
      setIsCompressing(false);
    }
  };

  // Add New Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const newProd: Product = {
        id: crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`,
        vendor_id: user?.id || 'n1111111-1111-4111-a111-111111111111',
        vendor_name: user?.full_name || 'Local Artisan Shop',
        vendor_phone: `${user?.country_code} ${user?.phone_number}`,
        title,
        description,
        price: parseFloat(price) || 25,
        category,
        stock: parseInt(stock, 10) || 1,
        image_url:
          imageUrl ||
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',
        created_at: Date.now(),
      };

      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newProd),
        });
        if (res.ok) {
          const created = await res.json().catch(() => newProd);
          if (created && created.id) {
            newProd.id = created.id;
            newProd.vendor_id = created.vendor_id || newProd.vendor_id;
          }
        }
      } catch {
        // Handled locally
      }

      invalidateClientCache('/products');
      setProducts((prev) => [newProd, ...prev.filter(p => p.id !== newProd.id)]);

      setTitle('');
      setDescription('');
      setImageUrl('');
      setCompressedInfo(null);
      setSubMode('buy');
      setSuccessBanner('Product listed successfully in the Community Marketplace!');
      setTimeout(() => setSuccessBanner(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Buyer Inquiry to Vendor
  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryProduct) return;

    setIsSubmitting(true);
    try {
      const newInquiry: ProductInquiry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `inq-${Date.now()}`,
        product_id: inquiryProduct.id,
        product_title: inquiryProduct.title,
        buyer_id: user?.id || 'n2222222-2222-4222-a222-222222222222',
        buyer_name: user?.full_name || 'Interested Customer',
        buyer_phone: buyerPhone,
        message: buyerMessage,
        status: 'PENDING',
        created_at: Date.now(),
      };

      try {
        await fetch(`/api/products/${inquiryProduct.id}/inquire`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newInquiry),
        });
      } catch {
        // Fallback local update
      }

      setInquiries((prev) => [newInquiry, ...prev]);
      setInquiryProduct(null);
      setSuccessBanner(
        `Inquiry sent to ${inquiryProduct.vendor_name || 'vendor'}! They will contact you shortly at ${buyerPhone}.`
      );
      setTimeout(() => setSuccessBanner(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ['ALL', 'Leathercraft', 'Artisanal Pantry', 'Home & Workspace', 'Ceramics', 'Apparel'];

  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' || p.category === selectedCategory;

    return matchesQuery && matchesCategory;
  });

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="neu-flat p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold neu-pressed text-purple-600">
              Community Marketplace
            </span>
            <span className="text-xs text-neu-textMuted font-mono">
              UUID: {user?.id.substring(0, 8)}...
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neu-text tracking-tight">
            Local Vendors & Direct Commerce
          </h1>
          <p className="text-sm text-neu-textMuted max-w-xl">
            A dedicated portal for small shops, creators, and buyers to trade directly.
            <em> Note: Startup investment auctions do not apply to this marketplace.</em>
          </p>
        </div>

        {/* The Two Distinct Normal Sub-Options + Inquiries */}
        <div className="flex neu-pressed-pill p-1.5 w-full md:w-auto">
          <button
            onClick={() => setSubMode('buy')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 transition-all ${
              subMode === 'buy'
                ? 'neu-flat bg-white text-purple-600 shadow-neu-flat-sm'
                : 'text-neu-textMuted hover:text-neu-text'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>🛒 Buy / View Products</span>
          </button>
          <button
            onClick={() => setSubMode('sell')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 transition-all ${
              subMode === 'sell'
                ? 'neu-flat bg-white text-purple-600 shadow-neu-flat-sm'
                : 'text-neu-textMuted hover:text-neu-text'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>🏪 Sell / Vendor Portal</span>
          </button>
          <button
            onClick={() => setSubMode('inbox')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 transition-all ${
              subMode === 'inbox'
                ? 'neu-flat bg-white text-purple-600 shadow-neu-flat-sm'
                : 'text-neu-textMuted hover:text-neu-text'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>🔔 Requests ({inquiries.length})</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="neu-flat p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-sm rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successBanner}</span>
        </div>
      )}

      {/* SUB-MODE 1: BUY / VIEW PRODUCTS */}
      {subMode === 'buy' && (
        <div className="space-y-6">
          {/* Search & Categories */}
          <div className="neu-flat p-4 flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <DebouncedSearch
                placeholder="Search products by title, artisan, or description..."
                onSearch={setSearchQuery}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'neu-flat bg-white text-purple-600 shadow-neu-flat-sm'
                      : 'text-neu-textMuted hover:text-neu-text'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <ProductSkeleton />
              <ProductSkeleton />
              <ProductSkeleton />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="neu-flat p-12 text-center space-y-3">
              <Package className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-neu-text">No Products Found</h3>
              <p className="text-xs text-neu-textMuted">
                Switch to the "Sell" tab to add the first item to this category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((p) => (
                <div key={p.id} className="neu-flat overflow-hidden flex flex-col justify-between">
                  <div>
                    {/* Product Image */}
                    <div className="relative h-48 w-full bg-slate-200 overflow-hidden">
                      <img
                        src={p.image_url}
                        alt={p.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      <span className="absolute top-3 right-3 neu-flat-sm bg-white/90 backdrop-blur-sm px-2.5 py-1 text-xs font-extrabold text-purple-700">
                        ${p.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 neu-pressed-pill px-2 py-0.5">
                          {p.category}
                        </span>
                        <span className="text-[11px] text-neu-textMuted font-medium">
                          Stock: {p.stock}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-neu-text line-clamp-1">{p.title}</h3>
                      <p className="text-xs text-neu-textMuted line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                      <div className="text-[11px] text-neu-textMuted pt-1 border-t border-slate-300/30 flex items-center justify-between">
                        <span>Vendor: <strong>{p.vendor_name || 'Local Merchant'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Contact / Inquire Action */}
                  <div className="p-5 pt-0">
                    <button
                      onClick={() => setInquiryProduct(p)}
                      className="w-full neu-btn py-2.5 text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Contact Vendor / Inquire</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-MODE 2: SELL / VENDOR PORTAL */}
      {subMode === 'sell' && (
        <div className="max-w-2xl mx-auto neu-flat p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-300/40 pb-4">
            <div className="w-10 h-10 neu-pressed rounded-xl flex items-center justify-center text-purple-600">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neu-text">List New Product for Sale</h2>
              <p className="text-xs text-neu-textMuted">
                Add an item to the community marketplace. Uploaded images are automatically compressed into lightweight WebP format.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                Product Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Handcrafted Stoneware Coffee Mug"
                className="w-full neu-input px-3.5 py-2.5 text-sm text-neu-text"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-neu-textMuted uppercase">
                  Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.5"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full neu-input px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-neu-textMuted uppercase">
                  Units in Stock
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full neu-input px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-neu-textMuted uppercase">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full neu-input px-2.5 py-2 text-xs text-neu-text bg-neu-card"
                >
                  <option value="Leathercraft">Leathercraft</option>
                  <option value="Artisanal Pantry">Artisanal Pantry</option>
                  <option value="Home & Workspace">Home & Workspace</option>
                  <option value="Ceramics">Ceramics</option>
                  <option value="Apparel">Apparel</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                Product Description & Specifications
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide dimensions, materials, care instructions, and craftsmanship details..."
                className="w-full neu-input px-3.5 py-2.5 text-xs text-neu-text"
              />
            </div>

            {/* Client-Side Compressed Image Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                Product Image (Auto-Compressed via Canvas)
              </label>
              <div className="p-4 neu-pressed-sm rounded-xl border-dashed border-2 border-slate-300 flex flex-col items-center justify-center text-center">
                {imageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="h-32 object-contain rounded-lg mx-auto shadow-sm"
                    />
                    {compressedInfo && (
                      <div className="text-[11px] text-emerald-700 font-medium">
                        ✓ Compressed from {compressedInfo.originalSizeKb} KB down to <strong>{compressedInfo.sizeKb} KB</strong> (WebP)
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs text-neu-text font-medium">
                      Select photo to upload & compress
                    </p>
                    <p className="text-[10px] text-neu-textMuted">
                      PNG, JPEG, WebP supported.
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="mt-3 text-xs text-slate-500 file:neu-btn file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:text-purple-700 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setSubMode('buy')}
                className="neu-btn px-4 py-2 text-xs font-semibold text-neu-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressing}
                className="neu-btn-primary px-6 py-2.5 text-xs font-bold"
              >
                {isSubmitting ? 'Publishing...' : 'List Product in Marketplace'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-MODE 3: VENDOR INBOX / BUYER INQUIRIES */}
      {subMode === 'inbox' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neu-text flex items-center gap-2">
              <Inbox className="w-5 h-5 text-purple-600" />
              <span>Customer Inquiries for Your Products ({inquiries.length})</span>
            </h2>
          </div>

          {inquiries.length === 0 ? (
            <div className="neu-flat p-12 text-center space-y-3">
              <Inbox className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-neu-text">No Product Inquiries Yet</h3>
              <p className="text-xs text-neu-textMuted">
                When customers want to buy or ask questions about your goods, their requests will appear here with contact details.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inquiries.map((inq) => (
                <div key={inq.id} className="neu-flat p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neu-text">{inq.buyer_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded neu-pressed-pill text-purple-700 font-bold uppercase">
                        Product: {inq.product_title || 'Item'}
                      </span>
                    </div>
                    <p className="text-xs text-neu-text leading-relaxed">"{inq.message}"</p>
                    <div className="text-[11px] text-neu-textMuted flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1 font-mono text-purple-700">
                        <Phone className="w-3 h-3" /> {inq.buyer_phone}
                      </span>
                      <span>• {new Date(inq.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <a
                    href={`tel:${inq.buyer_phone}`}
                    className="neu-btn px-4 py-2 text-xs font-bold text-emerald-600 flex items-center gap-1.5 shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Buyer</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUYER INQUIRY MODAL */}
      {inquiryProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="neu-flat p-6 sm:p-7 max-w-md w-full space-y-5 bg-neu-bg">
            <div className="flex items-center justify-between border-b border-slate-300/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-neu-text">Contact Vendor</h3>
                <p className="text-xs text-neu-textMuted">{inquiryProduct.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setInquiryProduct(null)}
                className="p-1 rounded-lg text-neu-textMuted hover:text-neu-text neu-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInquiry} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                  Your Contact Phone (with Country Code)
                </label>
                <input
                  type="text"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+1 555-0199"
                  className="w-full neu-input px-3.5 py-2 text-xs text-neu-text font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-neu-textMuted uppercase">
                  Message / Inquiry for Vendor
                </label>
                <textarea
                  required
                  rows={3}
                  value={buyerMessage}
                  onChange={(e) => setBuyerMessage(e.target.value)}
                  className="w-full neu-input px-3.5 py-2 text-xs text-neu-text"
                />
              </div>

              <div className="p-2.5 rounded-lg neu-pressed-sm text-[11px] text-neu-textMuted">
                Direct trade: Your inquiry will be forwarded directly to the vendor with your contact info.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInquiryProduct(null)}
                  className="neu-btn px-4 py-2 text-xs font-semibold text-neu-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neu-btn-primary px-5 py-2 text-xs font-bold"
                >
                  {isSubmitting ? 'Sending...' : 'Send Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
