export type ResultType = 'ticket' | 'reminder' | 'project' | 'piket' | 'unit' | 'user'
  | 'progress' | 'technote' | 'daily' | 'review' | 'materi';

export interface SearchResult {
  id: string;
  type: ResultType;
  icon: string;
  title: string;
  sub: string;
  meta: string;
  url?: string;
  badge?: string;
  badgeColor?: string;
}

export const TYPE_CONFIG: Record<ResultType, { label: string; color: string; bg: string }> = {
  ticket:   { label: 'Ticket',         color: '#be123c', bg: 'rgba(254,205,211,0.5)' },
  reminder: { label: 'Reminder',       color: '#0e7490', bg: 'rgba(207,250,254,0.5)' },
  project:  { label: 'Form Require',   color: '#7e22ce', bg: 'rgba(233,213,255,0.5)' },
  piket:    { label: 'Piket Showroom', color: '#0f766e', bg: 'rgba(204,251,241,0.5)' },
  unit:     { label: 'Unit Movement',  color: '#92400e', bg: 'rgba(254,243,199,0.5)' },
  user:     { label: 'User',           color: '#374151', bg: 'rgba(243,244,246,0.8)' },
  progress: { label: 'Project Progress', color: '#0e7490', bg: 'rgba(207,250,254,0.5)' },
  technote: { label: 'Tech Note',      color: '#3730a3', bg: 'rgba(224,231,255,0.6)' },
  daily:    { label: 'Daily Report',   color: '#065f46', bg: 'rgba(209,250,229,0.5)' },
  review:   { label: 'Form Review',    color: '#b45309', bg: 'rgba(254,243,199,0.5)' },
  materi:   { label: 'Learning Center', color: '#1d4ed8', bg: 'rgba(219,234,254,0.6)' },
};

export const ALL_TYPES: ResultType[] = [
  'ticket','reminder','project','progress','review','daily',
  'piket','unit','technote','materi','user',
];
