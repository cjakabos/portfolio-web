"use client";
import React, { useState } from 'react';
import { MapPin, Plus, Trash2, Edit, X, CarFront } from 'lucide-react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    LayersControl,
    useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import Hook (assuming this is safe)
import { useVehicleMap, Vehicle } from '../../hooks/useVehiclesMap';

// Create icon outside component to avoid recreation on each render
const iconCar = L.icon({
    iconUrl: 'http://localhost:5002/icons/voyager.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// Helper component for map clicks
const MapClickEvent = ({ onClick }: { onClick: (e: any) => void }) => {
    useMapEvents({ click: onClick });
    return null;
};

export default function CloudMaps() {
    const {
        vehicles,
        center,
        showModal,
        setShowModal,
        formMode,
        formData,
        setFormData,
        handleFormSubmit,
        handleMapClick,
        deleteVehicle,
        openCreate,
        openEdit
    } = useVehicleMap();

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col lg:flex-row gap-6 p-4">

            {/* --- LEFT: Sidebar / List --- */}
            <div className="w-full lg:w-1/3 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <h2 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                        <CarFront className="text-blue-600" /> Fleet Manager
                    </h2>
                    <button onClick={openCreate} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
                        <Plus size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {vehicles.length === 0 && (
                        <p className="text-center text-gray-500 mt-10">No vehicles found. Click + or the map to add one.</p>
                    )}
                    {vehicles.map(v => (
                        <div key={v.id} className="group p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">
                                        {v.details.manufacturer.name} {v.details.model}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${v.condition === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {v.condition}
                                        </span>
                                        <span className="text-xs text-gray-500 capitalize">{v.details.externalColor}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(v)} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => deleteVehicle(v.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-1 font-mono bg-gray-50 dark:bg-gray-900/50 p-1 rounded w-fit">
                                <MapPin size={12} /> {v.location.lat.toFixed(4)}, {v.location.lon.toFixed(4)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- RIGHT: Map Visualizer --- */}
            <div className="flex-1 bg-gray-100 rounded-xl relative overflow-hidden shadow-inner border border-gray-300 dark:border-gray-700 z-0">
                <MapContainer
                    center={center}
                    zoom={11}
                    scrollWheelZoom={true}
                    style={{ height: "100%", width: "100%" }}
                >
                    <MapClickEvent onClick={handleMapClick} />

                    <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="CartoDB Voyager">
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="OpenStreetMap">
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        </LayersControl.BaseLayer>
                    </LayersControl>

                    {/* Markers */}
                    {vehicles.map((v) => (
                        <Marker
                            key={v.id}
                            position={[v.location.lat, v.location.lon]}
                            icon={iconCar}
                        >
                            <Popup className="rounded-lg shadow-xl border-none">
                                <div className="p-1">
                                    <strong className="block text-sm mb-1">{v.details.manufacturer.name}</strong>
                                    <span className="text-xs text-gray-600">{v.details.model}</span>
                                    <div className="mt-2 flex gap-2">
                                        <button onClick={() => deleteVehicle(v.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                                        <button onClick={() => openEdit(v)} className="text-xs text-blue-600 hover:underline">Edit</button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* Floating Map Hint */}
                <div className="absolute top-4 left-14 bg-white/90 dark:bg-black/70 backdrop-blur px-3 py-1 rounded-md shadow text-xs font-medium z-[400] pointer-events-none">
                    Click anywhere on map to add vehicle
                </div>
            </div>

            {/* --- MODAL --- */}
            {showModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-2xl transform transition-all">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white">{formMode === 'CREATE' ? 'Add Vehicle' : 'Edit Vehicle'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Manufacturer</label>
                                    <input className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                           placeholder="e.g. Volvo"
                                           value={formData.manufacturer}
                                           onChange={e => setFormData({...formData, manufacturer: e.target.value})}
                                           required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Model</label>
                                    <input className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                           placeholder="e.g. V60"
                                           value={formData.model}
                                           onChange={e => setFormData({...formData, model: e.target.value})}
                                           required />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Color</label>
                                    <input className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                           placeholder="e.g. Silver"
                                           value={formData.color}
                                           onChange={e => setFormData({...formData, color: e.target.value})}
                                           required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Condition</label>
                                    <select className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.condition}
                                            onChange={e => setFormData({...formData, condition: e.target.value})}>
                                        <option value="NEW">New</option>
                                        <option value="USED">Used</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Location (Lat / Lon)</label>
                                <div className="flex gap-2">
                                    <input type="number" step="0.000001" className="w-full p-2 border rounded-lg bg-gray-100 text-gray-600 font-mono text-sm"
                                           value={formData.lat}
                                           onChange={e => setFormData({...formData, lat: Number(e.target.value)})}
                                           required />
                                    <input type="number" step="0.000001" className="w-full p-2 border rounded-lg bg-gray-100 text-gray-600 font-mono text-sm"
                                           value={formData.lon}
                                           onChange={e => setFormData({...formData, lon: Number(e.target.value)})}
                                           required />
                                </div>
                            </div>

                            <button className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-600/30 transition-all mt-2">
                                {formMode === 'CREATE' ? 'Create Vehicle' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}