"use client"

import { useEffect, useRef } from "react"

interface StructuralMapProps {
  coordinates: [number, number][]
  fieldName?: string
}

export default function StructuralMap({ coordinates, fieldName = "Field" }: StructuralMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || coordinates.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions to match its display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Find min/max coordinates to scale the points to fit the canvas
    const minLat = Math.min(...coordinates.map((c) => c[0]))
    const maxLat = Math.max(...coordinates.map((c) => c[0]))
    const minLng = Math.min(...coordinates.map((c) => c[1]))
    const maxLng = Math.max(...coordinates.map((c) => c[1]))

    // Add padding
    const padding = 40

    // Function to convert GPS coordinates to canvas coordinates
    const toCanvasCoords = (lat: number, lng: number): [number, number] => {
      const x = padding + ((lng - minLng) / (maxLng - minLng || 1)) * (canvas.width - 2 * padding)
      const y = padding + ((maxLat - lat) / (maxLat - minLat || 1)) * (canvas.height - 2 * padding)
      return [x, y]
    }

    // Draw background grid
    ctx.strokeStyle = "#f3f4f6"
    ctx.lineWidth = 1

    const gridSize = 20
    for (let x = padding; x <= canvas.width - padding; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, canvas.height - padding)
      ctx.stroke()
    }

    for (let y = padding; y <= canvas.height - padding; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(canvas.width - padding, y)
      ctx.stroke()
    }

    // Draw axes
    ctx.strokeStyle = "#d1d5db"
    ctx.lineWidth = 1.5

    // X-axis
    ctx.beginPath()
    ctx.moveTo(padding, canvas.height - padding)
    ctx.lineTo(canvas.width - padding, canvas.height - padding)
    ctx.stroke()

    // Y-axis
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, canvas.height - padding)
    ctx.stroke()

    // Draw axis labels
    ctx.fillStyle = "#6b7280"
    ctx.font = "12px Arial"

    // X-axis labels
    ctx.textAlign = "center"
    const xSteps = 5
    for (let i = 0; i <= xSteps; i++) {
      const lng = minLng + (i / xSteps) * (maxLng - minLng)
      const [x, y] = toCanvasCoords(minLat, lng)
      ctx.fillText(lng.toFixed(4), x, canvas.height - padding + 20)
    }

    // Y-axis labels
    ctx.textAlign = "right"
    const ySteps = 5
    for (let i = 0; i <= ySteps; i++) {
      const lat = minLat + (i / ySteps) * (maxLat - minLat)
      const [x, y] = toCanvasCoords(lat, minLng)
      ctx.fillText(lat.toFixed(4), padding - 10, canvas.height - y)
    }

    // Draw title
    ctx.textAlign = "center"
    ctx.font = "bold 16px Arial"
    ctx.fillStyle = "#1f2937"
    ctx.fillText(`Structural Map: ${fieldName}`, canvas.width / 2, 20)

    // Draw the polygon
    if (coordinates.length >= 3) {
      ctx.beginPath()
      const [startX, startY] = toCanvasCoords(coordinates[0][0], coordinates[0][1])
      ctx.moveTo(startX, startY)

      for (let i = 1; i < coordinates.length; i++) {
        const [x, y] = toCanvasCoords(coordinates[i][0], coordinates[i][1])
        ctx.lineTo(x, y)
      }

      ctx.closePath()
      ctx.fillStyle = "rgba(59, 130, 246, 0.2)"
      ctx.fill()
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Draw points
    coordinates.forEach((coord, index) => {
      const [x, y] = toCanvasCoords(coord[0], coord[1])

      // Only draw markers for the first point, every 5th point, and the last point to reduce clutter
      if (index === 0 || index % 5 === 0 || index === coordinates.length - 1) {
        // Draw point
        ctx.beginPath()
        ctx.arc(x, y, index === coordinates.length - 1 ? 6 : 4, 0, Math.PI * 2)

        // Highlight the latest point
        if (index === coordinates.length - 1) {
          ctx.fillStyle = "#ef4444"
        } else if (index === 0) {
          ctx.fillStyle = "#10b981"
        } else {
          ctx.fillStyle = "#3b82f6"
        }

        ctx.fill()
        ctx.strokeStyle = "white"
        ctx.lineWidth = 1
        ctx.stroke()

        // Draw point label for first, last, and every 10th point
        if (index === 0 || index === coordinates.length - 1 || index % 10 === 0) {
          ctx.fillStyle = "#1f2937"
          ctx.textAlign = "center"
          ctx.font = "10px Arial"
          ctx.fillText(`${index + 1}`, x, y - 10)
        }
      }
    })

    // Draw connecting lines
    ctx.beginPath()
    const [startX, startY] = toCanvasCoords(coordinates[0][0], coordinates[0][1])
    ctx.moveTo(startX, startY)

    for (let i = 1; i < coordinates.length; i++) {
      const [x, y] = toCanvasCoords(coordinates[i][0], coordinates[i][1])
      ctx.lineTo(x, y)
    }

    // Connect back to the first point
    ctx.lineTo(startX, startY)

    ctx.strokeStyle = "#10b981"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Add timestamp
    ctx.textAlign = "right"
    ctx.font = "12px Arial"
    ctx.fillStyle = "#6b7280"
    ctx.fillText(`Updated: ${new Date().toLocaleTimeString()}`, canvas.width - padding, canvas.height - 10)
  }, [coordinates, fieldName])

  return <canvas ref={canvasRef} className="h-full w-full bg-white" />
}
