"use client";
import React, {useMemo, useState} from "react";
import { MapContainer, Marker, TileLayer, LayersControl } from 'react-leaflet'
import L, { Icon, LatLng, LeafletMouseEvent } from 'leaflet'
import { addressPoints } from './realworld'
import 'leaflet/dist/leaflet.css'
import MarkerClusterGroup from "react-leaflet-cluster";
import {iconCultual, iconFood, iconTourism, iconSport} from "@/pages/OpenMaps/Icons";
type AdressPoint = Array<[number, number, string]>

export default function OpenMaps() {

	function getXyCoords(latLngString: string): string[] {
		try {
			const match = latLngString.match(/\(([^)]+)\)/);

			if(match) {
				return match[1].split(',');
			} else {
				return [];
			}
		} catch (error) {
			console.log(error, 'red');
		}
	}

	const setMapReference = (map: L.Map) => {
		if (!map) {
			console.log('Map not ready yet...', 'yellow');

			return;
		}

		// Set the map bounds to the map size
		//myMarkers.addTo(map);
		//setMyMarkers(myMarkers);

		// Getting map co-ordinates on click
		const popup = L.popup();

		function onMapClick(e: { latlng: L.LatLngExpression }) {
			const cords = getXyCoords(e.latlng.toString());
			const roundedCoords: number[] = [];

			cords.forEach(element => {
				const roundedCoord = Math.round(parseInt(element, 10));

				roundedCoords.push(roundedCoord);
			});

			popup
				.setLatLng(e.latlng)
				.setContent(`
                You clicked the map at ${roundedCoords.toString()}
                `)
				.openOn(map);
		}
		map.on('click', onMapClick);
	};


	const icon1 = useMemo(() => {
		const icon: Icon = iconFood
		return icon
	}, [])
	const icon2 = useMemo(() => {
		const icon: Icon = iconCultual
		return icon
	}, [])
	const icon3 = useMemo(() => {
		const icon: Icon = iconTourism
		return icon
	}, [])
	const icon4 = useMemo(() => {
		const icon: Icon = iconSport
		return icon
	}, [])
	const [center, setCenter] = useState<any>([59.328246, 18.053383]);
	const [bounds, setBounds] = useState<any>([
		[center[0]-0.25, center[1]-0.15],
		[center[0]+0.25, center[1]+0.15],
	]);

	console.log(center)
	console.log(bounds)

	return (
		<div>
			<MapContainer
				center={[59.328246, 18.053383]}
				zoom={15}
				// touchZoom={true}
				scrollWheelZoom={true}
				style={{ height: "1000px", width: "100%" }}
				maxBounds={bounds}
				minZoom={12}
				maxZoom={16}
				fullscreenControl={true}
				ref={async (map) => {
					if(map) {
						setMapReference(map);
					}
				}}
			>
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
					<LayersControl.BaseLayer name="Landscape">
						<TileLayer
							attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
							url="https://tile.thunderforest.com/landscape/{z}/{x}/{y}.png"
						/>
					</LayersControl.BaseLayer>

					<MarkerClusterGroup chunkedLoading>
						{(addressPoints as AdressPoint).map((address, index) => (
							<Marker key={index} position={[address[0], address[1]]} title={address[2]} icon={icon4} ></Marker>
						))}
					</MarkerClusterGroup>
				</LayersControl>
			</MapContainer>
		</div>
	);
}