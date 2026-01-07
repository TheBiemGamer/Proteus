import { useEffect, useRef } from 'react'

const parseColor = (color: string): number[] => {
  if (!color) return [0, 0, 0]
  // Handle empty or whitespace strings
  if (!color.trim()) return [0, 0, 0]

  return color.split(',').map((c) => {
    const parsed = parseInt(c.trim(), 10)
    return isNaN(parsed) ? 0 : parsed
  })
}

const stringifyColor = (rgb: number[]): string => rgb.map(Math.round).join(', ')

// Cubic Ease-Out
const easeOutCubic = (x: number): number => {
  return 1 - Math.pow(1 - x, 3)
}

const lerp = (start: number, end: number, t: number) => start + (end - start) * t

export function useSmoothTheme(
  targetAccent: string,
  targetBgStart: string,
  targetBgEnd: string,
  duration: number = 800
) {
  const requestRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | undefined>(undefined)
  const startValuesRef = useRef<{
    accent: number[]
    bgStart: number[]
    bgEnd: number[]
  } | null>(null)

  useEffect(() => {
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)

    // Get current values from computed style to ensure we pick up CSS defaults or current animation state
    const getVar = (name: string) => {
      // Try inline style first (most accurate for ongoing animation)
      const inline = root.style.getPropertyValue(name)
      if (inline) return inline
      // Fallback to computed (CSS defaults)
      return computedStyle.getPropertyValue(name)
    }

    const startAccent = parseColor(getVar('--theme-accent'))
    const startBgStart = parseColor(getVar('--theme-bg-start'))
    const startBgEnd = parseColor(getVar('--theme-bg-end'))

    const endAccent = parseColor(targetAccent)
    const endBgStart = parseColor(targetBgStart)
    const endBgEnd = parseColor(targetBgEnd)

    // Store start values
    startValuesRef.current = {
      accent: startAccent,
      bgStart: startBgStart,
      bgEnd: startBgEnd
    }

    startTimeRef.current = undefined

    const animate = (time: number) => {
      if (startTimeRef.current === undefined) startTimeRef.current = time
      const elapsed = time - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1) // Clamp to 0-1
      const t = easeOutCubic(progress)

      if (startValuesRef.current) {
        const currentAccent = startValuesRef.current.accent.map((s, i) => lerp(s, endAccent[i], t))
        const currentBgStart = startValuesRef.current.bgStart.map((s, i) =>
          lerp(s, endBgStart[i], t)
        )
        const currentBgEnd = startValuesRef.current.bgEnd.map((s, i) => lerp(s, endBgEnd[i], t))

        root.style.setProperty('--theme-accent', stringifyColor(currentAccent))
        root.style.setProperty('--theme-bg-start', stringifyColor(currentBgStart))
        root.style.setProperty('--theme-bg-end', stringifyColor(currentBgEnd))
      }

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate)
      }
    }

    // Cancel previous animation
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
    }

    requestRef.current = requestAnimationFrame(animate)

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [targetAccent, targetBgStart, targetBgEnd, duration])
}
