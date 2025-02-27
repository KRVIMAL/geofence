"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Define types for our component props
interface MapProps {
  center?: [number, number]
  zoom?: number
  markers?: Array<{
    id: string
    position: [number, number]
    title?: string
  }>
  height?: string
  width?: string
}

// Default center location (San Francisco)
const defaultCenter: [number, number] = [37.7749, -122.4194]

const MapComponent: React.FC<MapProps> = ({
  center = defaultCenter,
  zoom = 10,
  markers = [],
  height = "500px",
  width = "100%",
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // Initialize the map
      mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom)

      // Add OpenStreetMap tiles (free to use)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstanceRef.current)

      // Add markers
      markers.forEach((marker) => {
        L.marker(marker.position)
          .addTo(mapInstanceRef.current!)
          .bindPopup(marker.title || "")
      })
    }

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [center, zoom, markers])

  // Handle updates to markers or center
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Update center and zoom if they change
      mapInstanceRef.current.setView(center, zoom)

      // Clear existing markers
      mapInstanceRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          mapInstanceRef.current!.removeLayer(layer)
        }
      })

      // Add updated markers
      markers.forEach((marker) => {
        L.marker(marker.position)
          .addTo(mapInstanceRef.current!)
          .bindPopup(marker.title || "")
      })
    }
  }, [center, zoom, markers])

  return (
    <div className="relative" style={{ height, width }}>
      <div ref={mapRef} className="h-full w-full rounded-lg" />
    </div>
  )
}

export default MapComponent

