export const geoZoneInsertField = (data?: any) => {
    return {
      name: {
        value: data?.name ?? "",
        error: "",
      },
      type: {
        value: data?.geoCodeData?.geometry?.type ?? "",
        error: "",
      },
      client: {
        value: data?.client ?? "",
        error: "",
      },
      mobileNumber: {
        value: data?.mobileNumber ?? "",
        error: "",
      },
      address: {
        value: data?.finalAddress ?? "",
        error: "",
      },
      zipCode: {
        value: data?.address?.zipCode ?? "",
        error: "",
      },
      country: {
        value: data?.address?.country ?? "",
        error: "",
      },
      state: {
        value: data?.address?.state ?? "",
        error: "",
      },
      area: {
        value: data?.address?.area ?? "",
        error: "",
      },
      city: {
        value: data?.address?.city ?? "",
        error: "",
      },
      district: {
        value: data?.address?.district ?? "",
        error: "",
      },
      lat: {
        value: data?.geoCodeData?.geometry?.coordinates[0] ?? "",
        error: "",
      },
      long: {
        value: data?.geoCodeData?.geometry?.coordinates[1] ?? "",
        error: "",
      },
      radius: {
        value: data?.geoCodeData?.geometry?.radius ?? "",
        error: "",
      },
    }
  }
  
  