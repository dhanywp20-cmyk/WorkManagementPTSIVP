'use client';

/**
 * components/shared/Ikon.tsx - ikon garis (lucide) sebagai pengganti emoji.
 *
 * Emoji dipakai sebagai ikon di seluruh platform (judul halaman, kartu,
 * chart, menu): tampilannya berbeda per sistem operasi, ramai warna, dan
 * membuat aplikasi kerja terlihat seperti aplikasi obrolan. Mengganti ratusan
 * pemanggil satu per satu berisiko; jadi komponen bersama menerima `icon`
 * seperti biasa - string emoji - dan menerjemahkannya di sini.
 *
 * Emoji yang belum dipetakan tetap tampil apa adanya (tidak ada yang hilang),
 * jadi pemetaan bisa dilengkapi bertahap.
 */

import type { LucideIcon } from 'lucide-react';
import {
  ChartColumn, ClipboardList, Users, Target, Package, Building2, User, ChartPie, Store, Ticket,
  FileText, CalendarDays, Compass, House, GraduationCap, Star, Truck, Clock, Link, Pin, TrendingUp,
  TriangleAlert, Siren, Hand, KeyRound, Lock, Search, Camera, Smartphone, MapPin, File, Folder,
  HardHat, Briefcase, Trophy, Medal, Plane, CircleCheck, Upload, Construction, Hourglass, Wallet,
  FolderKanban, Monitor, Wrench, BookOpen, CircleX, Hammer, RefreshCw, Crown, Pencil, Ruler, Save,
  Tag, Ban, Calculator, Puzzle, Shield, Award, Handshake, Car, Rocket, Trash2, Archive, Microscope,
  Bell, LockOpen, Disc, Satellite, Phone, Palette, SlidersHorizontal, Sparkles, Globe, Plus, Check,
  PenLine, Settings, Play, Pause, AlarmClock, Keyboard, Info, Banknote, Theater, Drama, CalendarCheck,
  MessageSquare, Inbox, Presentation, Shuffle, Plug, Zap, Lightbulb, Undo2, Timer, Bot, Hash, Download,
  Flag, Mail, Eye, Image, Cloud, PartyPopper, Landmark, Paperclip, Laptop, SkipForward, Dices,
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
  '🏗': Construction, '💰': Wallet, '💵': Banknote, '💼': Briefcase, '🖥': Monitor,
  '🔧': Wrench, '🛠': Hammer, '🔄': RefreshCw, '👑': Crown, '✏': Pencil, '✍': PenLine,
  '📐': Ruler, '💾': Save, '🏷': Tag, '🧮': Calculator, '🧩': Puzzle, '🛡': Shield,
  '🤝': Handshake, '🚗': Car, '🚀': Rocket, '🗑': Trash2, '🔬': Microscope, '🔔': Bell,
  '💿': Disc, '📡': Satellite, '📞': Phone, '🎨': Palette, '🎛': SlidersHorizontal,
  '🌐': Globe, '➕': Plus, '⚙': Settings, '▶': Play, '⏸': Pause, '⌨': Keyboard, 'ℹ': Info,
  '📆': CalendarCheck, '📭': Inbox, '🔀': Shuffle, '🔌': Plug, '⚡': Zap, '✨': Sparkles, '💡': Lightbulb, '↩': Undo2,
  '⏱': Timer, '🤖': Bot, '🔢': Hash, '⬇': Download, '🎌': Flag, '📩': Mail, '🌏': Globe, '👁': Eye,
  '🖼': Image, '☁': Cloud, '🕘': Clock, '🎉': PartyPopper, '🏘': Building2, '🏛': Landmark, '🖐': Hand,
  '📎': Paperclip, '💻': Laptop, '⏭': SkipForward, '🎲': Dices, '🗒': FileText, '📃': FileText, '🧾': FileText, '💬': MessageSquare, '📥': Inbox, '🎤': Presentation, '🎬': Theater,
};

/** Buang variation selector & zero-width joiner supaya '⚠️' dan '⚠' sama. */
function kunci(emoji: string): string {
  return emoji.replace(/[︎️‍]/g, '').trim();
}

export function ikonUntuk(emoji: string | null | undefined): LucideIcon | null {
  if (!emoji) return null;
  return PETA[kunci(emoji)] ?? null;
}

/**
 * Tampilkan ikon garis untuk sebuah emoji; emoji yang belum dipetakan
 * dirender apa adanya. `ukuran` dalam px; warna mengikuti `currentColor`.
 */
export function Ikon({ nama, ukuran = 16, tebal = 2, className = '' }: {
  /** Emoji (diterjemahkan) atau elemen React yang sudah jadi (diteruskan apa adanya). */
  /** px, atau string CSS seperti '1em' untuk ikon yang mengikuti ukuran teks di sekitarnya. */
  nama: React.ReactNode; ukuran?: number | string; tebal?: number; className?: string;
}) {
  if (!nama) return null;
  if (typeof nama !== 'string') return <>{nama}</>;
  const K = ikonUntuk(nama);
  if (!K) return <span aria-hidden="true" className={className} style={{ fontSize: typeof ukuran === 'number' ? ukuran * 0.9 : ukuran, lineHeight: 1 }}>{nama}</span>;
  return <K aria-hidden="true" focusable="false" size={ukuran} strokeWidth={tebal} className={`flex-shrink-0 ${className}`} />;
}

/**
 * Ikon di tengah kalimat/judul - ukuran mengikuti font di sekitarnya dan
 * duduk sejajar garis dasar teks. Dipakai codemod pengganti emoji dalam teks.
 */
export function IkonTeks({ nama }: { nama: string }) {
  return <Ikon nama={nama} ukuran="1.1em" className="inline-block align-[-0.18em] mr-1 opacity-80" />;
}
