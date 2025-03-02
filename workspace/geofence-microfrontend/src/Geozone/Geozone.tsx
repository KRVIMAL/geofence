"use client"

import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader/dist/index.mjs";

import {
  createGeozone,
  fetchGeozoneHandler,
  updateGeozone,
  deleteGeozone,
  getAddressDetailsByPincode,
} from "./services/geozone.service"

 import { geoZoneInsertField } from "./Geozone.helper"
import {
  MapIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  CircleIcon,
  SquareIcon,
  LineChartIcon as LineIcon,
  PinIcon,
} from "lucide-react"
import CreateGeoZoneModal from "./component/CreateGeoZone.Modal"

// Define types
interface GeoZone {
  _id: string
  name: string
  locationType: string
  mobileNumber: string
  address: {
    zipCode: string
    country: string
    state: string
    area: string
    city: string
    district: string
  }
  finalAddress: string
  geoCodeData: {
    type: string
    geometry: {
      type: string
      coordinates: number[]
      radius?: number
    }
  }
  createdBy: string
  locationId?: string
}

interface FormField {
  value: string
  error: string
}

interface FormFields {
  [key: string]: FormField
}

const Geozone = () => {
  // State variables
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null)
  const [selectedShape, setSelectedShape] = useState<any>(null)
  const [selectedRowData, setSelectedRowData] = useState<GeoZone | null>(null)
  const [isOpen, setOpenModal] = useState<boolean>(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [geozoneData, setGeozoneData] = useState<GeoZone[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchText, setSearchText] = useState<string>("")
  const [locationType, setLocationType] = useState<any[]>([
    { type: "Warehouse" },
    { type: "Store" },
    { type: "Office" },
    { type: "Distribution Center" },
  ])
  const [edit, setEdit] = useState<boolean>(false)
  const [formField, setFormField] = useState<FormFields>(geoZoneInsertField())
  const [searchLocationText, setSearchLocationText] = useState<string>("")
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null)
  const [shapes, setShapes] = useState<any[]>([])
  const mapRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<HTMLInputElement>(null)
  const autocompleteInstance = useRef<any>(null)
  const [google, setGoogle] = useState<any>(null)

  // Add this at the beginning of the component, before any useEffects
  useEffect(() => {
    const loadGoogleMaps = async () => {
      if (typeof window.google === "undefined") {
        const loader = new Loader({
          apiKey: "AIzaSyAaZ1M_ofwVoLohowruNhY0fyihH9NpcI0",
          version: "weekly",
          libraries: ["places", "drawing", "geometry"],
        })

        try {
          const googleMaps = await loader.load()
          setGoogle(googleMaps)
          console.log("Google Maps loaded successfully")
        } catch (err) {
          console.error("Error loading Google Maps:", err)
        }
      }
    }

    loadGoogleMaps()
  }, [])

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: "AIzaSyAaZ1M_ofwVoLohowruNhY0fyihH9NpcI0", 
        version: "weekly",
        libraries: ["places", "drawing", "geometry"],
      })

      try {
        const googleMaps :any= await loader?.load()
        setGoogle(googleMaps)

        if (mapRef?.current) {
          const mapInstance = new googleMaps.maps.Map(mapRef?.current, {
            center: { lat: 28.7041, lng: 77.1025 }, // Default to Delhi, India
            zoom: 12,
            mapTypeId: googleMaps?.maps?.MapTypeId?.ROADMAP,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          })

          // Initialize drawing manager
          const drawingManagerInstance = new googleMaps.maps.drawing.DrawingManager({
            drawingMode: null,
            drawingControl: true,
            drawingControlOptions: {
              position: googleMaps?.maps?.ControlPosition?.TOP_CENTER,
              drawingModes: [
                googleMaps?.maps?.drawing?.OverlayType?.MARKER,
                googleMaps?.maps?.drawing?.OverlayType?.CIRCLE,
                googleMaps?.maps?.drawing?.OverlayType?.POLYGON,
                googleMaps?.maps?.drawing?.OverlayType?.POLYLINE,
              ],
            },
            markerOptions: {
              draggable: true,
            },
            circleOptions: {
              fillColor: "#4285F4",
              fillOpacity: 0.3,
              strokeWeight: 2,
              strokeColor: "#4285F4",
              clickable: true,
              editable: true,
              draggable: true,
              zIndex: 1,
            },
            polygonOptions: {
              fillColor: "#4285F4",
              fillOpacity: 0.3,
              strokeWeight: 2,
              strokeColor: "#4285F4",
              clickable: true,
              editable: true,
              draggable: true,
              zIndex: 1,
            },
            polylineOptions: {
              strokeColor: "#4285F4",
              strokeWeight: 2,
              clickable: true,
              editable: true,
              draggable: true,
              zIndex: 1,
            },
          })

          drawingManagerInstance.setMap(mapInstance)
          setMap(mapInstance)
          setDrawingManager(drawingManagerInstance)

          // Setup autocomplete for location search
        //   if (autocompleteRef.current) {
        //     const autocomplete = new googleMaps.places.Autocomplete(autocompleteRef?.current, {
        //       types: ["geocode"],
        //       componentRestrictions: { country: "in" },
        //     })

        //     autocomplete.addListener("place_changed", () => {
        //       const place = autocomplete?.getPlace()
        //       if (place.geometry && place.geometry.location) {
        //         mapInstance.setCenter(place.geometry.location)
        //         mapInstance.setZoom(15)

        //         // Add a marker at the selected location
        //         new googleMaps.maps.Marker({
        //           position: place?.geometry?.location,
        //           map: mapInstance,
        //           title: place?.name,
        //         })
        //       }
        //     })

        //     autocompleteInstance.current = autocomplete
        //   }

          // Setup event listeners for drawing completion
          if (googleMaps?.maps?.event) {
            googleMaps?.maps?.event?.addListener(drawingManagerInstance, "overlaycomplete", (event:any) => {
              // Switch off drawing mode
              drawingManagerInstance.setDrawingMode(null)
              setActiveDrawingTool(null)

              const newShape = event.overlay
              newShape.type = event.type

              // Add event listeners to the shape
              googleMaps?.maps?.event?.addListener(newShape, "click", () => {
                setSelectedShape(newShape)
              })

              setSelectedShape(newShape)
              setShapes([...shapes, newShape])

              // Open modal with shape data
              handleShapeCreated(newShape, event.type)
            })
          }
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error)
      }
    }

    initMap()
  }, [shapes, google])

  // Fetch geozones on component mount
  useEffect(() => {
    fetchGeozone()
  }, [])

  // Display geozones on map when data changes
  useEffect(() => {
    if (map && geozoneData.length > 0) {
      displayGeozonesOnMap()
    }
  }, [map, geozoneData, google])

  // Add this useEffect after the other useEffects
  useEffect(() => {
    // Ensure the map container has proper dimensions
    if (mapRef.current) {
      mapRef.current.style.height = "100%"
      mapRef.current.style.width = "100%"
    }

    // Trigger resize event to force map redraw if it exists
    if (map) {
      window.google?.maps.event.trigger(map, "resize")
    }
  }, [map])

  // Handle shape creation and open modal with shape data
  const handleShapeCreated = (shape: any, type: string) => {
    if (!google) return

    let coordinates: number[] = []
    let radius = 0
    let shapeType = ""

    if (type === google.maps.drawing.OverlayType.MARKER) {
      const position = shape.getPosition()
      coordinates = [position.lat(), position.lng()]
      shapeType = "Point"

      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: position }, (results:any, status:any) => {
        if (status === "OK" && results && results[0]) {
          const addressComponents = results[0].address_components
          let zipCode = ""
          let country = ""
          let state = ""
          let city = ""
          let district = ""
          let area = ""

          for (const component of addressComponents) {
            const types = component.types
            if (types.includes("postal_code")) {
              zipCode = component.long_name
            } else if (types.includes("country")) {
              country = component.long_name
            } else if (types.includes("administrative_area_level_1")) {
              state = component.long_name
            } else if (types.includes("locality")) {
              city = component.long_name
            } else if (types.includes("sublocality_level_1")) {
              district = component.long_name
            } else if (types.includes("sublocality_level_2")) {
              area = component.long_name
            }
          }

          const address = results[0].formatted_address

          setFormField({
            ...formField,
            type: { value: shapeType, error: "" },
            lat: { value: coordinates[0].toString(), error: "" },
            long: { value: coordinates[1].toString(), error: "" },
            radius: { value: "100", error: "" }, // Default radius for point
            zipCode: { value: zipCode, error: "" },
            country: { value: country, error: "" },
            state: { value: state, error: "" },
            city: { value: city, error: "" },
            district: { value: district, error: "" },
            area: { value: area, error: "" },
            address: { value: address, error: "" },
          })

          // If we have a zip code, fetch additional details
          if (zipCode) {
            fetchZipCodeDetails(zipCode)
          }

          setOpenModal(true)
        }
      })
    } else if (type === google.maps.drawing.OverlayType.CIRCLE) {
      const center = shape.getCenter()
      coordinates = [center.lat(), center.lng()]
      radius = shape.getRadius()
      shapeType = "Circle"

      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: center }, (results:any, status:any) => {
        if (status === "OK" && results && results[0]) {
          const addressComponents = results[0].address_components
          let zipCode = ""
          let country = ""
          let state = ""
          let city = ""
          let district = ""
          let area = ""

          for (const component of addressComponents) {
            const types = component.types
            if (types.includes("postal_code")) {
              zipCode = component.long_name
            } else if (types.includes("country")) {
              country = component.long_name
            } else if (types.includes("administrative_area_level_1")) {
              state = component.long_name
            } else if (types.includes("locality")) {
              city = component.long_name
            } else if (types.includes("sublocality_level_1")) {
              district = component.long_name
            } else if (types.includes("sublocality_level_2")) {
              area = component.long_name
            }
          }

          const address = results[0].formatted_address

          setFormField({
            ...formField,
            type: { value: shapeType, error: "" },
            lat: { value: coordinates[0].toString(), error: "" },
            long: { value: coordinates[1].toString(), error: "" },
            radius: { value: radius.toString(), error: "" },
            zipCode: { value: zipCode, error: "" },
            country: { value: country, error: "" },
            state: { value: state, error: "" },
            city: { value: city, error: "" },
            district: { value: district, error: "" },
            area: { value: area, error: "" },
            address: { value: address, error: "" },
          })

          // If we have a zip code, fetch additional details
          if (zipCode) {
            fetchZipCodeDetails(zipCode)
          }

          setOpenModal(true)
        }
      })
    } else if (type === google.maps.drawing.OverlayType.POLYGON) {
      const path = shape.getPath()
      const polygonCoordinates = []
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i)
        polygonCoordinates.push([point.lat(), point.lng()])
      }

      // Use the first point for address lookup
      coordinates = [polygonCoordinates[0][0], polygonCoordinates[0][1]]
      shapeType = "Polygon"

      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat: coordinates[0], lng: coordinates[1] } }, (results:any, status:any) => {
        if (status === "OK" && results && results[0]) {
          const addressComponents = results[0].address_components
          let zipCode = ""
          let country = ""
          let state = ""
          let city = ""
          let district = ""
          let area = ""

          for (const component of addressComponents) {
            const types = component.types
            if (types.includes("postal_code")) {
              zipCode = component.long_name
            } else if (types.includes("country")) {
              country = component.long_name
            } else if (types.includes("administrative_area_level_1")) {
              state = component.long_name
            } else if (types.includes("locality")) {
              city = component.long_name
            } else if (types.includes("sublocality_level_1")) {
              district = component.long_name
            } else if (types.includes("sublocality_level_2")) {
              area = component.long_name
            }
          }

          const address = results[0].formatted_address

          setFormField({
            ...formField,
            type: { value: shapeType, error: "" },
            lat: { value: coordinates[0].toString(), error: "" },
            long: { value: coordinates[1].toString(), error: "" },
            radius: { value: "0", error: "" },
            zipCode: { value: zipCode, error: "" },
            country: { value: country, error: "" },
            state: { value: state, error: "" },
            city: { value: city, error: "" },
            district: { value: district, error: "" },
            area: { value: area, error: "" },
            address: { value: address, error: "" },
          })

          if (zipCode) {
            fetchZipCodeDetails(zipCode)
          }

          setOpenModal(true)
        }
      })
    } else if (type === google.maps.drawing.OverlayType.POLYLINE) {
      const path = shape.getPath()
      const polylineCoordinates = []
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i)
        polylineCoordinates.push([point.lat(), point.lng()])
      }

      // Use the first point for address lookup
      coordinates = [polylineCoordinates[0][0], polylineCoordinates[0][1]]
      shapeType = "Polyline"

      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat: coordinates[0], lng: coordinates[1] } }, (results:any, status:any) => {
        if (status === "OK" && results && results[0]) {
          const addressComponents = results[0].address_components
          let zipCode = ""
          let country = ""
          let state = ""
          let city = ""
          let district = ""
          let area = ""

          for (const component of addressComponents) {
            const types = component.types
            if (types.includes("postal_code")) {
              zipCode = component.long_name
            } else if (types.includes("country")) {
              country = component.long_name
            } else if (types.includes("administrative_area_level_1")) {
              state = component.long_name
            } else if (types.includes("locality")) {
              city = component.long_name
            } else if (types.includes("sublocality_level_1")) {
              district = component.long_name
            } else if (types.includes("sublocality_level_2")) {
              area = component.long_name
            }
          }

          const address = results[0].formatted_address

          setFormField({
            ...formField,
            type: { value: shapeType, error: "" },
            lat: { value: coordinates[0].toString(), error: "" },
            long: { value: coordinates[1].toString(), error: "" },
            radius: { value: "0", error: "" },
            zipCode: { value: zipCode, error: "" },
            country: { value: country, error: "" },
            state: { value: state, error: "" },
            city: { value: city, error: "" },
            district: { value: district, error: "" },
            area: { value: area, error: "" },
            address: { value: address, error: "" },
          })

          if (zipCode) {
            fetchZipCodeDetails(zipCode)
          }

          setOpenModal(true)
        }
      })
    }
  }

  // Fetch zip code details
  const fetchZipCodeDetails = async (zipCode: string) => {
    try {
      const data = await getAddressDetailsByPincode(zipCode)
      if (data && data.length > 0) {
        const item = data[0]
        setFormField({
          ...formField,
          country: { ...formField.country, value: item.Country, error: "" },
          state: { ...formField.state, value: item.State, error: "" },
          area: { ...formField.area, value: item.Name, error: "" },
          district: { ...formField.district, value: item.District, error: "" },
          city: { ...formField.city, value: item.Block, error: "" },
          address: {
            ...formField.address,
            value: `${item.Country} - ${item.State} - ${item.Name} - ${item.District} - ${item.Block}`,
            error: "",
          },
        })
      }
    } catch (error) {
      console.error("Error fetching zip code details:", error)
    }
  }

  // Display geozones on map
  const displayGeozonesOnMap = () => {
    if (!map || !google) return

    // Clear existing shapes
    shapes.forEach((shape:any) => {
      shape.setMap(null)
    })
    setShapes([])

    // Add geozones to map
    const newShapes = geozoneData
      .map((geozone:any) => {
        const { geoCodeData } = geozone
        const { geometry } = geoCodeData
        const { type, coordinates, radius } = geometry

        let shape:any;

        if (type === "Point") {
          shape = new google.maps.Marker({
            position: { lat: coordinates[0], lng: coordinates[1] },
            map,
            title: geozone.name,
          })

          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
            <div>
              <h3>${geozone.name}</h3>
              <p>${geozone.finalAddress}</p>
            </div>
          `,
          })

          shape.addListener("click", () => {
            infoWindow.open(map, shape)
          })
        } else if (type === "Circle") {
          shape = new google.maps.Circle({
            center: { lat: coordinates[0], lng: coordinates[1] },
            radius: radius || 100,
            map,
            fillColor: "#4285F4",
            fillOpacity: 0.3,
            strokeWeight: 2,
            strokeColor: "#4285F4",
          })

          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
            <div>
              <h3>${geozone.name}</h3>
              <p>${geozone.finalAddress}</p>
              <p>Radius: ${radius} meters</p>
            </div>
          `,
          })

          shape.addListener("click", (e:any) => {
            infoWindow.setPosition({ lat: coordinates[0], lng: coordinates[1] })
            infoWindow.open(map)
          })
        } else if (type === "Polygon") {
          // For polygon, coordinates would be an array of points
          // This is a simplified example assuming coordinates is properly formatted
          shape = new google.maps.Polygon({
            paths: coordinates?.map((coord:any) => ({ lat: coord[0], lng: coord[1] })),
            map,
            fillColor: "#4285F4",
            fillOpacity: 0.3,
            strokeWeight: 2,
            strokeColor: "#4285F4",
          })

          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
            <div>
              <h3>${geozone.name}</h3>
              <p>${geozone.finalAddress}</p>
            </div>
          `,
          })

          shape.addListener("click", (e:any) => {
            infoWindow.setPosition(e.latLng)
            infoWindow.open(map)
          })
        } else if (type === "Polyline") {
          // For polyline, coordinates would be an array of points
          shape = new google.maps.Polyline({
            path: coordinates.map((coord:any) => ({ lat: coord[0], lng: coord[1] })),
            map,
            strokeColor: "#4285F4",
            strokeWeight: 2,
          })

          // Add info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
            <div>
              <h3>${geozone.name}</h3>
              <p>${geozone.finalAddress}</p>
            </div>
          `,
          })

          shape.addListener("click", (e:any) => {
            infoWindow.setPosition(e.latLng)
            infoWindow.open(map)
          })
        }

        // Store the geozone data with the shape
        if (shape) {
          shape.geozoneData = geozone
        }

        return shape
      })
      .filter(Boolean)

    setShapes(newShapes)
  }

  // Fetch geozones
  const fetchGeozone = async () => {
    try {
      setLoading(true)
      const res = await fetchGeozoneHandler({
        input: {
          // accountId: "tenant-id",
          page,
          limit,
        },
      })

      // Ensure we always have an array
      const data = Array.isArray(res?.listGeozone?.data) ? res.listGeozone.data : []
      setGeozoneData(data)
      setLoading(false)
    } catch (error: any) {
      console.error("Error fetching geozones:", error)
      setGeozoneData([]) // Set empty array on error
      setLoading(false)
    }
  }

  // Validate form fields
  const validateFields = () => {
    console.log({formField})
    let isValid = true
    const newFormField = { ...formField }

    Object.keys(formField).forEach((field) => {
      if (!formField[field]?.value && field !== "description") {
        newFormField[field].error = `Please enter ${field}.`
        isValid = false
      }
    })

    setFormField(newFormField)
    return isValid
  }

  // Add or update geozone
  const addGeozoneHandler = async () => {
    console.log("click");

    // if (!validateFields()) {
    //   console.log("if block");
    //   return
    // }

    try {
      setLoading(true)

      const payload = {
        clientId: "12345", // Replace with actual client ID
        name: formField.name?.value,
        mobileNumber: formField.mobileNumber?.value,
        address: {
          zipCode: formField.zipCode?.value,
          country: formField.country?.value,
          state: formField.state?.value,
          area: formField.area?.value,
          city: formField.city?.value,
          district: formField.district?.value,
        },
        finalAddress: formField.address?.value,
        geoCodeData: {
          type: "Feature",
          geometry: {
            type: formField.type?.value,
            coordinates: [Number.parseFloat(formField.lat?.value), Number.parseFloat(formField.long?.value)],
            radius: Number.parseInt(formField.radius?.value),
          },
        },
        createdBy: "admin", // Replace with actual user
      }

      if (edit && selectedRowData) {
        const res = await updateGeozone({
          input: {
            _id: selectedRowData._id,
            ...payload,
          },
        })
        console.log("Geozone updated successfully:", res)
        setEdit(false)
      } else {
        const res = await createGeozone({
          input: payload,
        })
        console.log("Geozone created successfully:", res)
      }

      handleCloseDialog()

      // Clear selected shape
      if (selectedShape) {
        selectedShape.setMap(null)
        setSelectedShape(null)
      }

      // Reset form
      setFormField(geoZoneInsertField())

      // Refresh geozones
      await fetchGeozone()

      setLoading(false)
    } catch (error: any) {
      console.error("Error saving geozone:", error)
      setLoading(false)
    }
  }

  // Close modal
  const handleCloseDialog = () => {
    setOpenModal(false)
    if (!edit) {
      setFormField(geoZoneInsertField())
    }
  }

  // Handle drawing tool selection
  const handleDrawingToolClick = (tool: string) => {
    if (!drawingManager || !map || !google) return

    if (activeDrawingTool === tool) {
      // Turn off drawing mode
      drawingManager.setDrawingMode(null)
      setActiveDrawingTool(null)
    } else {
      // Set drawing mode
      let drawingMode = null

      switch (tool) {
        case "marker":
          drawingMode = google.maps.drawing.OverlayType.MARKER
          break
        case "circle":
          drawingMode = google.maps.drawing.OverlayType.CIRCLE
          break
        case "polygon":
          drawingMode = google.maps.drawing.OverlayType.POLYGON
          break
        case "polyline":
          drawingMode = google.maps.drawing.OverlayType.POLYLINE
          break
      }

      drawingManager.setDrawingMode(drawingMode)
      setActiveDrawingTool(tool)
    }
  }

  // Handle edit geozone
  const handleEditGeozone = (geozone: GeoZone) => {
    setSelectedRowData(geozone)
    setFormField(geoZoneInsertField(geozone))
    setEdit(true)
    setOpenModal(true)

    // Center map on the geozone
    if (map) {
      const { coordinates } = geozone.geoCodeData.geometry
      map.setCenter({ lat: coordinates[0], lng: coordinates[1] })
      map.setZoom(15)
    }
  }

  // Handle delete geozone
  const handleDeleteGeozone = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this geozone?")) {
      try {
        setLoading(true)
        await deleteGeozone(id)
        await fetchGeozone()
        setLoading(false)
      } catch (error) {
        console.error("Error deleting geozone:", error)
        setLoading(false)
      }
    }
  }

  // Toggle sidebar
  const handleToggle = () => {
    setCollapsed(!collapsed)
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div
        className={`${
          collapsed ? "w-0" : "w-80"
        } transition-all duration-300 ease-in-out overflow-hidden bg-white dark:bg-gray-800 shadow-md`}
      >
        <div className={`p-4 ${collapsed ? "hidden" : "block"}`}>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white border-l-4 border-indigo-600 pl-2">
              Create Geozone
            </h2>

            <div className="relative mb-4">
              <input
                ref={autocompleteRef}
                type="text"
                placeholder="Search location..."
                className="w-full p-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
              />
              <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => handleDrawingToolClick("marker")}
                className={`p-2 rounded-md ${
                  activeDrawingTool === "marker"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
                title="Add Point"
              >
                <PinIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDrawingToolClick("circle")}
                className={`p-2 rounded-md ${
                  activeDrawingTool === "circle"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
                title="Add Circle"
              >
                <CircleIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDrawingToolClick("polygon")}
                className={`p-2 rounded-md ${
                  activeDrawingTool === "polygon"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
                title="Add Polygon"
              >
                <SquareIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDrawingToolClick("polyline")}
                className={`p-2 rounded-md ${
                  activeDrawingTool === "polyline"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
                title="Add Polyline"
              >
                <LineIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white border-l-4 border-indigo-600 pl-2">
              Geozone List
            </h2>

            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search geozone..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full p-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
              />
              <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {geozoneData
                    .filter((item) => {
                      if (searchText.trim() !== "") {
                        return item.name.toLowerCase().includes(searchText.toLowerCase())
                      }
                      return true
                    })
                    .map((item) => (
                      <li
                        key={item._id}
                        className="p-3 bg-white dark:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                              <MapIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.locationType || "Location"}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditGeozone(item)}
                              className="p-1 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteGeozone(item._id)}
                              className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="absolute top-4 left-80 z-10 bg-white dark:bg-gray-800 shadow-md rounded-full p-2 transform -translate-x-1/2"
      >
        {collapsed ? (
          <ChevronRightIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        ) : (
          <ChevronLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        )}
      </button>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0 w-full h-full" id="map"></div>
      </div>

      {/* Modal */}
      <CreateGeoZoneModal
        isOpenModal={isOpen}
        handleUpdateDialogClose={handleCloseDialog}
        setFormField={setFormField}
        formField={formField}
        addGeozoneHandler={addGeozoneHandler}
        locationType={locationType}
        edit={edit}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      )}
    </div>
  )
}

export default Geozone

