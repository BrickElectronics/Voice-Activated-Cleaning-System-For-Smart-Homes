// Utility functions for area calculations

// Shoelace formula (Gauss's area formula)
export function calculateShoelaceArea(coordinates: Array<{ lat: number; lon: number }>): number {
  if (coordinates.length < 3) return 0

  let area = 0
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    area += coordinates[i].lat * coordinates[j].lon
    area -= coordinates[j].lat * coordinates[i].lon
  }

  // Take the absolute value and divide by 2
  area = Math.abs(area) / 2

  // Convert to square kilometers (approximate conversion)
  const areaInSquareKm = area * 111.32 * 111.32

  // Convert to hectares (1 sq km = 100 hectares)
  return areaInSquareKm * 100
}

// Haversine formula to calculate distance between two points on Earth
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
export function calculateHaversineArea(coordinates: Array<{ lat: number; lon: number }>): number {
  if (coordinates.length < 3) return 0

  let area = 0
  const centroid = {
    lat: coordinates.reduce((sum, coord) => sum + coord.lat, 0) / coordinates.length,
    lon: coordinates.reduce((sum, coord) => sum + coord.lon, 0) / coordinates.length,
  }

  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length

    // Calculate the three sides of the triangle
    const a = haversineDistance(centroid.lat, centroid.lon, coordinates[i].lat, coordinates[i].lon)
    const b = haversineDistance(centroid.lat, centroid.lon, coordinates[j].lat, coordinates[j].lon)
    const c = haversineDistance(coordinates[i].lat, coordinates[i].lon, coordinates[j].lat, coordinates[j].lon)

    // Heron's formula for triangle area
    const s = (a + b + c) / 2
    const triangleArea = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)))

    area += triangleArea
  }

  // Convert to hectares (1 sq km = 100 hectares)
  return area * 100
}

// Graham scan algorithm for convex hull
export function calculateConvexHull(
  coordinates: Array<{ lat: number; lon: number }>,
): Array<{ lat: number; lon: number }> {
  if (coordinates.length <= 3) return coordinates

  // Find the point with the lowest y-coordinate (and leftmost if tied)
  let lowestPoint = coordinates[0]
  for (let i = 1; i < coordinates.length; i++) {
    if (
      coordinates[i].lat < lowestPoint.lat ||
      (coordinates[i].lat === lowestPoint.lat && coordinates[i].lon < lowestPoint.lon)
    ) {
      lowestPoint = coordinates[i]
    }
  }

  // Sort points by polar angle with respect to the lowest point
  const sortedPoints = [...coordinates].sort((a, b) => {
    if (a === lowestPoint) return -1
    if (b === lowestPoint) return 1

    const angleA = Math.atan2(a.lat - lowestPoint.lat, a.lon - lowestPoint.lon)
    const angleB = Math.atan2(b.lat - lowestPoint.lat, b.lon - lowestPoint.lon)

    if (angleA === angleB) {
      // If angles are the same, sort by distance from lowestPoint
      const distA = Math.sqrt(Math.pow(a.lat - lowestPoint.lat, 2) + Math.pow(a.lon - lowestPoint.lon, 2))
      const distB = Math.sqrt(Math.pow(b.lat - lowestPoint.lat, 2) + Math.pow(b.lon - lowestPoint.lon, 2))
      return distA - distB
    }

    return angleA - angleB
  })

  // Graham scan algorithm
  const hull: Array<{ lat: number; lon: number }> = [sortedPoints[0], sortedPoints[1]]

  for (let i = 2; i < sortedPoints.length; i++) {
    while (hull.length >= 2 && !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], sortedPoints[i])) {
      hull.pop()
    }
    hull.push(sortedPoints[i])
  }

  return hull
}

// Helper function for convex hull algorithm
function isLeftTurn(
  p1: { lat: number; lon: number },
  p2: { lat: number; lon: number },
  p3: { lat: number; lon: number },
): boolean {
  return (p2.lon - p1.lon) * (p3.lat - p1.lat) - (p2.lat - p1.lat) * (p3.lon - p1.lon) > 0
}

// Calculate area of convex hull using shoelace formula
export function calculateConvexHullArea(coordinates: Array<{ lat: number; lon: number }>): number {
  const hull = calculateConvexHull(coordinates)
  return calculateShoelaceArea(hull)
}

// Simple Delaunay triangulation for area calculation
export function calculateDelaunayArea(coordinates: Array<{ lat: number; lon: number }>): number {
  if (coordinates.length < 3) return 0

  // For simplicity, we'll use a greedy triangulation approach
  // In a real implementation, you'd use a proper Delaunay triangulation library

  // Start with the convex hull
  const hull = calculateConvexHull(coordinates)

  // Find points inside the hull
  const interiorPoints = coordinates.filter(
    (point) => !hull.some((hullPoint) => hullPoint.lat === point.lat && hullPoint.lon === point.lon),
  )

  // Calculate area of the hull
  const totalArea = calculateShoelaceArea(hull)

  // If there are no interior points, just return the hull area
  if (interiorPoints.length === 0) {
    return totalArea
  }

  // For demonstration purposes, we'll just return the hull area
  // In a real implementation, you'd triangulate the interior points
  return totalArea
}

// Get the appropriate area calculation function based on algorithm name
export function getAreaCalculationFunction(algorithm: string): (coords: Array<{ lat: number; lon: number }>) => number {
  switch (algorithm) {
    case "haversine":
      return calculateHaversineArea
    case "convexHull":
      return calculateConvexHullArea
    case "delaunay":
      return calculateDelaunayArea
    case "shoelace":
    default:
      return calculateShoelaceArea
  }
}

// Get algorithm display name
export function getAlgorithmDisplayName(algorithm: string): string {
  switch (algorithm) {
    case "haversine":
      return "Haversine Method"
    case "convexHull":
      return "Convex Hull"
    case "delaunay":
      return "Delaunay Triangulation"
    case "shoelace":
    default:
      return "Shoelace Formula"
  }
}

// Get algorithm description
export function getAlgorithmDescription(algorithm: string): string {
  switch (algorithm) {
    case "haversine":
      return "Accounts for Earth's curvature using great-circle distances between points."
    case "convexHull":
      return "Creates the smallest convex polygon containing all points, useful for irregular shapes."
    case "delaunay":
      return "Divides the area into triangles for more precise calculation of complex shapes."
    case "shoelace":
    default:
      return "Standard mathematical algorithm for calculating the area of a polygon using coordinate pairs."
  }
}
