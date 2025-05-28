"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createClient } from "@supabase/supabase-js"

interface Coordinate {
  lat: number
  lon: number
}

interface DownloadCoordinatesProps {
  coordinates: Coordinate[]
  fieldName: string
  fieldId?: string | null
  onClearCoordinates?: () => void
}

// Create a singleton Supabase client for the browser
const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

export default function DownloadCoordinates({
  coordinates,
  fieldName,
  fieldId,
  onClearCoordinates,
}: DownloadCoordinatesProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const supabase = createBrowserClient()

  const formatCoordinatesAsText = () => {
    return coordinates.map((coord, index) => `${index + 1},${coord.lat.toFixed(6)},${coord.lon.toFixed(6)}`).join("\n")
  }

  const formatCoordinatesAsCSV = () => {
    const header = "index,latitude,longitude\n"
    const rows = coordinates
      .map((coord, index) => `${index + 1},${coord.lat.toFixed(6)},${coord.lon.toFixed(6)}`)
      .join("\n")
    return header + rows
  }

  const formatCoordinatesAsGeoJSON = () => {
    const geoJSON = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            name: fieldName,
            pointCount: coordinates.length,
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [...coordinates.map((coord) => [coord.lon, coord.lat]), [coordinates[0].lon, coordinates[0].lat]],
            ],
          },
        },
      ],
    }
    return JSON.stringify(geoJSON, null, 2)
  }

  const downloadFile = (content: string, fileType: string, fileExtension: string) => {
    setIsDownloading(true)

    try {
      const blob = new Blob([content], { type: fileType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")

      // Format filename with field name and date
      const date = new Date().toISOString().split("T")[0]
      const sanitizedFieldName = fieldName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      const filename = `${sanitizedFieldName}_${date}.${fileExtension}`

      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading file:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadTxt = () => {
    downloadFile(formatCoordinatesAsText(), "text/plain", "txt")
  }

  const handleDownloadCSV = () => {
    downloadFile(formatCoordinatesAsCSV(), "text/csv", "csv")
  }

  const handleDownloadGeoJSON = () => {
    downloadFile(formatCoordinatesAsGeoJSON(), "application/json", "geojson")
  }

  const handleClearCoordinates = async () => {
    if (!fieldId) {
      // If no fieldId, just call the callback
      if (onClearCoordinates) {
        onClearCoordinates()
      }
      setShowClearConfirm(false)
      return
    }

    setIsClearing(true)
    try {
      // Delete coordinates from Supabase
      const { error } = await supabase.from("coordinates").delete().eq("field_id", fieldId)

      if (error) {
        console.error("Error deleting coordinates:", error)
        throw error
      }

      // Call the callback to update UI
      if (onClearCoordinates) {
        onClearCoordinates()
      }
    } catch (err) {
      console.error("Failed to clear coordinates:", err)
      // Still call the callback to update UI even if DB operation failed
      if (onClearCoordinates) {
        onClearCoordinates()
      }
    } finally {
      setIsClearing(false)
      setShowClearConfirm(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={coordinates.length === 0 || isDownloading}
          >
            <Download size={16} />
            Download
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownloadTxt}>Download as TXT</DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadCSV}>Download as CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadGeoJSON}>Download as GeoJSON</DropdownMenuItem>

          {onClearCoordinates && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowClearConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={16} className="mr-2" />
                Clear All Coordinates
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Coordinates</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all coordinates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearCoordinates}
              className="bg-destructive text-destructive-foreground"
              disabled={isClearing}
            >
              {isClearing ? "Clearing..." : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
