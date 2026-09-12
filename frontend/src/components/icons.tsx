import type { ComponentType } from 'react'
import {
  FiAlertTriangle, FiArrowLeft, FiArrowRight, FiBell, FiBriefcase, FiCamera, FiCheck,
  FiCheckCircle, FiChevronRight, FiClock, FiDownload, FiEdit2, FiFileText,
  FiCopy,
  FiGrid, FiHelpCircle, FiHome, FiImage, FiInbox, FiLock, FiMail, FiMapPin,
  FiMic, FiMinus, FiPackage, FiPause, FiPhone, FiPlay, FiPlayCircle, FiPlus,
  FiPlusCircle, FiSearch, FiShare2, FiShoppingBag, FiShoppingCart,
  FiSmartphone, FiSquare, FiStar, FiThumbsDown, FiThumbsUp, FiTrash2,
  FiTrendingDown, FiTrendingUp, FiUpload, FiUser, FiUsers, FiX,
} from 'react-icons/fi'
import { MdCurrencyRupee, MdOutlineFastfood, MdQrCode2 } from 'react-icons/md'
import { FaWhatsapp } from 'react-icons/fa'

/**
 * ICONS
 * =====
 * Every icon in the app's chrome comes from react-icons, and every screen
 * imports it from HERE rather than from `react-icons/*` directly. One
 * indirection buys two things that matter for this codebase:
 *
 *  - the icon set can be swapped in one file, the same way `theme.css` swaps
 *    every colour from one `:root` block;
 *  - the names are what the product calls them (`IconSell`, `IconCart`), so a
 *    screen reads as intent rather than as a vendor's naming scheme.
 *
 * WHAT IS NOT HERE, AND WHY. These are CHROME: controls, states and
 * navigation. Emoji that are DATA stayed emoji, because they belong to a row
 * rather than to the interface:
 *
 *  - a product's picture, a category's picture, a seller's avatar - all
 *    columns in the database, chosen per record;
 *  - the veg / non-veg dots, which are a regulated marking with a fixed
 *    appearance and are not ours to restyle;
 *  - the celebration mark on a "done" screen, which is illustration.
 *
 * Spec section 6 says status is colour + icon + WORD. Nothing here ever stands
 * alone: every icon in this app sits beside its label, so an icon that fails
 * to load costs nothing, and `aria-hidden` is correct on all of them.
 */

export type IconType = ComponentType<{ size?: number | string; className?: string }>

/* --- navigation & chrome ------------------------------------------ */
export const IconBack: IconType = FiArrowLeft
export const IconNext: IconType = FiArrowRight
export const IconChevron: IconType = FiChevronRight
export const IconCheck: IconType = FiCheck
export const IconWarn: IconType = FiAlertTriangle
export const IconPlus: IconType = FiPlus
export const IconMinus: IconType = FiMinus
export const IconClose: IconType = FiX
export const IconEmpty: IconType = FiInbox
export const IconBell: IconType = FiBell
export const IconWaiting: IconType = FiClock
export const IconLock: IconType = FiLock
export const IconEdit: IconType = FiEdit2
export const IconCopy: IconType = FiCopy
export const IconTrash: IconType = FiTrash2
export const IconPause: IconType = FiPause
export const IconPlay: IconType = FiPlay
export const IconUp: IconType = FiTrendingUp
export const IconDown: IconType = FiTrendingDown
export const IconShare: IconType = FiShare2
export const IconDownload: IconType = FiDownload
export const IconSend: IconType = FiUpload
export const IconMail: IconType = FiMail

/* --- voice & audio ------------------------------------------------- */
export const IconMic: IconType = FiMic
export const IconMicStop: IconType = FiSquare

/* --- yes / no ------------------------------------------------------- */
export const IconYes: IconType = FiThumbsUp
export const IconNo: IconType = FiThumbsDown

/* --- the two audiences --------------------------------------------- */
export const IconSell: IconType = FiShoppingBag
export const IconBuy: IconType = FiShoppingCart
export const IconSeller: IconType = FiUser
export const IconBuyers: IconType = FiUsers
export const IconIndividual: IconType = FiUser
export const IconGroup: IconType = FiUsers

/* --- seller tabs ---------------------------------------------------- */
export const IconBusiness: IconType = FiHome
export const IconAddProduct: IconType = FiPlusCircle
export const IconProfile: IconType = FiUser
export const IconHelp: IconType = FiHelpCircle
export const IconTraining: IconType = FiPlayCircle

/* --- customer tabs -------------------------------------------------- */
export const IconExplore: IconType = FiSearch
export const IconCategories: IconType = FiGrid
export const IconCart: IconType = FiShoppingCart

/* --- things the app is made of -------------------------------------- */
export const IconProduct: IconType = FiPackage
export const IconFood: IconType = MdOutlineFastfood
export const IconOrders: IconType = FiFileText
export const IconGrowth: IconType = FiTrendingUp
export const IconAllClear: IconType = FiCheckCircle
export const IconSearch: IconType = FiSearch
export const IconStar: IconType = FiStar

/* --- getting in touch, and getting paid ----------------------------- */
export const IconCall: IconType = FiPhone
export const IconWhatsapp: IconType = FaWhatsapp
export const IconMap: IconType = FiMapPin
export const IconCash: IconType = MdCurrencyRupee
export const IconUpi: IconType = FiSmartphone

/* --- photos ---------------------------------------------------------- */
export const IconCamera: IconType = FiCamera
export const IconGallery: IconType = FiImage

/* --- addresses -------------------------------------------------------- */
export const IconAddressHome: IconType = FiHome
export const IconAddressOther: IconType = FiBriefcase

/* --- landing ---------------------------------------------------------- */
export const IconQr: IconType = MdQrCode2
export const IconVillage: IconType = FiHome
export const IconSafe: IconType = FiLock
