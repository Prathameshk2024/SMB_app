import { useEffect, type ReactNode } from 'react'
import {
  Navigate, Route, BrowserRouter as Router, Routes, useLocation, useNavigationType,
} from 'react-router-dom'
import type { Role } from '@shared/types.js'
import { I18nProvider } from './i18n/I18nProvider.js'
import { AuthProvider, homeFor, useAuth } from './store/AuthContext.js'
import { ToastProvider } from './store/ToastContext.js'
import { CartProvider } from './store/CartContext.js'
import { liveTicket } from './lib/registerTicket.js'
import { PincodeProvider } from './store/PincodeContext.js'
import { recallScroll, rememberScroll } from './lib/scrollMemory.js'
import { CustomerLayout, SellerLayout } from './components/layouts.js'

import Landing from './screens/landing/Landing.js'
import { OtpScreen, PhoneScreen } from './screens/auth/Auth.js'
import SellerRegister from './screens/auth/SellerRegister.js'
import CustomerRegister from './screens/auth/CustomerRegister.js'
import Notifications from './screens/Notifications.js'

import MyBusiness from './screens/seller/MyBusiness.js'
import MyProducts from './screens/seller/MyProducts.js'
import UploadProduct from './screens/seller/UploadProduct.js'
import EditProduct from './screens/seller/EditProduct.js'
import EditProfile from './screens/seller/EditProfile.js'
import { SellerOrderDetail, SellerOrders } from './screens/seller/Orders.js'
import { PaymentWaiting, Subscription } from './screens/seller/Subscription.js'
import { SellerGrowth, SellerHelp, SellerProfile } from './screens/seller/Misc.js'
import { MyBuyers } from './screens/seller/MyBuyers.js'
import PaymentQr from './screens/seller/PaymentQr.js'

import {
  Categories, CategoryProducts, Explore, ProductDetail, SellerShop,
} from './screens/customer/Browse.js'
import {
  Cart, Checkout, CustomerOrders, CustomerProfile, OrderPlaced, TrackOrder,
} from './screens/customer/CartCheckout.js'

/**
 * NOTE: there is no /admin route here, and that is deliberate.
 * The client wants the admin console as a separate site, so this app ships the
 * seller and customer experiences only. Everything an admin console needs is
 * exposed as JSON by the backend at /api/admin/*.
 */

/**
 * A wrong-role session is sent to its OWN home, never to the landing page.
 * Bouncing a signed-in seller out to `/` for touching a customer URL reads
 * exactly like being logged out, which is the thing this app must never do by
 * accident.
 */
function Require({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/" replace />
  if (session.role !== role) return <Navigate to={homeFor(session.role)} replace />
  return <>{children}</>
}

/**
 * The wizard needs a verified number, not a session.
 *
 * `/sellers/register` takes her phone out of a single-use ticket and ignores
 * the one in the body, so without a ticket the six screens end in a refusal
 * she cannot act on. Send her to the OTP screen up front instead - which, if
 * she does still hold a live ticket, offers to carry on rather than spending
 * another SMS.
 *
 * A seller session passes too: the last thing the wizard does is spend the
 * ticket and sign her in, and it is still on screen showing her new ID.
 */
function RequireTicket({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  if (!liveTicket() && session?.role !== 'seller') {
    return <Navigate to="/login/seller" replace />
  }
  return <>{children}</>
}

/**
 * A NEW SCREEN STARTS AT THE TOP. THE ONE SHE COMES BACK TO DOES NOT.
 *
 * This began as `scrollTo(0, 0)` on every route change, which fixed the
 * forward case - a product page opening halfway down because the catalogue
 * was - and broke the backward one: she scrolled a long way down, opened the
 * tenth product, pressed back, and the list had forgotten her.
 *
 * So the position is saved per history entry and restored on POP only.
 *
 * The retries matter as much as the restore. Every screen fetches its own
 * data, so at the moment she comes back the list is one spinner tall and the
 * browser clamps any scroll past its height. Asking again over the next
 * second lets the restore land once the content is actually there, and stops
 * as soon as it does.
 */
function ScrollMemory() {
  const { key } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    // The browser's own restoration fights this one and loses on a soft
    // navigation anyway, so take it off.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    const onScroll = () => rememberScroll(key, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      // Leaving is the one moment the position is certainly final.
      rememberScroll(key, window.scrollY)
      window.removeEventListener('scroll', onScroll)
    }
  }, [key])

  useEffect(() => {
    const target = navigationType === 'POP' ? recallScroll(key) : 0
    window.scrollTo(0, target)
    if (target === 0) return

    let tries = 0
    const timer = setInterval(() => {
      if (Math.abs(window.scrollY - target) < 2 || ++tries > 8) return clearInterval(timer)
      window.scrollTo(0, target)
    }, 120)
    return () => clearInterval(timer)
  }, [key, navigationType])

  return null
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <PincodeProvider>
          <Router>
            <ScrollMemory />
            <Routes>
              {/* ---- public ---------------------------------------- */}
              {/* The landing page stays reachable while signed in. It used to
                  redirect, which meant a back press out of /seller landed on a
                  page that immediately threw her somewhere else - and the
                  "carry on to your shop" decision had nowhere to live. */}
              <Route path="/" element={<Landing />} />

              {/* Two doors from the landing page, one per role. Both go
                  through login; `join` is only the seller's "I am new" path. */}
              <Route path="/join/:role" element={<PhoneScreen mode="join" />} />
              <Route path="/login/:role" element={<PhoneScreen mode="login" />} />
              <Route path="/otp/:role" element={<OtpScreen />} />
              <Route
                path="/register/seller"
                element={<RequireTicket><SellerRegister /></RequireTicket>}
              />

              {/* She is signed in by the time she reaches this one - all that
                  is missing is the name, and writing it needs her token. */}
              <Route
                path="/register/customer"
                element={<Require role="customer"><CustomerRegister /></Require>}
              />

              {/* ---- seller: standalone screens (no bottom nav) ----- */}
              <Route
                path="/seller/waiting"
                element={<Require role="seller"><PaymentWaiting /></Require>}
              />

              {/* ---- seller app ------------------------------------ */}
              <Route path="/seller" element={<Require role="seller"><SellerLayout /></Require>}>
                <Route index element={<MyBusiness />} />
                <Route path="orders" element={<SellerOrders />} />
                <Route path="orders/:orderId" element={<SellerOrderDetail />} />
                <Route path="products" element={<MyProducts />} />
                <Route path="products/:productId/edit" element={<EditProduct />} />
                <Route path="upload" element={<UploadProduct />} />
                <Route path="subscription" element={<Subscription />} />
                <Route path="profile" element={<SellerProfile />} />
                <Route path="profile/edit" element={<EditProfile />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="help" element={<SellerHelp />} />
                <Route path="growth" element={<SellerGrowth />} />
                <Route path="buyers" element={<MyBuyers />} />
                <Route path="payment" element={<PaymentQr />} />
              </Route>

              {/* ---- customer: standalone --------------------------- */}
              <Route
                path="/shop/placed/:orderId"
                element={<Require role="customer"><OrderPlaced /></Require>}
              />

              {/* ---- customer app ----------------------------------- */}
              <Route path="/shop" element={<Require role="customer"><CustomerLayout /></Require>}>
                <Route index element={<Explore />} />
                <Route path="categories" element={<Categories />} />
                <Route path="c/:categoryId" element={<CategoryProducts />} />
                <Route path="p/:productId" element={<ProductDetail />} />
                <Route path="seller/:sellerId" element={<SellerShop />} />
                <Route path="cart" element={<Cart />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="orders" element={<CustomerOrders />} />
                <Route path="orders/:orderId" element={<TrackOrder />} />
                <Route path="profile" element={<CustomerProfile />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
          </PincodeProvider>
        </CartProvider>
      </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
