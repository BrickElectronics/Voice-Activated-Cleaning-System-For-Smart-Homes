import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the server
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (!data.coordinates || !Array.isArray(data.coordinates) || !data.fieldId) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid data format. Expected coordinates array and fieldId.",
        },
        { status: 400 },
      )
    }

    // Insert coordinates
    const { error } = await supabase.from("coordinates").insert(data.coordinates)

    if (error) {
      console.error("Error inserting coordinates:", error)
      return NextResponse.json(
        {
          success: false,
          message: "Failed to insert coordinates",
          error: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully inserted ${data.coordinates.length} coordinates`,
    })
  } catch (error) {
    console.error("Error processing coordinates:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error processing request",
      },
      { status: 500 },
    )
  }
}
