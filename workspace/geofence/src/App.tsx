import type React from "react"
import GoogleMapComponent from "./component/google-map"
// import GoogleMapComponent from "./components/google-map"

const App: React.FC = () => {
  const markers = [
    {
      id: "1",
      position: { lat: 37.7749, lng: -122.4194 },
      title: "San Francisco",
    },
    {
      id: "2",
      position: { lat: 37.8044, lng: -122.2712 },
      title: "Oakland",
    },
    {
      id: "3",
      position: { lat: 37.3382, lng: -121.8863 },
      title: "San Jose",
    },
  ]

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Google Maps Demo</h1>
      <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200">
        <GoogleMapComponent markers={markers} height="600px" zoom={9} />
      </div>
    </div>
  )
}

export default App

