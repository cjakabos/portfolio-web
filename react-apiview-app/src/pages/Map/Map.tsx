import React, {useEffect, useState} from "react";
import axios from "axios";

import {
    GoogleMap,
    useLoadScript,
    Marker,
    InfoWindow,
} from "@react-google-maps/api";


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

    // Load all get methods once, when page renders
    useEffect(() => {
        getVehicles()
    }, []);

    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: (process.env.REACT_APP_GMAPS_API_URL || 'test'),
    });
    const [markers, setMarkers] = React.useState([
        {
            lat: 999,
            lng: 999,
            time: new Date(),
        }
    ]);
    const [MapFeedback, setMapFeedback] = useState("")

    const [selected, setSelected] = React.useState<any>()

    const onMapClick = React.useCallback((e: any) => {
        setMarkers((current) => [
            ...current,
            {
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
                time: new Date(),
                customField: "some text here",
                id: '',
            },
        ]);
        vehicleSubmit(e.latLng.lat(), e.latLng.lng())
        getVehicles ()
    }, []);

    const mapRef = React.useRef();
    const onMapLoad = React.useCallback((map: any) => {
        mapRef.current = map;
    }, []);

    function vehicleSubmit (lat: number, lng: number) {


        var postData = {
            condition:"USED",
            details:{
                body:"sedan",
                model:"Impala",
                manufacturer:{
                    code:101,
                    name:"Chevrolet"
                },
                numberOfDoors:4,
                fuelType:"Gasoline",
                engine:"3.6L V6",
                mileage:32280,
                modelYear:2018,
                productionYear:2018,
                externalColor:"white"
            },
            location:{
                lat: lat,
                lon: lng
            }
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8080/cars', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);

                setMapFeedback('OK')
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
                if (error.code === 'ERR_NETWORK') {
                    setMapFeedback('API ERROR')
                }
            })


    };

    function getVehicles() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
            }
        };

        axios.get('http://localhost:8080/cars', axiosConfig)
            .then((response) => {
                // for each element received, put up a marker
                response.data._embedded.carList.map((option: { location: any; id: any }) => (
                    setMarkers((current) => [
                        ...current,
                        {
                            lat: Number(option.location.lat),
                            lng: Number(option.location.lon),
                            time: new Date(),
                            customField: "vehicle-api fetch",
                            id: option.id,
                        },
                    ])

                ));
                setMapFeedback('OK')
                console.log("response: ", response.status);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", axiosConfig);
                //setName(error.response);
                if (error.code === 'ERR_NETWORK') {
                    setMapFeedback('API ERROR')
                }
            })
    };

    function deleteVehicle(vehicleId: string) {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
            }
        };

        axios.delete('http://localhost:8080/cars/' + vehicleId, axiosConfig)
            .then((response) => {
                setMapFeedback('OK')
                console.log("response delete: ", response.status);
                window.location.reload()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", axiosConfig);
                //setName(error.response);
                if (error.code === 'ERR_NETWORK') {
                    setMapFeedback('API ERROR')
                }
            })
    };


    if (loadError) return "Error";
    if (!isLoaded) return "Loading...";

    return (
        <div className="tab1">
            <h2>
                {" "}
                Map integration to vehicles-api, click the map <br/>to generate new vehicles and save them to vehicles-api database.
                {" "}
                {/*<br/><input id="itemButton" type="submit" value="Get all vehicles" onClick = {getVehicles}/>*/}
                <div className="login-error">
                    {MapFeedback === 'API ERROR' && <h1 style={{ color: 'red' }}>{("Please start API service")}</h1>}
                </div>
            </h2>
            <GoogleMap
                id="map"
                mapContainerStyle={mapContainerStyle}
                zoom={9}
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
                            <button className="cart-button" style={{ background: 'red', color: 'white'}} onClick={() => deleteVehicle(selected.id)}> Delete </button>
                        </div>
                    </InfoWindow>
                ) : null}
            </GoogleMap>
        </div>
    );
};
