import axios from "axios";

const API_URL = "http://localhost:9090/geofences"; // Update this if needed

// Fetch all geofences (Paginated)
export const fetchGeofences = async (page = 1, limit = 10) => {
  const response = await axios.get(`${API_URL}?page=${page}&limit=${limit}`);
  return response.data.data;
};

// Search geofences
export const searchGeofences = async (searchText: string, page = 1, limit = 10) => {
  const response = await axios.get(`${API_URL}/search?page=${page}&limit=${limit}&searchText=${searchText}`);
  return response.data.data;
};

// Fetch a single geofence by ID
export const getGeofence = async (id: string) => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data.data;
};

// Create a geofence
export const createGeofence = async (geofenceData: any) => {
  const response = await axios.post(API_URL, geofenceData);
  return response.data.data;
};

// Update a geofence
export const updateGeofence = async (id: string, updatedData: any) => {
  const response = await axios.put(`${API_URL}/${id}`, updatedData);
  return response.data.data;
};

// Delete a geofence
export const deleteGeofence = async (id: string) => {
  await axios.delete(`${API_URL}/${id}`);
};
