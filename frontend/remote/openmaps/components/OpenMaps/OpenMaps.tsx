"use client";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {
	FeatureGroup,
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	GeoJSON,
	useMap,
	LayersControl,
	useMapEvents,
	Rectangle,
} from 'react-leaflet';
import L, { Icon, LatLng, LeafletMouseEvent } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import MarkerClusterGroup from "react-leaflet-cluster";
import axios from "axios";
type AdressPoint = Array<[number, number, string]>
import SwedenMapData from '../../public/svenska-landskap.geo.json';
import SwedenMuncipalityMapData from '../../public/svenska-kommun.geo.json';
import WorldMapData from '../../public/world.geo.json';

export default function OpenMaps() {

	const [userToken, setUserToken] = useState('');
	//Make sure only runs once
	const effectRan = useRef(false);
	if (!effectRan.current) {
		if (typeof window !== "undefined") {
			console.log(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN"))
			setUserToken(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
			effectRan.current = true;
		}
		getVehicles();
	}
	console.log('ran2')


	var icon3 = L.icon({
		iconUrl: 'http://localhost:5002/icons/tourism.png',
		iconSize:     [40, 40]
	});


	var icon5 = L.icon({
		iconUrl: 'http://localhost:5002/icons/voyager.png',
		iconSize:     [40, 40]
	});

	const mapRef = useRef();
	const [center, setCenter] = useState<any>([59.328246, 18.053383]);
	const [markers, setMarkers] = React.useState([
		{
			lat: 999,
			lng: 999,
			time: new Date(),
			comment: "",
			id: "",
		}
	]);

	const [newLocation, setNewLocation] = useState<{
		lat: number;
		lng: number;
	} | null>({lat: center[0], lng: center[1]});

	const tempMarkerRef = useRef(null);

	function vehicleSubmit(lat: number, lng: number) {
		var postData = {
			condition: "USED",
			details: {
				body: "sedan",
				model: "Impala",
				manufacturer: {
					code: 101,
					name: "Chevrolet"
				},
				numberOfDoors: 4,
				fuelType: "Gasoline",
				engine: "3.6L V6",
				mileage: 32280,
				modelYear: 2018,
				productionYear: 2018,
				externalColor: "white"
			},
			location: {
				lat: lat,
				lon: lng
			}
		};

		let axiosConfig = {
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
				'Authorization': userToken
			}
		};
		console.log("axiosConfig: ", axiosConfig);
		//setName(JSON.stringify(postData));
		axios.post('http://localhost:80/vehicles/cars', postData, axiosConfig)
			.then((response) => {
				console.log("RESPONSE RECEIVED: ", response.data);
			})
			.catch((error) => {
				console.log("AXIOS ERROR: ", postData);
				if (error.code === 'ERR_NETWORK') {
				}
			})


	};

	function getVehicles() {

		let axiosConfig = {
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
				'Authorization': userToken
			}
		};

		axios.get('http://localhost:80/vehicles/cars', axiosConfig)
			.then((response) => {
				// for each element received, put up a marker
				response.data.forEach(function (option) {
					setMarkers((current) => [
						...current,
						{
							lat: Number(option.location.lat),
							lng: Number(option.location.lon),
							time: new Date(),
							comment: "vehicle-api fetch",
							id: option.id,
						},
					])
				});
			})
			.catch((error) => {
				console.log("AXIOS ERROR: ", axiosConfig);
				//setName(error.response);
				if (error.code === 'ERR_NETWORK') {
					//setMapFeedback('API ERROR')
				}
			})

	};

	function deleteVehicle(vehicleId: string) {
		let axiosConfig = {
			headers: {
				'Content-Type': 'application/json;charset=UTF-8',
				'Authorization': userToken
			}
		};

		axios.delete('http://localhost:80/vehicles/cars/' + vehicleId, axiosConfig)
			.then((response) => {
				//setMapFeedback('OK')
				console.log("response delete: ", response.status);
			})
			.catch((error) => {
				console.log("AXIOS ERROR: ", axiosConfig);
				//setName(error.response);
				if (error.code === 'ERR_NETWORK') {
					//setMapFeedback('API ERROR')
				}
			})
	};

	const handleMapClick = (e) => {
		const comment = ''//prompt("Enter a comment for this location:", "");

		setNewLocation(e.latlng);

		const tempMarker = tempMarkerRef.current;
		if (tempMarker) {
			(tempMarker as any).openPopup();
		}

/*		if (comment == '') {
			return null;
		}
		const newMarker = {
			lat: e.latlng.lat,
			lng: e.latlng.lng,
			//iconKey: selectedIcon, // Save the key of the selected icon
			comment: comment || "No comment provided"
		};
		setMarkers([...markers, newMarker]);
		vehicleSubmit(newMarker.lat, newMarker.lng)*/
		console.log('newMarker', markers)

		/*		if (userId) {
                    saveUserData(userId, { markers: [...markers, newMarker], mapState });
                }*/
	};

	const handleRemoveMarker = (markerIndex, vehicleId) => {
		deleteVehicle(vehicleId)
		const updatedMarkers = markers.filter((_, index) => index !== markerIndex);
		setMarkers(updatedMarkers);
	};



	const MapEvents = ({ onMapClick, onMapMove, onMapZoom }) => {
		useMapEvents({
			click: onMapClick,
			moveend: onMapMove,
			zoomend: onMapZoom
		});
		return null;
	};


	// @ts-ignore
	return (
		<>
			<MapContainer
				center={[59.328246, 18.053383]}
				zoom={15}
				// touchZoom={true}
				scrollWheelZoom={true}
				style={{ height: "90vh", width: "100%" }}
				/*ref={mapRef}*/
/*				ref={async (map) => {
					if(map) {
						setMapReference(map);
					}
				}}*/
			>
				<MapEvents
					onMapClick={handleMapClick} onMapMove={undefined} onMapZoom={undefined}
				/>

				<LayersControl position="topright">
					<LayersControl.BaseLayer checked name="OpenStreetMap">
						<TileLayer
							attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
							url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
						/>
					</LayersControl.BaseLayer>
					<LayersControl.BaseLayer name="WaterColor">
						<TileLayer
							attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
							url="https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg"
						/>
					</LayersControl.BaseLayer>
					<LayersControl.BaseLayer name="GoogleSateliteHybrid">
						<TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
					</LayersControl.BaseLayer>
					<LayersControl.BaseLayer name="Google Maps">
						<TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
					</LayersControl.BaseLayer>
					<LayersControl.BaseLayer name="Esri World Street Map">
						<TileLayer
							url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
							minZoom={0}
							maxZoom={20}
						/>
					</LayersControl.BaseLayer>
					<LayersControl.Overlay name="Sweden counties">
						<GeoJSON style={{ color: "red" }} data={SwedenMapData as any} />
					</LayersControl.Overlay>
					<LayersControl.Overlay name="Sweden muncipalities">
						<GeoJSON style={{ color: "blue" }} data={SwedenMuncipalityMapData as any} />
					</LayersControl.Overlay>
					<LayersControl.Overlay name="World">
						<GeoJSON style={{ color: "green" }} data={WorldMapData as any} />
					</LayersControl.Overlay>

					<FeatureGroup><MarkerClusterGroup>
{/*						{(addressPoints as AdressPoint).map((address, index) => (
							<Marker key={index} position={[address[0], address[1]]} title={address[2]} icon={icon4} ></Marker>
						))}*/}
						{(newLocation && newLocation.lat != center[0] && newLocation.lng != center[1]) && (
							<Marker
								ref={tempMarkerRef}
								position={[newLocation.lat, newLocation.lng]}
								icon={icon3}
							>
								<Popup className="temppopup">
									<div className="markercomment"> Are you sure you want to pin?</div>
									<br />
									<button className="submitbutton" onClick={(e) => {
										e.stopPropagation(); // Prevent triggering map click

										const newMarker = {
											lat: newLocation.lat,
											lng: newLocation.lng,
											//iconKey: selectedIcon, // Save the key of the selected icon
											time: new Date(),
											comment: "No comment provided",
											id: ''
										};
										setMarkers([...markers, newMarker]);
										vehicleSubmit(newLocation.lat, newLocation.lng);
										setNewLocation({lat: center[0], lng: center[1]})

									}}>📌 Pin this location!
									</button>
								</Popup>
							</Marker>
						)}
						{markers.map((marker, idx) => (
							<Marker key={`${marker.lat}-${marker.lng}`} position={{lat: marker.lat, lng: marker.lng}} icon={icon5}>
								<Popup className="markerpopup">
									<div className="markercomment">{marker.comment}</div>
									<br />
									<button className="clearbutton" onClick={(e) => {
										e.stopPropagation(); // Prevent triggering map click
										handleRemoveMarker(idx, marker.id);
									}}>Remove
									</button>
								</Popup>
							</Marker>
						))}
					</MarkerClusterGroup>
					</FeatureGroup>
				</LayersControl>
			</MapContainer>
		</>
	);
}