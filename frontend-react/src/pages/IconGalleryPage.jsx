import React from 'react';
import InternalTopBar from '../components/navigation/InternalTopBar';
import {
  Icon,
  IconHome,
  IconProducts,
  IconOrders,
  IconAccount,
  IconSearch,
  IconBack,
  IconClose,
  IconMenu,
  IconTag,
  IconOffer,
  IconFavorite,
  IconCart,
  IconPackage,
  IconStore,
  IconPrice,
  IconUnavailable,
  IconNoImage,
  IconCartItem,
  IconCartAlert,
  IconAdd,
  IconRemove,
  IconIncrease,
  IconDecrease,
  IconConfirmed,
  IconMapPin,
  IconDelivery,
  IconPickup,
  IconBike,
  IconMoto,
  IconCar,
  IconSelected,
  IconPix,
  IconCreditCard,
  IconDebitCard,
  IconQRCode,
  IconCopy,
  IconSecurity,
  IconReceipt,
  IconStepCheck,
  IconPending,
  IconAnalysis,
  IconAuthorized,
  IconPaid,
  IconDeclined,
  IconCanceled,
  IconExpired,
  IconReview,
  IconWaiting,
  IconOrderPaid,
  IconPreparing,
  IconReady,
  IconDelivered,
  IconPickedUp,
  IconOrderCanceled,
  IconTracking,
  IconUser,
  IconEmail,
  IconPhone,
  IconAddress,
  IconPayments,
  IconCoupons,
  IconFavorites,
  IconSupport,
  IconShield,
  IconAccessibility,
  IconPreferences,
  IconShortcuts,
  IconDashboard,
  IconLive,
  IconAdminOrders,
  IconCatalog,
  IconCustomers,
  IconImport,
  IconFinance,
  IconFinanceAdv,
  IconReports,
  IconAudit,
  IconNotifications,
  IconTarget,
  IconPerformance,
  IconChart,
  IconDownload,
  IconRefresh,
  IconLogout,
  IconPrev,
  IconNext,
  IconChevron,
  IconSuccess,
  IconError,
  IconWarning,
  IconInfo,
  IconLoading,
  IconLock
} from '../icons';

const ICON_SECTIONS = [
  {
    title: 'Navegacao Principal',
    items: [
      { name: 'IconHome', source: 'House', Component: IconHome },
      { name: 'IconProducts', source: 'Grid2x2', Component: IconProducts },
      { name: 'IconOrders', source: 'ClipboardList', Component: IconOrders },
      { name: 'IconAccount', source: 'CircleUserRound', Component: IconAccount },
      { name: 'IconSearch', source: 'Search', Component: IconSearch },
      { name: 'IconBack', source: 'ArrowLeft', Component: IconBack },
      { name: 'IconClose', source: 'X', Component: IconClose },
      { name: 'IconMenu', source: 'Menu', Component: IconMenu }
    ]
  },
  {
    title: 'Catalogo E Produto',
    items: [
      { name: 'IconTag', source: 'Tag', Component: IconTag },
      { name: 'IconOffer', source: 'Flame', Component: IconOffer },
      { name: 'IconFavorite', source: 'Heart', Component: IconFavorite },
      { name: 'IconCart', source: 'ShoppingCart', Component: IconCart },
      { name: 'IconPackage', source: 'Package', Component: IconPackage },
      { name: 'IconStore', source: 'Store', Component: IconStore },
      { name: 'IconPrice', source: 'Wallet', Component: IconPrice },
      { name: 'IconUnavailable', source: 'PackageX', Component: IconUnavailable },
      { name: 'IconNoImage', source: 'ImageOff', Component: IconNoImage }
    ]
  },
  {
    title: 'Carrinho',
    items: [
      { name: 'IconCartItem', source: 'Package', Component: IconCartItem },
      { name: 'IconCartAlert', source: 'TriangleAlert', Component: IconCartAlert },
      { name: 'IconAdd', source: 'Plus', Component: IconAdd },
      { name: 'IconRemove', source: 'Trash2', Component: IconRemove },
      { name: 'IconIncrease', source: 'PlusCircle', Component: IconIncrease },
      { name: 'IconDecrease', source: 'MinusCircle', Component: IconDecrease },
      { name: 'IconConfirmed', source: 'CircleCheck', Component: IconConfirmed }
    ]
  },
  {
    title: 'Checkout Entrega',
    items: [
      { name: 'IconMapPin', source: 'MapPin', Component: IconMapPin },
      { name: 'IconDelivery', source: 'Truck', Component: IconDelivery },
      { name: 'IconPickup', source: 'Store', Component: IconPickup },
      { name: 'IconBike', source: 'Bike', Component: IconBike },
      { name: 'IconMoto', source: 'Bike', Component: IconMoto },
      { name: 'IconCar', source: 'Car', Component: IconCar },
      { name: 'IconSelected', source: 'CircleCheck', Component: IconSelected }
    ]
  },
  {
    title: 'Checkout Pagamento',
    items: [
      { name: 'IconPix', source: 'Zap', Component: IconPix },
      { name: 'IconCreditCard', source: 'CreditCard', Component: IconCreditCard },
      { name: 'IconDebitCard', source: 'CreditCard', Component: IconDebitCard },
      { name: 'IconQRCode', source: 'QrCode', Component: IconQRCode },
      { name: 'IconCopy', source: 'Copy', Component: IconCopy },
      { name: 'IconSecurity', source: 'ShieldCheck', Component: IconSecurity },
      { name: 'IconReceipt', source: 'Receipt', Component: IconReceipt },
      { name: 'IconStepCheck', source: 'CircleCheck', Component: IconStepCheck }
    ]
  },
  {
    title: 'Status De Pagamento',
    items: [
      { name: 'IconPending', source: 'Clock', Component: IconPending },
      { name: 'IconAnalysis', source: 'ScanSearch', Component: IconAnalysis },
      { name: 'IconAuthorized', source: 'BadgeCheck', Component: IconAuthorized },
      { name: 'IconPaid', source: 'CircleCheck', Component: IconPaid },
      { name: 'IconDeclined', source: 'CircleX', Component: IconDeclined },
      { name: 'IconCanceled', source: 'Ban', Component: IconCanceled },
      { name: 'IconExpired', source: 'TimerOff', Component: IconExpired }
    ]
  },
  {
    title: 'Pedidos Cliente',
    items: [
      { name: 'IconReview', source: 'ClipboardCheck', Component: IconReview },
      { name: 'IconWaiting', source: 'Hourglass', Component: IconWaiting },
      { name: 'IconOrderPaid', source: 'CircleDollarSign', Component: IconOrderPaid },
      { name: 'IconPreparing', source: 'ChefHat', Component: IconPreparing },
      { name: 'IconReady', source: 'PackageCheck', Component: IconReady },
      { name: 'IconDelivered', source: 'House', Component: IconDelivered },
      { name: 'IconPickedUp', source: 'ShoppingBag', Component: IconPickedUp },
      { name: 'IconOrderCanceled', source: 'PackageX', Component: IconOrderCanceled },
      { name: 'IconTracking', source: 'Milestone', Component: IconTracking }
    ]
  },
  {
    title: 'Conta',
    items: [
      { name: 'IconUser', source: 'CircleUserRound', Component: IconUser },
      { name: 'IconEmail', source: 'Mail', Component: IconEmail },
      { name: 'IconPhone', source: 'Phone', Component: IconPhone },
      { name: 'IconAddress', source: 'MapPin', Component: IconAddress },
      { name: 'IconPayments', source: 'CreditCard', Component: IconPayments },
      { name: 'IconCoupons', source: 'Ticket', Component: IconCoupons },
      { name: 'IconFavorites', source: 'Heart', Component: IconFavorites },
      { name: 'IconSupport', source: 'MessageCircleQuestion', Component: IconSupport },
      { name: 'IconShield', source: 'ShieldCheck', Component: IconShield },
      { name: 'IconAccessibility', source: 'Accessibility', Component: IconAccessibility },
      { name: 'IconPreferences', source: 'SlidersHorizontal', Component: IconPreferences },
      { name: 'IconShortcuts', source: 'Keyboard', Component: IconShortcuts }
    ]
  },
  {
    title: 'Admin',
    items: [
      { name: 'IconDashboard', source: 'LayoutDashboard', Component: IconDashboard },
      { name: 'IconLive', source: 'Radio', Component: IconLive },
      { name: 'IconAdminOrders', source: 'ClipboardList', Component: IconAdminOrders },
      { name: 'IconCatalog', source: 'BookOpen', Component: IconCatalog },
      { name: 'IconCustomers', source: 'Users', Component: IconCustomers },
      { name: 'IconImport', source: 'Upload', Component: IconImport },
      { name: 'IconFinance', source: 'Banknote', Component: IconFinance },
      { name: 'IconFinanceAdv', source: 'ChartCandlestick', Component: IconFinanceAdv },
      { name: 'IconReports', source: 'FileBarChart', Component: IconReports },
      { name: 'IconAudit', source: 'FileClock', Component: IconAudit },
      { name: 'IconNotifications', source: 'Bell', Component: IconNotifications },
      { name: 'IconTarget', source: 'Target', Component: IconTarget },
      { name: 'IconPerformance', source: 'Zap', Component: IconPerformance },
      { name: 'IconChart', source: 'TrendingUp', Component: IconChart },
      { name: 'IconDownload', source: 'Download', Component: IconDownload },
      { name: 'IconRefresh', source: 'RefreshCw', Component: IconRefresh },
      { name: 'IconLogout', source: 'LogOut', Component: IconLogout },
      { name: 'IconPrev', source: 'ChevronLeft', Component: IconPrev },
      { name: 'IconNext', source: 'ChevronRight', Component: IconNext },
      { name: 'IconChevron', source: 'ChevronDown', Component: IconChevron }
    ]
  },
  {
    title: 'Feedback Global',
    items: [
      { name: 'IconSuccess', source: 'CircleCheck', Component: IconSuccess },
      { name: 'IconError', source: 'CircleX', Component: IconError },
      { name: 'IconWarning', source: 'TriangleAlert', Component: IconWarning },
      { name: 'IconInfo', source: 'Info', Component: IconInfo },
      { name: 'IconLoading', source: 'LoaderCircle', Component: IconLoading },
      { name: 'IconLock', source: 'Lock', Component: IconLock }
    ]
  }
];

export default function IconGalleryPage() {
  return (
    <section className="page icon-gallery-page">
      <InternalTopBar
        title="Galeria de Icones"
        subtitle="Visualizacao dos icones semanticos do projeto"
        showBack
        fallbackTo="/"
        backLabel="Voltar para inicio"
      />

      <div className="icon-gallery-header">
        <p>Rota: <code>/icons</code></p>
        <p>Exemplo dinamico: <span className="icon-gallery-inline-demo"><Icon name="IconHome" size={18} /> Icon name=&quot;IconHome&quot;</span></p>
      </div>

      {ICON_SECTIONS.map((section) => (
        <article key={section.title} className="icon-gallery-section">
          <h2>{section.title}</h2>
          <div className="icon-gallery-grid">
            {section.items.map((item) => (
              <div key={item.name} className="icon-gallery-card">
                <span className="icon-gallery-preview" aria-hidden="true">
                  <item.Component size={22} strokeWidth={2} />
                </span>
                <strong>{item.name}</strong>
                <small>{item.source}</small>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
