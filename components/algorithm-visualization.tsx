"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateConvexHull } from "@/utils/area-calculations"

interface AlgorithmVisualizationProps {
  coordinates: Array<{ lat: number; lon: number }>
  algorithm: string
  fieldName: string
}

export default function AlgorithmVisualization({ coordinates, algorithm, fieldName }: AlgorithmVisualizationProps) {
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
    const minLat = Math.min(...coordinates.map((c) => c.lat))
    const maxLat = Math.max(...coordinates.map((c) => c.lat))
    const minLng = Math.min(...coordinates.map((c) => c.lon))
    const maxLng = Math.max(...coordinates.map((c) => c.lon))

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
    ctx.fillText(`${fieldName} - ${getAlgorithmTitle(algorithm)}`, canvas.width / 2, 20)

    // Draw all points
    coordinates.forEach((coord, index) => {
      const [x, y] = toCanvasCoords(coord.lat, coord.lon)

      // Draw point
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = "#6b7280"
      ctx.fill()
    })

    // Draw algorithm-specific visualization
    if (algorithm === "shoelace" || algorithm === "haversine") {
      // Draw the polygon
      if (coordinates.length >= 3) {
        ctx.beginPath()
        const [startX, startY] = toCanvasCoords(coordinates[0].lat, coordinates[0].lon)
        ctx.moveTo(startX, startY)

        for (let i = 1; i < coordinates.length; i++) {
          const [x, y] = toCanvasCoords(coordinates[i].lat, coordinates[i].lon)
          ctx.lineTo(x, y)
        }

        ctx.closePath()
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)"
        ctx.fill()
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.stroke()
      }
    } else if (algorithm === "convexHull") {
      // Calculate convex hull
      const hull = calculateConvexHull(coordinates)

      // Draw the convex hull
      if (hull.length >= 3) {
        ctx.beginPath()
        const [startX, startY] = toCanvasCoords(hull[0].lat, hull[0].lon)
        ctx.moveTo(startX, startY)

        for (let i = 1; i < hull.length; i++) {
          const [x, y] = toCanvasCoords(hull[i].lat, hull[i].lon)
          ctx.lineTo(x, y)
        }

        ctx.closePath()
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)"
        ctx.fill()
        ctx.strokeStyle = "#f59e0b"
        ctx.lineWidth = 2
        ctx.stroke()

        // Highlight hull points
        hull.forEach((coord) => {
          const [x, y] = toCanvasCoords(coord.lat, coord.lon)
          ctx.beginPath()
          ctx.arc(x, y, 5, 0, Math.PI * 2)
          ctx.fillStyle = "#f59e0b"
          ctx.fill()
          ctx.strokeStyle = "white"
          ctx.lineWidth = 1
          ctx.stroke()
        })
      }
    } else if (algorithm === "delaunay") {
      // For demonstration, we'll draw triangles from a central point
      // In a real implementation, you'd use a proper Delaunay triangulation

      // Calculate centroid
      const centroid = {
        lat: coordinates.reduce((sum, coord) => sum + coord.lat, 0) / coordinates.length,
        lon: coordinates.reduce((sum, coord) => sum + coord.lon, 0) / coordinates.length,
      }

      const [centroidX, centroidY] = toCanvasCoords(centroid.lat, centroid.lon)

      // Draw centroid
      ctx.beginPath()
      ctx.arc(centroidX, centroidY, 5, 0, Math.PI * 2)
      ctx.fillStyle = "#ec4899"
      ctx.fill()
      ctx.strokeStyle = "white"
      ctx.lineWidth = 1
      ctx.stroke()

      // Draw triangles from centroid to each pair of adjacent points
      for (let i = 0; i < coordinates.length; i++) {
        const j = (i + 1) % coordinates.length

        const [x1, y1] = toCanvasCoords(coordinates[i].lat, coordinates[i].lon)
        const [x2, y2] = toCanvasCoords(coordinates[j].lat, coordinates[j].lon)

        ctx.beginPath()
        ctx.moveTo(centroidX, centroidY)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.closePath()

        ctx.fillStyle = `rgba(236, 72, 153, ${0.1 + (i % 3) * 0.1})`
        ctx.fill()
        ctx.strokeStyle = "#ec4899"
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // Add timestamp
    ctx.textAlign = "right"
    ctx.font = "12px Arial"
    ctx.fillStyle = "#6b7280"
    ctx.fillText(`Generated: ${new Date().toLocaleTimeString()}`, canvas.width - padding, canvas.height - 10)
  }, [coordinates, algorithm, fieldName])

  function getAlgorithmTitle(algo: string): string {
    switch (algo) {
      case "haversine":
        return "Haversine Method"
      case "convexHull":
        return "Convex Hull"
      case "delaunay":
        return "Delaunay Triangulation"
      case "shoelace":
      default:
        return "Shoelace Formula"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Algorithm Visualization</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-md">
        <canvas ref={canvasRef} className="h-[400px] w-full bg-white" />
      </CardContent>
    </Card>
  )
}
