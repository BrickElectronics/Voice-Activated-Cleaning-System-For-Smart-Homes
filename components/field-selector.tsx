"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, RefreshCw } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@supabase/supabase-js"

// Create a singleton Supabase client for the browser
const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

interface Field {
  id: string
  name: string
  created_at: string
}

interface FieldSelectorProps {
  onFieldChange: (fieldId: string, fieldName: string) => void
  onNewField: () => void
  currentFieldId: string | null
}

export default function FieldSelector({ onFieldChange, onNewField, currentFieldId }: FieldSelectorProps) {
  const [fields, setFields] = useState<Field[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createBrowserClient()

  const fetchFields = async () => {
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from("fields")
        .select("id, name, created_at")
        .order("updated_at", { ascending: false })

      if (data) {
        setFields(data)
      }
    } catch (error) {
      console.error("Error fetching fields:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFields()
  }, [])

  const handleFieldChange = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (field) {
      onFieldChange(field.id, field.name)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentFieldId || undefined}
        onValueChange={handleFieldChange}
        disabled={isLoading || fields.length === 0}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id}>
              {field.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" onClick={fetchFields} disabled={isLoading} title="Refresh fields">
        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
      </Button>

      <Button variant="outline" size="icon" onClick={onNewField} title="Create new field">
        <PlusCircle size={16} />
      </Button>
    </div>
  )
}
