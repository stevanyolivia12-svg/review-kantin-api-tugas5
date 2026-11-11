import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MenuItem } from './types';

const CART_STORAGE_KEY = 'review-kantin-cart';

export interface CartItem {
  menuId: number;
  menuName: string;
  stallName: string;
  unitPrice: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  storageError: string | null;
  addItem: (menu: MenuItem, stallName: string) => void;
  setQuantity: (menuId: number, quantity: number) => void;
  removeItem: (menuId: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.menuId === 'number'
    && Number.isInteger(item.menuId)
    && typeof item.menuName === 'string'
    && typeof item.stallName === 'string'
    && typeof item.unitPrice === 'number'
    && Number.isFinite(item.unitPrice)
    && typeof item.quantity === 'number'
    && Number.isInteger(item.quantity)
    && Number(item.quantity) > 0;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every(isCartItem)) {
          throw new Error('Format data keranjang tidak valid.');
        }
        setItems(parsed);
      }
    } catch (error) {
      console.error('Keranjang tidak dapat dimuat dari penyimpanan lokal.', error);
      setStorageError('Keranjang tersimpan tidak dapat dimuat. Kamu tetap dapat menggunakan keranjang sementara.');
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      setStorageError(null);
    } catch (error) {
      console.error('Keranjang tidak dapat disimpan ke penyimpanan lokal.', error);
      setStorageError('Keranjang tidak dapat disimpan di perangkat ini.');
    }
  }, [items, storageReady]);

  function addItem(menu: MenuItem, stallName: string) {
    setItems((current) => {
      const existing = current.find((item) => item.menuId === menu.id);
      if (existing) {
        return current.map((item) => item.menuId === menu.id
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }
      return [...current, {
        menuId: menu.id,
        menuName: menu.name,
        stallName,
        unitPrice: menu.price,
        quantity: 1,
      }];
    });
  }

  function setQuantity(menuId: number, quantity: number) {
    if (quantity <= 0) {
      removeItem(menuId);
      return;
    }
    setItems((current) => current.map((item) => item.menuId === menuId ? { ...item, quantity } : item));
  }

  function removeItem(menuId: number) {
    setItems((current) => current.filter((item) => item.menuId !== menuId));
  }

  function clearCart() {
    setItems([]);
  }

  return (
    <CartContext.Provider value={{ items, loading: !storageReady, storageError, addItem, setQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart harus digunakan di dalam CartProvider.');
  return context;
}
