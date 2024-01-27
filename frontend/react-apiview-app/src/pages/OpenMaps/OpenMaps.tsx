"use client";
import React, {useEffect, useMemo, useState} from "react";
import {
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	GeoJSON,
	useMap,
	LayersControl,
	useMapEvent,
	Rectangle,
} from 'react-leaflet';
import L, { Icon, LatLng, LeafletMouseEvent } from 'leaflet'
import { addressPoints } from './realworld'
import 'leaflet/dist/leaflet.css'
import MarkerClusterGroup from "react-leaflet-cluster";
import {iconCultual, iconFood, iconTourism, iconSport} from "@/pages/OpenMaps/Icons";
import { GeometryCollection, Topology } from "topojson-specification";
type AdressPoint = Array<[number, number, string]>
import SwedenMapData from '../../../public/svenska-landskap.geo.json';
import SwedenMuncipalityMapData from '../../../public/svenska-kommun.geo.json';
import WorldMapData from '../../../public/world.geo.json';

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

			popup
				.setLatLng(e.latlng)
				.setContent(`
                You clicked the map at ${cords.toString()}
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


	return (
		<div>
			<MapContainer
				center={[59.328246, 18.053383]}
				zoom={15}
				// touchZoom={true}
				scrollWheelZoom={true}
				style={{ height: "1000px", width: "100%" }}
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