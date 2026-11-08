/**
 * 公告富文本在深浅色下的对比度修正。
 * 只调整读不出来的实色文字/背景，保留其余排版（对齐、粗体、链接、图片）。
 * 商家设置的颜色在当前主题背景上达到 WCAG AA 正文对比度时原样保留。
 */

export type ContrastTheme = 'light' | 'dark'

type RGB = { r: number; g: number; b: number; a: number }

const MIN_CONTRAST = 4.5

const THEMES: Record<ContrastTheme, { bg: RGB; text: RGB }> = {
  light: {
    bg: { r: 255, g: 255, b: 255, a: 1 },
    text: { r: 29, g: 29, b: 31, a: 1 },
  },
  dark: {
    bg: { r: 28, g: 28, b: 30, a: 1 },
    text: { r: 245, g: 245, b: 247, a: 1 },
  },
}

const channel = (value: number) => {
  const scaled = value / 255
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

const luminance = (color: RGB) =>
  0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)

const contrast = (a: RGB, b: RGB) => {
  const lighter = Math.max(luminance(a), luminance(b))
  const darker = Math.min(luminance(a), luminance(b))
  return (lighter + 0.05) / (darker + 0.05)
}

const composite = (fg: RGB, bg: RGB): RGB => {
  const alpha = Math.min(1, Math.max(0, fg.a))
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
    a: 1,
  }
}

const parseHex = (hex: string): RGB | null => {
  const body = hex.slice(1)
  const expand = (index: number, width: number) => {
    const part = body.slice(index, index + width)
    return parseInt(width === 1 ? part + part : part, 16)
  }
  if (body.length === 3 || body.length === 4) {
    return {
      r: expand(0, 1),
      g: expand(1, 1),
      b: expand(2, 1),
      a: body.length === 4 ? expand(3, 1) / 255 : 1,
    }
  }
  if (body.length === 6 || body.length === 8) {
    return {
      r: expand(0, 2),
      g: expand(2, 2),
      b: expand(4, 2),
      a: body.length === 8 ? expand(6, 2) / 255 : 1,
    }
  }
  return null
}

export const parseCssColor = (value: string): RGB | null => {
  const raw = value.replace(/!important/gi, '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if (raw === 'white') return { r: 255, g: 255, b: 255, a: 1 }
  if (raw === 'black') return { r: 0, g: 0, b: 0, a: 1 }
  if (raw.startsWith('#')) return parseHex(raw)
  const match = raw.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
  if (!match) return null
  const alphaRaw = match[4]
  const alpha = alphaRaw === undefined
    ? 1
    : alphaRaw.endsWith('%')
      ? Number(alphaRaw.slice(0, -1)) / 100
      : Number(alphaRaw)
  if (![match[1], match[2], match[3], alpha].every((part) => Number.isFinite(Number(part)))) return null
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha }
}

const splitDeclarations = (css: string) => {
  const parts: string[] = []
  let current = ''
  let depth = 0
  for (const char of css) {
    if (char === '(') depth += 1
    if (char === ')' && depth > 0) depth -= 1
    if (char === ';' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

interface Declaration {
  raw: string
  prop: string
  value: string
}

const parseDeclarations = (css: string): Declaration[] =>
  splitDeclarations(css).flatMap((raw) => {
    const index = raw.indexOf(':')
    if (index <= 0) return []
    return [{
      raw,
      prop: raw.slice(0, index).trim().toLowerCase(),
      value: raw.slice(index + 1).trim(),
    }]
  })

const readable = (ink: RGB, surface: RGB) => contrast(composite(ink, surface), surface) >= MIN_CONTRAST

const adaptDeclarationBlock = (css: string, theme: ContrastTheme): string => {
  const declarations = parseDeclarations(css)
  if (declarations.length === 0) return css.trim()

  let colorIndex = -1
  let backgroundIndex = -1
  declarations.forEach((declaration, index) => {
    if (declaration.prop === 'color') colorIndex = index
    if (declaration.prop === 'background-color') backgroundIndex = index
    if (declaration.prop === 'background' && parseCssColor(declaration.value)) backgroundIndex = index
  })
  if (colorIndex < 0 && backgroundIndex < 0) return declarations.map((item) => item.raw).join('; ')

  const color = colorIndex >= 0 ? parseCssColor(declarations[colorIndex]!.value) : null
  const background = backgroundIndex >= 0 ? parseCssColor(declarations[backgroundIndex]!.value) : null
  if (colorIndex >= 0 && !color) return declarations.map((item) => item.raw).join('; ')
  if (backgroundIndex >= 0 && declarations[backgroundIndex]!.prop === 'background-color' && !background) {
    return declarations.map((item) => item.raw).join('; ')
  }

  const { bg: themeBg, text: themeText } = THEMES[theme]
  const surface = background ? composite(background, themeBg) : themeBg
  const ink = color ?? themeText
  const drop = new Set<number>()

  if (!readable(ink, surface)) {
    if (colorIndex >= 0 && readable(themeText, surface)) {
      drop.add(colorIndex)
    } else if (backgroundIndex >= 0 && readable(color ?? themeText, themeBg)) {
      drop.add(backgroundIndex)
    } else {
      if (colorIndex >= 0) drop.add(colorIndex)
      if (backgroundIndex >= 0) drop.add(backgroundIndex)
    }
  }

  return declarations.filter((_, index) => !drop.has(index)).map((item) => item.raw).join('; ')
}

/** 按当前主题修正富文本 inline style 里对比度不足的文字色和实色背景。 */
export const adaptRichTextContrast = (html: string, theme: ContrastTheme): string => {
  if (!html) return ''
  return html.replace(/\sstyle\s*=\s*(['"])([\s\S]*?)\1/gi, (_match, quote: string, css: string) => {
    const next = adaptDeclarationBlock(css, theme)
    if (!next) return ''
    return ` style=${quote}${next}${quote}`
  })
}
