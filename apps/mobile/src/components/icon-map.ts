import Zap from "lucide-react-native/icons/zap";
import Compass from "lucide-react-native/icons/compass";
import UsersRound from "lucide-react-native/icons/users-round";
import Search from "lucide-react-native/icons/search";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Star from "lucide-react-native/icons/star";
import Check from "lucide-react-native/icons/check";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import CircleCheck from "lucide-react-native/icons/circle-check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Bell from "lucide-react-native/icons/bell";
import House from "lucide-react-native/icons/house";
import MessageCircle from "lucide-react-native/icons/message-circle";
import UserRound from "lucide-react-native/icons/user-round";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Plus from "lucide-react-native/icons/plus";
import LogOut from "lucide-react-native/icons/log-out";
import Clock from "lucide-react-native/icons/clock-3";
import BookOpenText from "lucide-react-native/icons/book-open-text";
import X from "lucide-react-native/icons/x";
import Wallet from "lucide-react-native/icons/wallet";
import Settings from "lucide-react-native/icons/settings-2";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import Trash from "lucide-react-native/icons/trash";
import CircleHelp from "lucide-react-native/icons/circle-question-mark";
import SquarePen from "lucide-react-native/icons/square-pen";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Medal from "lucide-react-native/icons/medal";
import Lock from "lucide-react-native/icons/lock-keyhole";
import Flag from "lucide-react-native/icons/flag";
import Send from "lucide-react-native/icons/send";
import Paperclip from "lucide-react-native/icons/paperclip";
import Image from "lucide-react-native/icons/image";
import Video from "lucide-react-native/icons/video";
import WifiOff from "lucide-react-native/icons/wifi-off";

// Keep semantic names stable for every screen. Per-icon imports avoid loading the catalog.
export const iconComponents = {
  zap: Zap,
  compass: Compass,
  users: UsersRound,
  search: Search,
  arrow: ArrowRight,
  star: Star,
  check: Check,
  eye: Eye,
  "eye-off": EyeOff,
  alert: TriangleAlert,
  "check-circle": CircleCheck,
  chevron: ChevronRight,
  bell: Bell,
  home: House,
  message: MessageCircle,
  user: UserRound,
  calendar: CalendarDays,
  plus: Plus,
  logout: LogOut,
  clock: Clock,
  book: BookOpenText,
  close: X,
  wallet: Wallet,
  settings: Settings,
  filter: SlidersHorizontal,
  clipboard: ClipboardList,
  trash: Trash,
  help: CircleHelp,
  edit: SquarePen,
  shield: ShieldCheck,
  award: Medal,
  lock: Lock,
  flag: Flag,
  send: Send,
  paperclip: Paperclip,
  image: Image,
  video: Video,
  "wifi-off": WifiOff,
} as const;
export type IconName = keyof typeof iconComponents;
