"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Compass, Gauge, Activity } from "lucide-react"

interface TractorDashboardProps {
  tractorInfo: {
    speed: number
    heading: number
    status: string
  }
}

export default function TractorDashboard({ tractorInfo }: TractorDashboardProps) {
  // Convert heading to cardinal direction
  const getCardinalDirection = (heading: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"]
    return directions[Math.round(heading / 45) % 8]
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "moving":
        return "text-green-500"
      case "idle":
        return "text-amber-500"
      default:
        return "text-gray-500"
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge size={16} className="text-primary" />
            Speed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold">{tractorInfo.speed.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">km/h</span>
            </div>
            <Progress value={Math.min((tractorInfo.speed / 20) * 100, 100)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Compass size={16} className="text-primary" />
            Heading
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
              <div
                className="absolute top-1/2 left-1/2 w-1 h-8 bg-primary -translate-x-1/2 -translate-y-1/2 origin-bottom"
                style={{ transform: `translate(-50%, -100%) rotate(${tractorInfo.heading}deg)` }}
              ></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs">N</div>
              <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 text-xs">E</div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-xs">S</div>
              <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 text-xs">W</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{tractorInfo.heading.toFixed(0)}°</div>
              <div className="text-sm text-muted-foreground">{getCardinalDirection(tractorInfo.heading)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${getStatusColor(tractorInfo.status)}`}>
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tractorInfo.status === "moving" ? "bg-green-400" : "bg-amber-400"} opacity-75`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${tractorInfo.status === "moving" ? "bg-green-500" : "bg-amber-500"}`}
                ></span>
              </span>
              <span className="capitalize font-medium">{tractorInfo.status}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {tractorInfo.status === "moving" ? "In operation" : "Stationary"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
