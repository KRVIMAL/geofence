"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api"

interface MapProps {
  center?: google.maps.LatLngLiteral
  zoom?: number
  markers?: Array<{
    id: string
    position: google.maps.LatLngLiteral
    title?: string
  }>
  height?: string
  width?: string
}

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194,
}

const containerStyle = {
  width: "100%",
  height: "100%",
}

const GoogleMapComponent: React.FC<MapProps> = ({
  center = defaultCenter,
  zoom = 10,
  markers = [],
  height = "500px",
  width = "100%",
}) => {
  const apiKey = "AIzaSyAaZ1M_ofwVoLohowruNhY0fyihH9NpcI0"

  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  })

  const onMarkerClick = useCallback((markerId: string) => {
    setSelectedMarker(markerId)
  }, [])

  const onInfoWindowClose = useCallback(() => {
    setSelectedMarker(null)
  }, [])

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-red-100 text-red-700 p-4 rounded-lg">
        <div>
          <h2 className="text-xl font-bold mb-2">Error loading Google Maps</h2>
          <p>There was an error loading the map. This could be due to:</p>
          <ul className="list-disc list-inside mt-2">
            <li>Invalid API key</li>
            <li>Billing not enabled on your Google Cloud account</li>
            <li>Google Maps JavaScript API not enabled for your project</li>
          </ul>
          <p className="mt-4">Please check your Google Cloud Console and ensure everything is set up correctly.</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-full">Loading maps...</div>
  }

  return (
    <div className="relative" style={{ height, width }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: true,
          mapTypeControl: true,
        }}
      >
        {markers.map((marker) => (
          <Marker key={marker.id} position={marker.position} onClick={() => onMarkerClick(marker.id)}>
            {selectedMarker === marker.id && marker.title && (
              <InfoWindow onCloseClick={onInfoWindowClose}>
                <div>{marker.title}</div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>
    </div>
  )
}

export default GoogleMapComponent

