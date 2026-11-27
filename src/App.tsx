import React from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { AdminView } from './components/AdminView';
import { AuthModal } from './components/AuthModal';
import { AuthPages } from './components/AuthPages';
import { CartDrawer } from './components/CartDrawer';
import { CatalogView } from './components/CatalogView';
import { CheckoutView } from './components/CheckoutView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { Navbar } from './components/Navbar';
import { OffersView } from './components/OffersView';
import { OrdersView } from './components/OrdersView';
import { ProductDetailView } from './components/ProductDetailView';
import { ProfileView } from './components/ProfileView';
import { QuickViewModal } from './components/QuickViewModal';
import { WishlistView } from './components/WishlistView';
import { StoreProvider, useStore } from './context/StoreContext';

function NovaCartShell() {
  const { view, toast, dismissToast } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#141416]">
      <Navbar />

      <main className="flex-1">
        {view === 'home' && <HomeView />}
        {view === 'catalog' && <CatalogView />}
        {view === 'product' && <ProductDetailView />}
        {view === 'wishlist' && <WishlistView />}
        {view === 'checkout' && <CheckoutView />}
        {view === 'offers' && <OffersView />}
        {view === 'orders' && <OrdersView />}
        {view === 'profile' && <ProfileView />}
        {view === 'signin' && <AuthPages mode="signin" />}
        {view === 'signup' && <AuthPages mode="signup" />}
        {view === 'forgot-password' && <AuthPages mode="forgot-password" />}
        {view === 'admin' && <AdminView />}
      </main>

      <Footer />
      <CartDrawer />
      <QuickViewModal />
      <AuthModal />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#141416] text-white px-4 py-3 rounded-xl shadow-xl border border-white/10 flex items-center gap-3"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#F97316] shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-white/80 shrink-0" />}
          <p className="text-xs font-medium leading-snug flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <NovaCartShell />
      </StoreProvider>
    </ErrorBoundary>
  );
}
