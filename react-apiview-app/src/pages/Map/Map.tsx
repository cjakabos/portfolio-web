// Based on source: https://github.com/leighhalliday/google-maps-react-2020
import React  from "react";

import {
    GoogleMap,
    useLoadScript,
    Marker,
    InfoWindow,
} from "@react-google-maps/api";
import * as process from "process";


const mapContainerStyle = {
    height: "80vh",
    width: "80vw",
};
const options = {
    disableDefaultUI: true,
    zoomControl: true,
};
const center = {
    lat: 34,
    lng: -118,
};
export interface PageProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export default function Map() {

    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: (process.env.REACT_APP_GMAPS_API_URL || 'test'),
    });
    const [markers, setMarkers] = React.useState([
        {
            lat: 34,
            lng: -118,
            time: new Date(),
            customField: "some text here",
        }
    ]);
    const [selected, setSelected] = React.useState<any>()

    const onMapClick = React.useCallback((e) => {
        setMarkers((current) => [
            ...current,
            {
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
                time: new Date(),
                customField: "somee text here",
            },
        ]);
    }, []);

    const mapRef = React.useRef();
    const onMapLoad = React.useCallback((map) => {
        mapRef.current = map;
    }, []);


    if (loadError) return "Error";
    if (!isLoaded) return "Loading...";

    return (
        <div className="tab1">
            <h2>
                {" "}
                This is the basic map integration
                {" "}
            </h2>
            <GoogleMap
                id="map"
                mapContainerStyle={mapContainerStyle}
                zoom={8}
                center={center}
                options={options}
                onClick={onMapClick}
                onLoad={onMapLoad}
            >
                {markers.map((marker) => (
                    <Marker
                        key={`${marker.lat}-${marker.lng}`}
                        position={{ lat: marker.lat, lng: marker.lng }}
                        onClick={() => {
                            setSelected(marker);
                        }}
                        icon={{
                            url: `/voyager.svg`,
                            origin: new window.google.maps.Point(0, 0),
                            anchor: new window.google.maps.Point(15, 15),
                            scaledSize: new window.google.maps.Size(30, 30),
                        }}
                    />
                ))}

                {selected ? (
                    <InfoWindow
                        position={{ lat: selected.lat, lng: selected.lng }}
                        onCloseClick={() => {
                            setSelected(null);
                        }}
                    >
                        <div>
                            <h2>
                            <span role="img" aria-label="bear">
                              🖖
                            </span>{" "}
                                Alert
                            </h2>
                            <p>Spotted at lat {selected.lat} and lng {selected.lng}</p>
                            <p>Spotted {selected.customField}</p>
                        </div>
                    </InfoWindow>
                ) : null}
            </GoogleMap>
        </div>
    );
};
