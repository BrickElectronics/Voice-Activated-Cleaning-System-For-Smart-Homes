"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@supabase/supabase-js"
import dynamic from "next/dynamic"

// Create a singleton Supabase client for the browser
const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

// Import the map component dynamically to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-muted flex items-center justify-center">Loading map...</div>,
})

interface Field {
  id: string
  name: string
  esp32_area: number | null
  web_area: number | null
}

interface Coordinate {
  lat: number
  lon: number
}

export default function AlgorithmsPage() {
  const [fields, setFields] = useState<Field[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [coordinates, setCoordinates] = useState<Coordinate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [areaResults, setAreaResults] = useState<{
    shoelace: number | null
    haversine: number | null
    esp32: number | null
    web: number | null
  }>({
    shoelace: null,
    haversine: null,
    esp32: null,
    web: null,
  })
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchFields()
  }, [])

  useEffect(() => {
    if (selectedFieldId) {
      fetchCoordinates(selectedFieldId)
    }
  }, [selectedFieldId])

  const fetchFields = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("fields")
        .select("id, name, esp32_area, web_area")
        .order("updated_at", { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        setFields(data)
        setSelectedFieldId(data[0].id)
      }
    } catch (err) {
      console.error("Error fetching fields:", err)
      setError("Failed to fetch fields")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCoordinates = async (fieldId: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("coordinates")
        .select("lat, lon")
        .eq("field_id", fieldId)
        .order("sequence_number", { ascending: true })

      if (error) throw error

      if (data) {
        setCoordinates(data)

        // Get the field data for ESP32 and web areas
        const field = fields.find((f) => f.id === fieldId)

        // Calculate areas using different algorithms
        calculateAreas(data, field)
      }
    } catch (err) {
      console.error("Error fetching coordinates:", err)
      setError("Failed to fetch coordinates")
    } finally {
      setIsLoading(false)
    }
  }

  const calculateAreas = (coords: Coordinate[], field: Field | undefined) => {
    if (coords.length < 3) {
      setError("Need at least 3 coordinates to calculate area")
      return
    }

    // Shoelace formula (Gauss's area formula)
    let shoelaceArea = 0
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length
      shoelaceArea += coords[i].lat * coords[j].lon
      shoelaceArea -= coords[j].lat * coords[i].lon
    }
    shoelaceArea = Math.abs(shoelaceArea) / 2

    // Convert to square kilometers (approximate conversion)
    const shoelaceAreaInSqKm = shoelaceArea * 111.32 * 111.32

    // Convert to hectares
    const shoelaceAreaInHectares = shoelaceAreaInSqKm * 100

    // Haversine-based area calculation
    const haversineAreaInHectares = calculateHaversineArea(coords)

    setAreaResults({
      shoelace: Number(shoelaceAreaInHectares.toFixed(4)),
      haversine: Number(haversineAreaInHectares.toFixed(4)),
      esp32: field?.esp32_area || null,
      web: field?.web_area || null,
    })
  }

  // Haversine formula to calculate distance between two points on Earth
  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in km
  }

  // Calculate area using Haversine distances
  const calculateHaversineArea = (coords: Coordinate[]) => {
    if (coords.length < 3) return 0

    let area = 0
    const centroid = {
      lat: coords.reduce((sum, coord) => sum + coord.lat, 0) / coords.length,
      lon: coords.reduce((sum, coord) => sum + coord.lon, 0) / coords.length,
    }

    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length

      // Calculate the three sides of the triangle
      const a = haversineDistance(centroid.lat, centroid.lon, coords[i].lat, coords[i].lon)
      const b = haversineDistance(centroid.lat, centroid.lon, coords[j].lat, coords[j].lon)
      const c = haversineDistance(coords[i].lat, coords[i].lon, coords[j].lat, coords[j].lon)

      // Heron's formula for triangle area
      const s = (a + b + c) / 2
      const triangleArea = Math.sqrt(s * (s - a) * (s - b) * (s - c))

      area += triangleArea
    }

    // Convert to hectares (1 sq km = 100 hectares)
    return area * 100
  }

  // Get accuracy comparison
  const getAccuracyComparison = () => {
    if (!areaResults.esp32 || !areaResults.web || !areaResults.shoelace || !areaResults.haversine) {
      return null
    }

    // Use ESP32 area as reference
    const reference = areaResults.esp32

    return {
      web: {
        value: areaResults.web,
        diff: ((areaResults.web - reference) / reference) * 100,
      },
      shoelace: {
        value: areaResults.shoelace,
        diff: ((areaResults.shoelace - reference) / reference) * 100,
      },
      haversine: {
        value: areaResults.haversine,
        diff: ((areaResults.haversine - reference) / reference) * 100,
      },
    }
  }

  const accuracyComparison = getAccuracyComparison()

  return (
    <main className="container mx-auto py-8 px-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Area Calculation Algorithms</CardTitle>
          <CardDescription>
            Compare different algorithms for calculating field area from GPS coordinates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Select Field</label>
              <Select
                value={selectedFieldId || undefined}
                onValueChange={(value) => setSelectedFieldId(value)}
                disabled={isLoading || fields.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Algorithm Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Shoelace Formula</p>
                        <p className="text-xl font-bold">
                          {areaResults.shoelace !== null ? `${areaResults.shoelace.toFixed(2)} ha` : "—"}
                        </p>
                        {accuracyComparison && (
                          <p
                            className={`text-xs ${accuracyComparison.shoelace.diff > 0 ? "text-green-500" : "text-red-500"}`}
                          >
                            {accuracyComparison.shoelace.diff > 0 ? "+" : ""}
                            {accuracyComparison.shoelace.diff.toFixed(2)}% vs ESP32
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Haversine Method</p>
                        <p className="text-xl font-bold">
                          {areaResults.haversine !== null ? `${areaResults.haversine.toFixed(2)} ha` : "—"}
                        </p>
                        {accuracyComparison && (
                          <p
                            className={`text-xs ${accuracyComparison.haversine.diff > 0 ? "text-green-500" : "text-red-500"}`}
                          >
                            {accuracyComparison.haversine.diff > 0 ? "+" : ""}
                            {accuracyComparison.haversine.diff.toFixed(2)}% vs ESP32
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm font-medium">ESP32 Calculation</p>
                        <p className="text-xl font-bold">
                          {areaResults.esp32 !== null ? `${areaResults.esp32.toFixed(2)} ha` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">Reference value</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Web Calculation</p>
                        <p className="text-xl font-bold">
                          {areaResults.web !== null ? `${areaResults.web.toFixed(2)} ha` : "—"}
                        </p>
                        {accuracyComparison && (
                          <p
                            className={`text-xs ${accuracyComparison.web.diff > 0 ? "text-green-500" : "text-red-500"}`}
                          >
                            {accuracyComparison.web.diff > 0 ? "+" : ""}
                            {accuracyComparison.web.diff.toFixed(2)}% vs ESP32
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Algorithm Descriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="font-medium">Shoelace Formula (Gauss's Area)</p>
                      <p className="text-muted-foreground">
                        A mathematical algorithm that determines the area of a polygon by taking the coordinates of each
                        vertex. It works by summing the products of coordinates and dividing by 2.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Haversine Method</p>
                      <p className="text-muted-foreground">
                        Uses the Haversine formula to calculate great-circle distances between points on a sphere. This
                        method accounts for Earth's curvature and is more accurate for larger areas.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">ESP32 Calculation</p>
                      <p className="text-muted-foreground">
                        Area calculated by the ESP32 microcontroller in the field, using a simplified algorithm
                        optimized for embedded systems with limited resources.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="map" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="map">Field Visualization</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-0">
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-md">
              <div className="h-[400px] w-full">
                {coordinates.length > 0 ? (
                  <MapComponent
                    coordinates={coordinates.map((c) => [c.lat, c.lon] as [number, number])}
                    isLive={false}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-muted">
                    <p className="text-muted-foreground">Select a field to view the map</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy" className="mt-0">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium">Accuracy Comparison</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This chart compares the accuracy of different area calculation methods relative to the ESP32
                    calculation.
                  </p>

                  {accuracyComparison ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Shoelace Formula</span>
                          <span>{accuracyComparison.shoelace.diff.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${accuracyComparison.shoelace.diff > 0 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(Math.abs(accuracyComparison.shoelace.diff), 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Haversine Method</span>
                          <span>{accuracyComparison.haversine.diff.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${accuracyComparison.haversine.diff > 0 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(Math.abs(accuracyComparison.haversine.diff), 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Web Calculation</span>
                          <span>{accuracyComparison.web.diff.toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${accuracyComparison.web.diff > 0 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(Math.abs(accuracyComparison.web.diff), 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 bg-muted rounded-md">
                      <p className="text-muted-foreground">Select a field with calculated areas to view comparison</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium">Factors Affecting Accuracy</h3>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                    <li>GPS signal quality and precision</li>
                    <li>Number of coordinate points collected</li>
                    <li>Field shape complexity</li>
                    <li>Earth's curvature (more significant for larger fields)</li>
                    <li>Computational precision of the device</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
