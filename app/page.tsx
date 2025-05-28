"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Map, BarChart3, RefreshCw, Calculator, Tractor, Edit, Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import dynamic from "next/dynamic"
import { Badge } from "@/components/ui/badge"
import DownloadCoordinates from "@/components/download-coordinates"
import FieldSelector from "@/components/field-selector"

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

const TractorDashboard = dynamic(() => import("@/components/tractor-dashboard"), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full bg-muted flex items-center justify-center">Loading dashboard...</div>,
})

interface Coordinate {
  lat: number
  lon: number
}

interface TractorInfo {
  speed: number
  heading: number
  status: string
}

export default function Home() {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([])
  const [filteredCoordinates, setFilteredCoordinates] = useState<Coordinate[]>([])
  const [esp32Area, setEsp32Area] = useState<number | null>(null)
  const [webArea, setWebArea] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [fieldName, setFieldName] = useState("Unnamed Field")
  const [newFieldName, setNewFieldName] = useState("")
  const [tractorInfo, setTractorInfo] = useState<TractorInfo>({
    speed: 0,
    heading: 0,
    status: "idle",
  })
  const [areaUnit, setAreaUnit] = useState<"hectares" | "acres">("hectares")
  const [isFieldNameDialogOpen, setIsFieldNameDialogOpen] = useState(false)
  const [isNewFieldDialogOpen, setIsNewFieldDialogOpen] = useState(false)
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [pricePerUnit, setPricePerUnit] = useState<string>("")
  const [areaAmount, setAreaAmount] = useState<string>("")

  // Calculate total price
  const totalPrice = useMemo(() => {
    const price = Number.parseFloat(pricePerUnit) || 0
    const area = Number.parseFloat(areaAmount) || 0
    return price * area
  }, [pricePerUnit, areaAmount])

  // Function to fetch data from the API
  const fetchData = async () => {
    try {
      const response = await fetch("/api/sensor-data")
      const data = await response.json()

      if (data.coordinates) {
        setCoordinates(data.coordinates)

        // Filter out coordinates that are (0,0) or very close to it
        const filtered = data.coordinates.filter(
          (coord: Coordinate) => !(Math.abs(coord.lat) < 0.0001 && Math.abs(coord.lon) < 0.0001),
        )
        setFilteredCoordinates(filtered)
      }

      if (data.esp32Area !== null && data.esp32Area !== undefined) {
        setEsp32Area(data.esp32Area)
      }

      if (data.webArea !== null && data.webArea !== undefined) {
        setWebArea(data.webArea)
      }

      if (data.fieldName) {
        setFieldName(data.fieldName)
        setNewFieldName(data.fieldName)
      }

      if (data.tractorInfo) {
        setTractorInfo(data.tractorInfo)
      }

      if (data.fieldId) {
        setCurrentFieldId(data.fieldId)
      }

      setLastUpdate(new Date())
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("Failed to fetch data from the server")
    }
  }

  // Calculate area on the client side
  const calculateArea = async () => {
    if (filteredCoordinates.length < 3) {
      setError("Need at least 3 valid coordinates to calculate area")
      return
    }

    setIsCalculating(true)

    try {
      // Convert coordinates to the format expected by our area calculation function
      const formattedCoords = filteredCoordinates.map((coord) => [coord.lat, coord.lon] as [number, number])

      // Calculate area using the Shoelace formula (Gauss's area formula)
      let calculatedArea = 0
      for (let i = 0; i < formattedCoords.length; i++) {
        const j = (i + 1) % formattedCoords.length
        calculatedArea += formattedCoords[i][0] * formattedCoords[j][1]
        calculatedArea -= formattedCoords[j][0] * formattedCoords[i][1]
      }

      // Take the absolute value and divide by 2
      calculatedArea = Math.abs(calculatedArea) / 2

      // Convert to square kilometers (approximate conversion)
      const areaInSquareKm = calculatedArea * 111.32 * 111.32

      // Convert to hectares or acres based on user preference
      let finalArea = areaInSquareKm * 100 // Convert to hectares (1 sq km = 100 hectares)
      if (areaUnit === "acres") {
        finalArea = finalArea * 2.47105 // Convert hectares to acres
      }

      const roundedArea = Number.parseFloat(finalArea.toFixed(4))
      setWebArea(roundedArea)

      // Update the server with the calculated area
      await fetch("/api/sensor-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ area: roundedArea }),
      })
    } catch (err) {
      console.error("Error calculating area:", err)
      setError("Failed to calculate area")
    } finally {
      setIsCalculating(false)
    }
  }

  // Toggle live updates
  const toggleLiveUpdates = () => {
    setIsLive(!isLive)
  }

  // Update field name
  const updateFieldName = async () => {
    if (!newFieldName.trim()) {
      setError("Field name cannot be empty")
      return
    }

    try {
      await fetch("/api/sensor-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fieldName: newFieldName.trim() }),
      })

      setFieldName(newFieldName.trim())
      setIsFieldNameDialogOpen(false)
    } catch (err) {
      console.error("Error updating field name:", err)
      setError("Failed to update field name")
    }
  }

  // Create new field
  const createNewField = async () => {
    if (!newFieldName.trim()) {
      setError("Field name cannot be empty")
      return
    }

    try {
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
        setCurrentFieldId(data.fieldId)
        setFieldName(data.fieldName || newFieldName.trim())
        setCoordinates([])
        setFilteredCoordinates([])
        setEsp32Area(null)
        setWebArea(null)
      }

      setIsNewFieldDialogOpen(false)
      setNewFieldName("")
    } catch (err) {
      console.error("Error creating new field:", err)
      setError("Failed to create new field")
    }
  }

  // Handle field change from selector
  const handleFieldChange = async (fieldId: string, name: string) => {
    setCurrentFieldId(fieldId)
    setFieldName(name)
    await fetchData()
  }

  // Toggle area unit
  const toggleAreaUnit = () => {
    const newUnit = areaUnit === "hectares" ? "acres" : "hectares"
    setAreaUnit(newUnit)

    // Recalculate displayed areas if they exist
    if (webArea !== null) {
      const conversionFactor = newUnit === "acres" ? 2.47105 : 1 / 2.47105
      setWebArea(Number.parseFloat((webArea * conversionFactor).toFixed(4)))
    }

    if (esp32Area !== null) {
      const conversionFactor = newUnit === "acres" ? 2.47105 : 1 / 2.47105
      setEsp32Area(Number.parseFloat((esp32Area * conversionFactor).toFixed(4)))
    }
  }

  // Fetch data on initial load and set up polling if live updates are enabled
  useEffect(() => {
    fetchData()

    if (isLive) {
      intervalRef.current = setInterval(fetchData, 1500) // Poll every 1.5 seconds
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isLive])

  return (
    <main className="container mx-auto py-6 px-4">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Tractor className="h-8 w-8 text-primary" />
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">{fieldName}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFieldNameDialogOpen(true)}
                    className="h-6 w-6"
                  >
                    <Edit size={14} />
                  </Button>
                </div>
                <CardDescription>Tractor GPS Area Calculator</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FieldSelector
                onFieldChange={handleFieldChange}
                onNewField={() => {
                  setNewFieldName("")
                  setIsNewFieldDialogOpen(true)
                }}
                currentFieldId={currentFieldId}
              />

              <Badge variant={isLive ? "default" : "outline"} className={isLive ? "animate-pulse" : ""}>
                {isLive ? "Live Tracking" : "Paused"}
              </Badge>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleLiveUpdates}
                title={isLive ? "Pause live updates" : "Enable live updates"}
              >
                <RefreshCw size={16} className={isLive ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium">Field Coverage</p>
                  <p className="text-xs text-muted-foreground">{filteredCoordinates.length} valid GPS points</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={calculateArea}
                    disabled={filteredCoordinates.length < 3 || isCalculating}
                    className="flex items-center gap-2"
                  >
                    <Calculator size={16} />
                    Calculate Area
                  </Button>

                  <DownloadCoordinates
                    coordinates={filteredCoordinates}
                    fieldName={fieldName}
                    fieldId={currentFieldId}
                    onClearCoordinates={() => {
                      if (filteredCoordinates.length > 0) {
                        setCoordinates([])
                        setFilteredCoordinates([])
                        setWebArea(null)
                      }
                    }}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">ESP32 Calculation</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-2xl font-bold">
                      {esp32Area !== null ? esp32Area.toFixed(2) : "—"}
                      <span className="text-sm font-normal ml-1">{areaUnit}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Web Calculation</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-2xl font-bold">
                      {webArea !== null ? webArea.toFixed(2) : "—"}
                      <span className="text-sm font-normal ml-1">{areaUnit}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={toggleAreaUnit}>
                    Switch to {areaUnit === "hectares" ? "acres" : "hectares"}
                  </Button>
                </div>

                {/* Price Calculator Section */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Price Calculator</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="pricePerUnit" className="text-sm font-medium">
                          Price per {areaUnit === "hectares" ? "hectare" : "acre"}
                        </Label>
                        <Input
                          id="pricePerUnit"
                          type="number"
                          placeholder="0.00"
                          value={pricePerUnit}
                          onChange={(e) => setPricePerUnit(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="areaAmount" className="text-sm font-medium">
                          Area ({areaUnit})
                        </Label>
                        <Input
                          id="areaAmount"
                          type="number"
                          placeholder="0.00"
                          value={areaAmount}
                          onChange={(e) => setAreaAmount(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (webArea !== null) {
                              setAreaAmount(webArea.toString())
                            }
                          }}
                          disabled={webArea === null}
                        >
                          Use Web Area
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (esp32Area !== null) {
                              setAreaAmount(esp32Area.toString())
                            }
                          }}
                          disabled={esp32Area === null}
                        >
                          Use ESP32 Area
                        </Button>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Price</p>
                        <p className="text-xl font-bold">₹{totalPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <TractorDashboard tractorInfo={tractorInfo} />
          </div>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground">
          {lastUpdate && (
            <div className="flex justify-between w-full">
              <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
              <span>
                {tractorInfo.status === "moving"
                  ? "Tractor in motion"
                  : tractorInfo.status === "idle"
                    ? "Tractor idle"
                    : "Status unknown"}
              </span>
            </div>
          )}
        </CardFooter>
      </Card>

      {filteredCoordinates.length > 0 && (
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="map" className="flex items-center gap-2">
              <Map size={16} />
              Field Map
            </TabsTrigger>
            <TabsTrigger value="structural" className="flex items-center gap-2">
              <BarChart3 size={16} />
              Structural View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-0">
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-md">
                <div className="h-[500px] w-full">
                  <MapComponent
                    coordinates={filteredCoordinates.map((c) => [c.lat, c.lon] as [number, number])}
                    isLive={isLive}
                    tractorInfo={tractorInfo}
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
                    coordinates={filteredCoordinates.map((c) => [c.lat, c.lon] as [number, number])}
                    fieldName={fieldName}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={isFieldNameDialogOpen} onOpenChange={setIsFieldNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field Name</DialogTitle>
            <DialogDescription>Enter a name for this field to help identify it in your records.</DialogDescription>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFieldNameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateFieldName}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewFieldDialogOpen} onOpenChange={setIsNewFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Field</DialogTitle>
            <DialogDescription>Start tracking a new field with a fresh set of coordinates.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newFieldName" className="text-right">
                Field Name
              </Label>
              <Input
                id="newFieldName"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="col-span-3"
                placeholder="Enter field name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFieldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createNewField} className="flex items-center gap-2">
              <Save size={16} />
              Create Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
