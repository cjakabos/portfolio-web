
export type UsersData = {
    data: UserData[];
    status: string;
    error?: string;
};

export type UserData = {
    id: number;
    name: string;
    email: string;
    gender: string;
    status: string;
};

export type PostData = {
    id: number;
    user_id: number;
    title: string;
    body: string;
};

export type CommentData = {
    id: number;
    post_id: number;
    name: string;
    email: string;
    body: string;
};

export type error = {
    error: string,
    results: string[],
    status: string;
};

export type Country = {
    country: string;
};

export type CountryData = {
    "Bunker fuels (Not in Total)": number;
    "Cement": number;
    "Country": string;
    "Gas Flaring": number;
    "Gas Fuel": number;
    "Liquid Fuel": number;
    "Per Capita": number;
    "Solid Fuel": number;
    "Total": number;
    "Year": number;
};

export type GeoJSONFeature = {
    type: "Feature";
    properties: {
        FID: number;
        NAME: string;
        Obesity: number;
        SHAPE_Length: number;
        SHAPE_Area: number;
    };
    geometry: {
        type: "MultiPolygon";
        coordinates: number[][][][];
    };
};

export type GeoJSON = {
    type: "FeatureCollection";
    name: string;
    crs: {
        type: "name";
        properties: {
            name: string;
        };
    };
    features: GeoJSONFeature[];
};

export type ObesityData = {
    FID: number;
    NAME: string;
    Obesity: number;
};
