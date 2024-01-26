"use client";
import React, {useMemo, useState} from "react";
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { Icon, LatLng, LeafletMouseEvent } from 'leaflet'
import { addressPoints } from './realworld'
import 'leaflet/dist/leaflet.css'
import MarkerClusterGroup from "react-leaflet-cluster";
import {iconCultual, iconFood, iconTourism, iconSport} from "@/pages/OpenMaps/Icons";
type AdressPoint = Array<[number, number, string]>

export default function OpenMaps() {
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



	return (
		<div>
			<MapContainer
				center={[59.328246, 18.053383]}
				zoom={15}
				scrollWheelZoom={true}
				style={{ height: "1000px", width: "100%" }}
			>
				<TileLayer
					attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>
				<MarkerClusterGroup chunkedLoading>
					{(addressPoints as AdressPoint).map((address, index) => (
						<Marker key={index} position={[address[0], address[1]]} title={address[2]} icon={icon4} ></Marker>
					))}
				</MarkerClusterGroup>
			</MapContainer>
		</div>
	);
}