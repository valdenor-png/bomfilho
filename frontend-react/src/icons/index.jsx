import React from 'react';
import {
  Accessibility,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BadgeHelp,
  BadgeX,
  Ban,
  Banknote,
  BarChart3,
  Bell,
  Bike,
  BookOpen,
  Car,
  ChartCandlestick,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDollarSign,
  CircleHelp,
  CircleUserRound,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileBarChart,
  FileClock,
  FileSpreadsheet,
  FileText,
  Flame,
  FolderSearch,
  Grid2x2,
  Heart,
  Hourglass,
  House,
  ImageOff,
  Info,
  Keyboard,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageCircleQuestion,
  Milestone,
  MinusCircle,
  Package,
  PackageCheck,
  PackageX,
  Phone,
  Plus,
  PlusCircle,
  Printer,
  QrCode,
  Radio,
  Receipt,
  RefreshCw,
  Repeat2,
  ScanSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Store,
  Tag,
  Target,
  Ticket,
  TicketPercent,
  TimerOff,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Truck,
  Upload,
  User,
  Users,
  Wallet,
  X,
  Zap
} from 'lucide-react';

// Navegacao principal
export const IconHome = House;
export const IconProducts = Grid2x2;
export const IconOrders = ClipboardList;
export const IconAccount = CircleUserRound;
export const IconSearch = Search;
export const IconBack = ArrowLeft;
export const IconClose = X;
export const IconMenu = Menu;

// Catalogo e produto
export const IconTag = Tag;
export const IconOffer = Flame;
export const IconFavorite = Heart;
export const IconCart = ShoppingCart;
export const IconPackage = Package;
export const IconStore = Store;
export const IconPrice = Wallet;
export const IconUnavailable = PackageX;
export const IconNoImage = ImageOff;

// Carrinho
export const IconCartItem = Package;
export const IconCartAlert = TriangleAlert;
export const IconAdd = Plus;
export const IconRemove = Trash2;
export const IconIncrease = PlusCircle;
export const IconDecrease = MinusCircle;
export const IconConfirmed = CircleCheck;

// Checkout entrega
export const IconMapPin = MapPin;
export const IconDelivery = Truck;
export const IconPickup = Store;
export const IconBike = Bike;
export const IconMoto = Bike;
export const IconCar = Car;
export const IconSelected = CircleCheck;

// Checkout pagamento
export const IconPix = Zap;
export const IconCreditCard = CreditCard;
export const IconDebitCard = CreditCard;
export const IconQRCode = QrCode;
export const IconCopy = Copy;
export const IconSecurity = ShieldCheck;
export const IconReceipt = Receipt;
export const IconStepCheck = CircleCheck;

// Status de pagamento
export const IconPending = Clock;
export const IconAnalysis = ScanSearch;
export const IconAuthorized = BadgeCheck;
export const IconPaid = CircleCheck;
export const IconDeclined = CircleX;
export const IconCanceled = Ban;
export const IconExpired = TimerOff;

// Pedidos cliente
export const IconReview = ClipboardCheck;
export const IconWaiting = Hourglass;
export const IconOrderPaid = CircleDollarSign;
export const IconPreparing = ChefHat;
export const IconReady = PackageCheck;
export const IconDelivered = House;
export const IconPickedUp = ShoppingBag;
export const IconOrderCanceled = PackageX;
export const IconTracking = Milestone;

// Conta
export const IconUser = CircleUserRound;
export const IconEmail = Mail;
export const IconPhone = Phone;
export const IconAddress = MapPin;
export const IconPayments = CreditCard;
export const IconCoupons = Ticket;
export const IconFavorites = Heart;
export const IconSupport = MessageCircleQuestion;
export const IconShield = ShieldCheck;
export const IconAccessibility = Accessibility;
export const IconPreferences = SlidersHorizontal;
export const IconShortcuts = Keyboard;

// Admin
export const IconDashboard = LayoutDashboard;
export const IconLive = Radio;
export const IconAdminOrders = ClipboardList;
export const IconCatalog = BookOpen;
export const IconCustomers = Users;
export const IconImport = Upload;
export const IconFinance = Banknote;
export const IconFinanceAdv = ChartCandlestick;
export const IconReports = FileBarChart;
export const IconAudit = FileClock;
export const IconNotifications = Bell;
export const IconTarget = Target;
export const IconPerformance = Zap;
export const IconChart = TrendingUp;
export const IconDownload = Download;
export const IconRefresh = RefreshCw;
export const IconLogout = LogOut;
export const IconPrev = ChevronLeft;
export const IconNext = ChevronRight;
export const IconChevron = ChevronDown;

// Feedback global
export const IconSuccess = CircleCheck;
export const IconError = CircleX;
export const IconWarning = TriangleAlert;
export const IconInfo = Info;
export const IconLoading = LoaderCircle;
export const IconLock = Lock;

// Compatibilidade legada: componentes que ainda importam nomes do Lucide diretamente
export {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeHelp,
  BadgeX,
  BarChart3,
  Bell,
  ChevronRight,
  Circle,
  CircleCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  FolderSearch,
  Heart,
  House,
  Info,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Printer,
  QrCode,
  Radio,
  Receipt,
  RefreshCw,
  Repeat2,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Target,
  TicketPercent,
  Truck,
  User,
  Users,
  Wallet,
  X,
  Zap
};

const ICON_REGISTRY = {
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
  IconLock,
};

const ICON_REGISTRY_KEYS_LOWER = Object.keys(ICON_REGISTRY).reduce((acc, key) => {
  acc[key.toLowerCase()] = key;
  return acc;
}, {});

const LEGACY_ICON_NAME_MAP = {
  'pix': 'IconPix',
  'credit-card': 'IconCreditCard',
  'debit-card': 'IconDebitCard',
  'pending': 'IconPending',
  'analysis': 'IconAnalysis',
  'authorized': 'IconAuthorized',
  'paid': 'IconPaid',
  'declined': 'IconDeclined',
  'canceled': 'IconCanceled',
  'expired': 'IconExpired',
  'warning': 'IconWarning',
  'error': 'IconError',
  'success': 'IconSuccess',
  'info': 'IconInfo',
  'lock': 'IconLock',
  'home': 'IconHome',
  'products': 'IconProducts',
  'orders': 'IconOrders',
  'account': 'IconAccount',
  'cart': 'IconCart',
  'store': 'IconStore',
  'wallet': 'IconPrice',
  'shopping-cart': 'IconCart',
  'package': 'IconPackage',
  'map-pin': 'IconMapPin',
  'delivery': 'IconDelivery',
  'pickup': 'IconPickup',
  'bike': 'IconBike',
  'moto': 'IconMoto',
  'car': 'IconCar'
};

function resolveIconRegistryName(name) {
  const raw = String(name || '').trim();
  if (!raw) {
    return null;
  }

  if (ICON_REGISTRY[raw]) {
    return raw;
  }

  const lower = raw.toLowerCase();
  if (ICON_REGISTRY_KEYS_LOWER[lower]) {
    return ICON_REGISTRY_KEYS_LOWER[lower];
  }

  if (LEGACY_ICON_NAME_MAP[lower]) {
    return LEGACY_ICON_NAME_MAP[lower];
  }

  return null;
}

export function Icon({ name, size = 20, fallback = IconInfo, ...props }) {
  const resolvedName = resolveIconRegistryName(name);
  const ResolvedComponent = resolvedName ? ICON_REGISTRY[resolvedName] : null;
  const FallbackComponent = typeof fallback === 'function' ? fallback : IconInfo;
  const IconComponent = ResolvedComponent || FallbackComponent || CircleHelp;
  const resolvedSize = Number.isFinite(Number(size)) && Number(size) > 0 ? Number(size) : 20;
  return <IconComponent size={resolvedSize} {...props} />;
}
