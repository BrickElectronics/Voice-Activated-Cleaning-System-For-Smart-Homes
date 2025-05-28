"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface MapComponentProps {
  coordinates: [number, number][]
  isLive?: boolean
  tractorInfo?: {
    speed: number
    heading: number
    status: string
  }
}

export default function MapComponent({ coordinates, isLive = false, tractorInfo }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.Marker[]>([])
  const polylineRef = useRef<L.Polyline | null>(null)
  const polygonRef = useRef<L.Polygon | null>(null)
  const tractorMarkerRef = useRef<L.Marker | null>(null)
  const [lastCoordinate, setLastCoordinate] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Initialize map if it doesn't exist
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([0, 0], 2)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current)
    }

    const map = mapRef.current

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      map.removeLayer(marker)
    })
    markersRef.current = []

    // Remove existing polyline and polygon
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current)
      polylineRef.current = null
    }

    if (polygonRef.current) {
      map.removeLayer(polygonRef.current)
      polygonRef.current = null
    }

    if (coordinates.length === 0) return

    // Create a polygon from the coordinates if there are at least 3
    if (coordinates.length >= 3) {
      polygonRef.current = L.polygon(coordinates, {
        color: "#3b82f6", // Blue
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map)
    }

    // Create a polyline to connect all points
    polylineRef.current = L.polyline(coordinates, {
      color: "#10b981", // Green
      weight: 3,
      opacity: 0.8,
    }).addTo(map)

    // Create markers for each coordinate
    coordinates.forEach((coord, index) => {
      const isLatest = index === coordinates.length - 1

      // Only add markers for the first point and every 5th point to reduce clutter
      if (index === 0 || index % 5 === 0 || isLatest) {
        const marker = L.marker(coord, {
          icon: L.divIcon({
            className: "custom-div-icon",
            html: `<div style="background-color: ${isLatest ? "#ef4444" : "#3b82f6"}; width: ${isLatest ? "14px" : "10px"}; height: ${isLatest ? "14px" : "10px"}; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [isLatest ? 18 : 14, isLatest ? 18 : 14],
            iconAnchor: [isLatest ? 9 : 7, isLatest ? 9 : 7],
          }),
        })
          .addTo(map)
          .bindPopup(`Point ${index + 1}: ${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}`)

        markersRef.current.push(marker)
      }

      // If this is the latest coordinate and it's different from the last one we tracked
      if (isLatest && (!lastCoordinate || lastCoordinate[0] !== coord[0] || lastCoordinate[1] !== coord[1])) {
        setLastCoordinate(coord)

        // If live tracking is enabled, center on the latest point
        if (isLive) {
          map.setView(coord, map.getZoom() || 15)
        }

        // Update tractor marker position
        if (tractorInfo && tractorMarkerRef.current) {
          tractorMarkerRef.current.setLatLng(coord)
        } else if (tractorInfo) {
          // Create tractor marker if it doesn't exist
          const tractorIcon = L.divIcon({
            className: "tractor-icon",
            html: `
              <div style="
                width: 30px; 
                height: 30px; 
                background-color: ${tractorInfo.status === "moving" ? "#ef4444" : "#6b7280"}; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                transform: rotate(${tractorInfo.heading}deg);
                border: 3px solid white;
                box-shadow: 0 0 10px rgba(0,0,0,0.3);
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9v.01M7 5v.01M11 5v.01M15 5v.01M19 5v.01M3 13v.01M7 13v.01M11 13v.01M15 13v.01M19 13v.01M3 17v.01M7 17v.01M11 17v.01M15 17v.01M19 17v.01"/>
                </svg>
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          })

          tractorMarkerRef.current = L.marker(coord, { icon: tractorIcon })
            .addTo(map)
            .bindPopup(`
              <b>Tractor Status</b><br>
              Speed: ${tractorInfo.speed.toFixed(1)} km/h<br>
              Heading: ${tractorInfo.heading.toFixed(0)}°<br>
              Status: ${tractorInfo.status}
            `)
        }
      }
    })

    // Fit the map to the bounds of all coordinates if not in live mode
    // or if this is the first time we're showing coordinates
    if (!isLive || coordinates.length <= 1) {
      const bounds = L.latLngBounds(coordinates)
      map.fitBounds(bounds, { padding: [50, 50] })
    }

    return () => {
      // Cleanup will happen on next render
    }
  }, [coordinates, isLive, lastCoordinate, tractorInfo])

  return <div ref={mapContainerRef} className="h-full w-full" />
}
