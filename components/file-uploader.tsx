"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, FileJson, FileSpreadsheet, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface FileUploaderProps {
  onFileProcessed: (coordinates: Array<{ lat: number; lon: number }>, fieldName?: string, algorithm?: string) => void
  supportedFormats?: string[]
}

export default function FileUploader({
  onFileProcessed,
  supportedFormats = [".txt", ".csv", ".geojson"],
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("shoelace")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase()
    if (!fileExtension || !supportedFormats.some((format) => format.includes(fileExtension))) {
      setError(`Unsupported file format. Please upload ${supportedFormats.join(", ")} files.`)
      setFile(null)
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  const processFile = async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(10)
    setError(null)

    try {
      const fileExtension = file.name.split(".").pop()?.toLowerCase()
      const text = await file.text()
      setProgress(50)

      let coordinates: Array<{ lat: number; lon: number }> = []
      let fieldName: string | undefined = file.name.split(".")[0]

      if (fileExtension === "txt") {
        coordinates = parseTxtFile(text)
      } else if (fileExtension === "csv") {
        coordinates = parseCsvFile(text)
      } else if (fileExtension === "geojson") {
        const result = parseGeoJsonFile(text)
        coordinates = result.coordinates
        fieldName = result.fieldName || fieldName
      }

      setProgress(90)

      if (coordinates.length < 3) {
        setError("Not enough valid coordinates found in the file. Need at least 3 points.")
        return
      }

      onFileProcessed(coordinates, fieldName, selectedAlgorithm)
      setProgress(100)
    } catch (err) {
      console.error("Error processing file:", err)
      setError("Failed to process the file. Please check the file format.")
    } finally {
      setIsProcessing(false)
    }
  }

  const parseTxtFile = (text: string): Array<{ lat: number; lon: number }> => {
    const lines = text.trim().split("\n")
    return lines
      .map((line) => {
        const parts = line.split(",")
        if (parts.length >= 3) {
          // Format: index,lat,lon
          const lat = Number.parseFloat(parts[1])
          const lon = Number.parseFloat(parts[2])
          if (!isNaN(lat) && !isNaN(lon)) {
            return { lat, lon }
          }
        }
        return { lat: 0, lon: 0 } // Invalid line
      })
      .filter((coord) => coord.lat !== 0 || coord.lon !== 0)
  }

  const parseCsvFile = (text: string): Array<{ lat: number; lon: number }> => {
    const lines = text.trim().split("\n")
    // Skip header if it exists
    const startIndex = lines[0].toLowerCase().includes("latitude") || lines[0].toLowerCase().includes("lat") ? 1 : 0

    return lines
      .slice(startIndex)
      .map((line) => {
        const parts = line.split(",")
        if (parts.length >= 3) {
          // Format: index,lat,lon
          const lat = Number.parseFloat(parts[1])
          const lon = Number.parseFloat(parts[2])
          if (!isNaN(lat) && !isNaN(lon)) {
            return { lat, lon }
          }
        }
        return { lat: 0, lon: 0 } // Invalid line
      })
      .filter((coord) => coord.lat !== 0 || coord.lon !== 0)
  }

  const parseGeoJsonFile = (text: string): { coordinates: Array<{ lat: number; lon: number }>; fieldName?: string } => {
    try {
      const geojson = JSON.parse(text)
      let fieldName: string | undefined

      if (geojson.features && geojson.features.length > 0) {
        const feature = geojson.features[0]

        // Extract field name if available
        if (feature.properties && feature.properties.name) {
          fieldName = feature.properties.name
        }

        // Extract coordinates
        if (
          feature.geometry &&
          feature.geometry.type === "Polygon" &&
          feature.geometry.coordinates &&
          feature.geometry.coordinates.length > 0
        ) {
          // GeoJSON uses [longitude, latitude] format
          return {
            coordinates: feature.geometry.coordinates[0]
              .map((coord: number[]) => ({
                lat: coord[1],
                lon: coord[0],
              }))
              .filter((_: any, i: number, arr: any[]) => i < arr.length - 1), // Remove last point (duplicate of first)
            fieldName,
          }
        }
      }

      throw new Error("Invalid GeoJSON structure")
    } catch (err) {
      console.error("Error parsing GeoJSON:", err)
      throw new Error("Failed to parse GeoJSON file")
    }
  }

  const getFileIcon = () => {
    if (!file) return <Upload size={48} className="text-muted-foreground" />

    const extension = file.name.split(".").pop()?.toLowerCase()
    switch (extension) {
      case "txt":
        return <FileText size={48} className="text-blue-500" />
      case "csv":
        return <FileSpreadsheet size={48} className="text-green-500" />
      case "geojson":
        return <FileJson size={48} className="text-amber-500" />
      default:
        return <FileText size={48} className="text-muted-foreground" />
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload GPS Data</CardTitle>
        <CardDescription>Upload your GPS coordinates and select an algorithm to analyze the data.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors mb-6"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={supportedFormats.join(",")}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-4">
            {getFileIcon()}
            <div>
              {file ? (
                <p className="font-medium">{file.name}</p>
              ) : (
                <>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground mt-1">Supported formats: {supportedFormats.join(", ")}</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Select Processing Algorithm</h3>
            <RadioGroup
              value={selectedAlgorithm}
              onValueChange={setSelectedAlgorithm}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="shoelace" id="shoelace" />
                <Label htmlFor="shoelace" className="cursor-pointer flex-1">
                  <div className="font-medium">Shoelace Formula</div>
                  <div className="text-xs text-muted-foreground">Standard algorithm for polygon area calculation</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="haversine" id="haversine" />
                <Label htmlFor="haversine" className="cursor-pointer flex-1">
                  <div className="font-medium">Haversine Method</div>
                  <div className="text-xs text-muted-foreground">
                    Accounts for Earth's curvature, better for large areas
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="convexHull" id="convexHull" />
                <Label htmlFor="convexHull" className="cursor-pointer flex-1">
                  <div className="font-medium">Convex Hull</div>
                  <div className="text-xs text-muted-foreground">
                    Creates the smallest convex polygon containing all points
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="delaunay" id="delaunay" />
                <Label htmlFor="delaunay" className="cursor-pointer flex-1">
                  <div className="font-medium">Delaunay Triangulation</div>
                  <div className="text-xs text-muted-foreground">
                    Divides area into triangles for more precise calculation
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isProcessing && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">Processing file...</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={processFile} disabled={!file || isProcessing} className="w-full">
          {isProcessing ? "Processing..." : "Process File"}
        </Button>
      </CardFooter>
    </Card>
  )
}
