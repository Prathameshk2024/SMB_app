import { NavLink, Outlet } from 'react-router-dom'
import { useT } from '../i18n/I18nProvider.js'
import { useCart } from '../store/CartContext.js'
import {
  IconAddProduct, IconBusiness, IconCart, IconCategories, IconExplore,
  IconHelp, IconProfile, type IconType,
} from './icons.js'

/**
 * Four bottom tabs, one level deep, icon AND word together.
 * No hamburger menu anywhere in this app - see docs/FEATURE-SPEC.md section 6.
 */
interface NavItem {
  to: string
  end?: boolean
  icon: IconType
  label: string
  badge?: number
}

function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="bottomnav" aria-label="Main">
      {items.map(({ to, end, icon: Icon, label, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `bottomnav__item ${isActive ? 'bottomnav__item--on' : ''}`
          }
        >
          <span className="bottomnav__icon" aria-hidden="true">
            <Icon />
            {!!badge && badge > 0 && <span className="bottomnav__badge">{badge}</span>}
          </span>
          <span className="bottomnav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function SellerLayout() {
  const t = useT()
  return (
    <div className="app-shell app-shell--nav">
      <Outlet />
      <BottomNav
        items={[
          { to: '/seller', end: true, icon: IconBusiness, label: t('nav.business') },
          { to: '/seller/upload', icon: IconAddProduct, label: t('nav.upload') },
          { to: '/seller/profile', icon: IconProfile, label: t('nav.profile') },
          { to: '/seller/help', icon: IconHelp, label: t('nav.help') },
        ]}
      />
    </div>
  )
}

export function CustomerLayout() {
  const t = useT()
  const { count } = useCart()
  return (
    <div className="app-shell app-shell--nav">
      <Outlet />
      <BottomNav
        items={[
          { to: '/shop', end: true, icon: IconExplore, label: t('nav.explore') },
          { to: '/shop/categories', icon: IconCategories, label: t('nav.categories') },
          { to: '/shop/cart', icon: IconCart, label: t('nav.cart'), badge: count },
          { to: '/shop/profile', icon: IconProfile, label: t('nav.myProfile') },
        ]}
      />
    </div>
  )
}
