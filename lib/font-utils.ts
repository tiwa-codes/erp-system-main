/**
 * Inter Font Utilities
 * 
 * This file provides utility functions and constants for using Google Inter font
 * throughout the application with proper weight and style variations.
 */

// Font weight constants
export const FONT_WEIGHTS = {
  THIN: 100,
  EXTRALIGHT: 200,
  LIGHT: 300,
  REGULAR: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700,
  EXTRABOLD: 800,
  BLACK: 900,
} as const

// Font style constants
export const FONT_STYLES = {
  NORMAL: 'normal',
  ITALIC: 'italic',
} as const

// Utility function to get Inter font class name
export function getInterFontClass(weight: number = FONT_WEIGHTS.REGULAR, italic: boolean = false): string {
  const weightMap: Record<number, string> = {
    100: 'inter-thin',
    200: 'inter-extralight',
    300: 'inter-light',
    400: 'inter-regular',
    500: 'inter-medium',
    600: 'inter-semibold',
    700: 'inter-bold',
    800: 'inter-extrabold',
    900: 'inter-black',
  }

  const baseClass = weightMap[weight] || 'inter-regular'
  return italic ? `${baseClass}-italic` : baseClass
}

// Common font combinations for different UI elements
export const FONT_CLASSES = {
  // Headers
  H1: 'inter-bold text-2xl',
  H2: 'inter-semibold text-xl',
  H3: 'inter-semibold text-lg',
  H4: 'inter-medium text-base',
  H5: 'inter-medium text-sm',
  H6: 'inter-medium text-xs',
  
  // Body text
  BODY_LARGE: 'inter-regular text-base',
  BODY: 'inter-regular text-sm',
  BODY_SMALL: 'inter-regular text-xs',
  
  // UI elements
  BUTTON: 'inter-medium text-xs',
  LABEL: 'inter-medium text-xs',
  CAPTION: 'inter-regular text-xs',
  
  // Special cases
  DISPLAY: 'inter-bold text-3xl',
  SUBTITLE: 'inter-medium text-sm',
} as const

// Tailwind CSS classes for Inter font
export const INTER_CLASSES = {
  THIN: 'inter-thin',
  EXTRALIGHT: 'inter-extralight',
  LIGHT: 'inter-light',
  REGULAR: 'inter-regular',
  MEDIUM: 'inter-medium',
  SEMIBOLD: 'inter-semibold',
  BOLD: 'inter-bold',
  EXTRABOLD: 'inter-extrabold',
  BLACK: 'inter-black',
  
  // Italic variants
  THIN_ITALIC: 'inter-thin-italic',
  EXTRALIGHT_ITALIC: 'inter-extralight-italic',
  LIGHT_ITALIC: 'inter-light-italic',
  REGULAR_ITALIC: 'inter-regular-italic',
  MEDIUM_ITALIC: 'inter-medium-italic',
  SEMIBOLD_ITALIC: 'inter-semibold-italic',
  BOLD_ITALIC: 'inter-bold-italic',
  EXTRABOLD_ITALIC: 'inter-extrabold-italic',
  BLACK_ITALIC: 'inter-black-italic',
} as const

// Type definitions
export type FontWeight = typeof FONT_WEIGHTS[keyof typeof FONT_WEIGHTS]
export type FontStyle = typeof FONT_STYLES[keyof typeof FONT_STYLES]
export type FontClass = typeof FONT_CLASSES[keyof typeof FONT_CLASSES]
export type InterClass = typeof INTER_CLASSES[keyof typeof INTER_CLASSES]
