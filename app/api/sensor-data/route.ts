import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the server
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// In-memory storage for coordinates (as a fallback)
let storedCoordinates: Array<{ lat: number; lon: number }> = []
let esp32CalculatedArea: number | null = null
let lastCalculatedArea: number | null = null
let fieldName = "Unnamed Field"
let currentFieldId: string | null = null
const tractorInfo: {
  speed: number
  heading: number
  status: string
} = {
  speed: 0,
  heading: 0,
  status: "idle",
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // If we're receiving live coordinates
    if (data.lat !== undefined && data.lon !== undefined) {
      // Filter out (0,0) coordinates or coordinates very close to 0,0
      if (Math.abs(data.lat) < 0.0001 && Math.abs(data.lon) < 0.0001) {
        return NextResponse.json({
          success: false,
          message: "Ignored (0,0) coordinate",
        })
      }

      // Store the coordinate in memory
      storedCoordinates.push({
        lat: data.lat,
        lon: data.lon,
      })

      // Update tractor info if provided
      if (data.speed !== undefined) tractorInfo.speed = data.speed
      if (data.heading !== undefined) tractorInfo.heading = data.heading
      if (data.status !== undefined) tractorInfo.status = data.status

      // Store the coordinate in Supabase if we have a field ID
      if (currentFieldId) {
        // Get the next sequence number
        const { data: maxSeq } = await supabase
          .from("coordinates")
          .select("sequence_number")
          .eq("field_id", currentFieldId)
          .order("sequence_number", { ascending: false })
          .limit(1)

        const nextSeq = maxSeq && maxSeq.length > 0 ? maxSeq[0].sequence_number + 1 : 1

        // Insert coordinate
        await supabase.from("coordinates").insert({
          field_id: currentFieldId,
          lat: data.lat,
          lon: data.lon,
          sequence_number: nextSeq,
        })

        // Log tractor status
        await supabase.from("tractor_logs").insert({
          field_id: currentFieldId,
          speed: data.speed || 0,
          heading: data.heading || 0,
          status: data.status || "idle",
          lat: data.lat,
          lon: data.lon,
        })
      }

      return NextResponse.json({
        success: true,
        message: "Live coordinate received",
        totalCoordinates: storedCoordinates.length,
      })
    }

    // If we're receiving area calculation and coordinates
    if (data.area !== undefined && data.coordinates) {
      esp32CalculatedArea = data.area

      // Filter out (0,0) coordinates
      const filteredCoordinates = data.coordinates.filter(
        (coord: { lat: number; lon: number }) => !(Math.abs(coord.lat) < 0.0001 && Math.abs(coord.lon) < 0.0001),
      )

      if (filteredCoordinates.length > 0) {
        storedCoordinates = filteredCoordinates
      }

      // Update field name if provided
      if (data.fieldName) {
        fieldName = data.fieldName
      }

      return NextResponse.json({
        success: true,
        message: "Area and coordinates received",
        area: data.area,
        coordinatesCount: filteredCoordinates.length,
      })
    }

    return NextResponse.json(
      {
        success: false,
        message: "Invalid data format",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Error processing sensor data:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error processing request",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  // Try to get the active field from Supabase
  if (!currentFieldId) {
    const { data: fields } = await supabase
      .from("fields")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)

    if (fields && fields.length > 0) {
      currentFieldId = fields[0].id
      fieldName = fields[0].name
      esp32CalculatedArea = fields[0].esp32_area
      lastCalculatedArea = fields[0].web_area
    }
  }

  // If we have a field ID, get coordinates from Supabase
  if (currentFieldId) {
    const { data: coordinates } = await supabase
      .from("coordinates")
      .select("*")
      .eq("field_id", currentFieldId)
      .order("sequence_number", { ascending: true })

    if (coordinates && coordinates.length > 0) {
      storedCoordinates = coordinates.map((c) => ({ lat: c.lat, lon: c.lon }))
    }

    // Get latest tractor info
    const { data: tractorLogs } = await supabase
      .from("tractor_logs")
      .select("*")
      .eq("field_id", currentFieldId)
      .order("created_at", { ascending: false })
      .limit(1)

    if (tractorLogs && tractorLogs.length > 0) {
      tractorInfo.speed = tractorLogs[0].speed
      tractorInfo.heading = tractorLogs[0].heading
      tractorInfo.status = tractorLogs[0].status
    }
  }

  return NextResponse.json({
    coordinates: storedCoordinates,
    esp32Area: esp32CalculatedArea,
    webArea: lastCalculatedArea,
    fieldName: fieldName,
    tractorInfo: tractorInfo,
    fieldId: currentFieldId,
  })
}

// Update the web-calculated area
export async function PUT(request: Request) {
  try {
    const data = await request.json()

    if (data.area !== undefined) {
      lastCalculatedArea = data.area

      // Update in Supabase if we have a field ID
      if (currentFieldId) {
        await supabase.from("fields").update({ web_area: data.area }).eq("id", currentFieldId)
      }

      return NextResponse.json({
        success: true,
        message: "Web area updated",
      })
    }

    if (data.fieldName !== undefined) {
      fieldName = data.fieldName

      // Update in Supabase if we have a field ID
      if (currentFieldId) {
        await supabase.from("fields").update({ name: data.fieldName }).eq("id", currentFieldId)
      } else {
        // Create a new field
        const { data: newField } = await supabase.from("fields").insert({ name: data.fieldName }).select()

        if (newField && newField.length > 0) {
          currentFieldId = newField[0].id

          // Insert all current coordinates
          if (storedCoordinates.length > 0) {
            const coordsToInsert = storedCoordinates.map((coord, index) => ({
              field_id: currentFieldId,
              lat: coord.lat,
              lon: coord.lon,
              sequence_number: index + 1,
            }))

            await supabase.from("coordinates").insert(coordsToInsert)
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Field name updated",
        fieldId: currentFieldId,
      })
    }

    if (data.createNewField !== undefined) {
      // Create a new field
      const { data: newField } = await supabase
        .from("fields")
        .insert({ name: data.fieldName || "New Field" })
        .select()

      if (newField && newField.length > 0) {
        currentFieldId = newField[0].id
        fieldName = newField[0].name

        // Reset stored coordinates
        storedCoordinates = []
        esp32CalculatedArea = null
        lastCalculatedArea = null
      }

      return NextResponse.json({
        success: true,
        message: "New field created",
        fieldId: currentFieldId,
        fieldName: fieldName,
      })
    }

    return NextResponse.json(
      {
        success: false,
        message: "Invalid data format",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Error updating data:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error processing request",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fieldId = searchParams.get("fieldId")

    if (!fieldId) {
      return NextResponse.json(
        {
          success: false,
          message: "Field ID is required",
        },
        { status: 400 },
      )
    }

    // Delete coordinates from Supabase
    const { error } = await supabase.from("coordinates").delete().eq("field_id", fieldId)

    if (error) {
      console.error("Error deleting coordinates:", error)
      return NextResponse.json(
        {
          success: false,
          message: "Failed to delete coordinates",
          error: error.message,
        },
        { status: 500 },
      )
    }

    // Reset in-memory storage for this field
    if (currentFieldId === fieldId) {
      storedCoordinates = []
      esp32CalculatedArea = null
      lastCalculatedArea = null
    }

    return NextResponse.json({
      success: true,
      message: "Coordinates deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting coordinates:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error processing request",
      },
      { status: 500 },
    )
  }
}
