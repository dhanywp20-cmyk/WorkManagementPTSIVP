'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Server, SlidersVertical, BrickWall, ChartColumn, ClipboardList, Users, Target, Package, Building2, User, ChartPie, Store, Ticket,
  FileText, CalendarDays, Compass, House, GraduationCap, Star, Truck, Clock, Link, Pin, TrendingUp,
  TriangleAlert, Siren, Hand, KeyRound, Lock, Search, Camera, Smartphone, MapPin, File, Folder,
  HardHat, Briefcase, Trophy, Medal, Plane, CircleCheck, Upload, Construction, Hourglass, Wallet,
  FolderKanban, Monitor, Printer, Projector, Box, Cable, Tv, Volume2, TabletSmartphone, Wrench, BookOpen, CircleX, Hammer, RefreshCw, Crown, Pencil, Ruler, Save,
  Tag, Ban, Calculator, Puzzle, Shield, Award, Handshake, Car, Rocket, Trash2, Archive, Microscope,
  Bell, LockOpen, Disc, Satellite, Phone, Palette, SlidersHorizontal, Sparkles, Globe, Plus, Check,
  PenLine, Settings, Play, Pause, AlarmClock, Keyboard, Info, Banknote, Theater, Drama, CalendarCheck,
  MessageSquare, Inbox, Presentation, Shuffle, Plug, Zap, Lightbulb, Undo2, Timer, Bot, Hash, Download,
  Flag, Mail, Eye, Image, Cloud, PartyPopper, Landmark, Paperclip, Laptop, SkipForward, Dices, Scale,
} from 'lucide-react';

const PETA: Record<string, LucideIcon> = {
  '📊': ChartColumn, '📈': TrendingUp, '🥧': ChartPie, '📋': ClipboardList, '📝': FileText,
  '👥': Users, '👤': User, '🙋': Hand, '👷': HardHat, '👔': Briefcase, '🦺': HardHat,
  '🎯': Target, '📦': Package, '🏢': Building2, '🏪': Store, '🏠': House, '🎫': Ticket,
  '📅': CalendarDays, '🗓': CalendarDays, '🧭': Compass, '🎓': GraduationCap, '📚': BookOpen,
  '⭐': Star, '🌟': Sparkles, '🚚': Truck, '🕐': Clock, '⏰': AlarmClock, '⏳': Hourglass,
  '🔗': Link, '📌': Pin, '📍': MapPin, '⚠': TriangleAlert, '🚨': Siren, '🔜': Clock,
  '🔑': KeyRound, '🔐': Lock, '🔒': Lock, '🔓': LockOpen, '🔍': Search, '📸': Camera, '📷': Camera,
  '📲': Smartphone, '📱': Smartphone, '📄': File, '📁': Folder, '🗂': FolderKanban, '🗃': Archive,
  '🏆': Trophy, '🏅': Medal, '🥇': Award, '🎖': Award, '🎭': Drama, '✈': Plane,
  '✅': CircleCheck, '✔': Check, '❌': CircleX, '⛔': Ban, '🚫': Ban, '📤': Upload,
  '🏗': Construction, '💰': Wallet, '💵': Banknote, '💼': Briefcase, '🖥': Monitor, '📺': Tv, '🖨': Printer, '📽': Projector, '🧊': Box, '〰': Cable, '🔊': Volume2, '🏧': TabletSmartphone,
  '🗄': Server, '🎚': SlidersVertical, '🧱': BrickWall, '📘': BookOpen,
  '🔧': Wrench, '🛠': Hammer, '🔄': RefreshCw, '👑': Crown, '✏': Pencil, '✍': PenLine,
  '📐': Ruler, '💾': Save, '🏷': Tag, '🧮': Calculator, '🧩': Puzzle, '🛡': Shield,
  '🤝': Handshake, '🚗': Car, '🚀': Rocket, '🗑': Trash2, '🔬': Microscope, '🔔': Bell,
  '💿': Disc, '📡': Satellite, '📞': Phone, '🎨': Palette, '🎛': SlidersHorizontal,
  '🌐': Globe, '➕': Plus, '⚙': Settings, '▶': Play, '⏸': Pause, '⌨': Keyboard, 'ℹ': Info,
  '📆': CalendarCheck, '📭': Inbox, '🔀': Shuffle, '🔌': Plug, '⚡': Zap, '✨': Sparkles, '💡': Lightbulb, '↩': Undo2,
  '⏱': Timer, '🤖': Bot, '🔢': Hash, '⬇': Download, '🎌': Flag, '📩': Mail, '🌏': Globe, '👁': Eye,
  '🖼': Image, '☁': Cloud, '🕘': Clock, '🎉': PartyPopper, '🏘': Building2, '🏛': Landmark, '🖐': Hand,
  '📎': Paperclip, '💻': Laptop, '⏭': SkipForward, '🎲': Dices, '🗒': FileText, '📃': FileText, '🧾': FileText, '💬': MessageSquare, '📥': Inbox, '🎤': Presentation, '🎬': Theater, '⚖': Scale,
};

function kunci(emoji: string): string {
  return emoji.replace(/[︎️‍]/g, '').trim();
}

export function ikonUntuk(emoji: string | null | undefined): LucideIcon | null {
  if (!emoji) return null;
  return PETA[kunci(emoji)] ?? null;
}

export function Ikon({ nama, ukuran = 16, tebal = 2, className = '' }: {
  nama: React.ReactNode; ukuran?: number | string; tebal?: number; className?: string;
}) {
  if (!nama) return null;
  if (typeof nama !== 'string') return <>{nama}</>;
  const K = ikonUntuk(nama);
  if (!K) return <span aria-hidden="true" className={className} style={{ fontSize: typeof ukuran === 'number' ? ukuran * 0.9 : ukuran, lineHeight: 1 }}>{nama}</span>;
  // eslint-disable-next-line react-hooks/static-components
  return <K aria-hidden="true" focusable="false" size={ukuran} strokeWidth={tebal} className={`shrink-0 ${className}`} />;
}

export function IkonTeks({ nama }: { nama: string }) {
  return <Ikon nama={nama} ukuran="1.1em" className="inline-block align-[-0.18em] mr-1 opacity-80" />;
}
