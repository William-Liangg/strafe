import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatTriggerMode(mode: string): string {
  switch (mode) {
    case 'auto':
      return 'Auto-detected'
    case 'slash_command':
      return 'Slash command'
    case 'emoji':
      return 'Emoji reaction'
    case 'manual':
      return 'Manual'
    default:
      return mode
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#E2534A', '#F59E0B', '#3B82F6', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1',
    '#06B6D4', '#84CC16', '#EF4444', '#10B981',
  ]
  return colors[Math.abs(hash) % colors.length]
}
