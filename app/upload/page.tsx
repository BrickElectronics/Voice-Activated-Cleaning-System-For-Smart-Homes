"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Map, BarChart3, Save, Calculator } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import dynamic from "next/dynamic"
import FileUploader from "@/components/file-uploader"
import AlgorithmVisualization from "@/components/algorithm-visualization"
import { getAreaCalculationFunction, getAlgorithmDisplayName, getAlgorithmDescription } from "@/utils/area-calculations"
import DownloadCoordinates from "@/components/download-coordinates"

// Import the map component dynamically to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-muted flex items-center justify-center">Loading map...</div>,
})

const StructuralMap = dynamic(() => import("@/components/structural-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full bg-muted flex items-center justify-center">Loading structural map...</div>
  ),
})

interface Coordinate {
  lat: number
  lon: number
}

export default function UploadPage() {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([])
  const [fieldName, setFieldName] = useState<string>("Uploaded Field")
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>("shoelace")
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileProcessed = (coords: Coordinate[], name?: string, algorithm?: string) => {
    setCoordinates(coords)
    if (name) {
      setFieldName(name)
      setNewFieldName(name)
    }
    if (algorithm) {
      setSelectedAlgorithm(algorithm)
      calculateArea(coords, algorithm)
    }
  }

  const calculateArea = (coords: Coordinate[], algorithm: string) => {
    if (coords.length < 3) {
      setError("Need at least 3 coordinates to calculate area")
      setCalculatedArea(null)
      return
    }

    try {
      const calculateAreaFn = getAreaCalculationFunction(algorithm)
      const area = calculateAreaFn(coords)
      setCalculatedArea(Number(area.toFixed(4)))
      setError(null)
    } catch (err) {
      console.error("Error calculating area:", err)
      setError("Failed to calculate area with the selected algorithm")
      setCalculatedArea(null)
    }
  }

  const saveToDatabase = async () => {
    if (!newFieldName.trim() || coordinates.length < 3) return

    setIsSaving(true)

    try {
      // Create a new field
      const response = await fetch("/api/sensor-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          createNewField: true,
          fieldName: newFieldName.trim(),
        }),
      })

      const data = await response.json()

      if (data.fieldId) {
        // Now add all coordinates to this field
        const coordsToSend = coordinates.map((coord, index) => ({
          lat: coord.lat,
          lon: coord.lon,
          field_id: data.fieldId,
          sequence_number: index + 1,
        }))

        // Send coordinates in batches to avoid request size limits
        const batchSize = 100
        for (let i = 0; i < coordsToSend.length; i += batchSize) {
          const batch = coordsToSend.slice(i, i + batchSize)

          await fetch("/api/coordinates", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              coordinates: batch,
              fieldId: data.fieldId,
            }),
          })
        }

        // If we have a calculated area, save it
        if (calculatedArea !== null) {
          await fetch("/api/sensor-data", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              area: calculatedArea,
              fieldId: data.fieldId,
            }),
          })
        }

        // Redirect to home page with the new field
        window.location.href = "/"
      }
    } catch (error) {
      console.error("Error saving field:", error)
      setError("Failed to save field to database")
    } finally {
      setIsSaving(false)
      setIsSaveDialogOpen(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FileUploader onFileProcessed={handleFileProcessed} />

        <Card>
          <CardHeader>
            <CardTitle>Field Information</CardTitle>
            <CardDescription>Analysis results using the {getAlgorithmDisplayName(selectedAlgorithm)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-medium">Field Name</p>
                <p className="text-lg">{fieldName}</p>
              </div>
              <div>
                <p className="font-medium">Points</p>
                <p className="text-lg">{coordinates.length} coordinates</p>
              </div>
              <div>
                <p className="font-medium">Algorithm</p>
                <p className="text-lg">{getAlgorithmDisplayName(selectedAlgorithm)}</p>
                <p className="text-sm text-muted-foreground">{getAlgorithmDescription(selectedAlgorithm)}</p>
              </div>
              <div>
                <p className="font-medium">Calculated Area</p>
                <p className="text-2xl font-bold">
                  {calculatedArea !== null ? `${calculatedArea.toFixed(2)} hectares` : "—"}
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {coordinates.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => calculateArea(coordinates, selectedAlgorithm)}
                    className="w-full flex items-center gap-2"
                  >
                    <Calculator size={16} />
                    Recalculate Area
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setNewFieldName(fieldName)
                        setIsSaveDialogOpen(true)
                      }}
                      className="flex-1 flex items-center gap-2"
                      variant="outline"
                    >
                      <Save size={16} />
                      Save to Database
                    </Button>

                    <DownloadCoordinates
                      coordinates={coordinates}
                      fieldName={fieldName}
                      fieldId={null} // Upload page doesn't have a fieldId since it's not saved yet
                      onClearCoordinates={() => {
                        setCoordinates([])
                        setCalculatedArea(null)
                        setError(null)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {coordinates.length > 0 && (
        <div className="mt-8">
          <Tabs defaultValue="map" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map size={16} />
                Field Map
              </TabsTrigger>
              <TabsTrigger value="structural" className="flex items-center gap-2">
                <BarChart3 size={16} />
                Structural View
              </TabsTrigger>
              <TabsTrigger value="algorithm" className="flex items-center gap-2">
                <Calculator size={16} />
                Algorithm View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="mt-0">
              <Card>
                <CardContent className="p-0 overflow-hidden rounded-md">
                  <div className="h-[500px] w-full">
                    <MapComponent
                      coordinates={coordinates.map((c) => [c.lat, c.lon] as [number, number])}
                      isLive={false}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="structural" className="mt-0">
              <Card>
                <CardContent className="p-0 overflow-hidden rounded-md">
                  <div className="h-[500px] w-full">
                    <StructuralMap
                      coordinates={coordinates.map((c) => [c.lat, c.lon] as [number, number])}
                      fieldName={fieldName}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="algorithm" className="mt-0">
              <div className="h-[500px] w-full">
                <AlgorithmVisualization coordinates={coordinates} algorithm={selectedAlgorithm} fieldName={fieldName} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Field to Database</DialogTitle>
            <DialogDescription>
              This will create a new field with the uploaded coordinates and calculated area.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fieldName" className="text-right">
                Field Name
              </Label>
              <Input
                id="fieldName"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="col-span-3"
              />
            </div>
            {calculatedArea !== null && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Area</Label>
                <div className="col-span-3">
                  {calculatedArea.toFixed(2)} hectares
                  <p className="text-xs text-muted-foreground">
                    Calculated using {getAlgorithmDisplayName(selectedAlgorithm)}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveToDatabase} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
