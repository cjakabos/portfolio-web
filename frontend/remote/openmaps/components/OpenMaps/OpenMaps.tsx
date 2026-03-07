"use client";
import React from 'react';
import { ChevronDown, ChevronUp, Map as MapIcon, MapPin, Plus, Trash2, Edit, X, CarFront } from 'lucide-react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    LayersControl,
    useMap,
    useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useVehicleMap } from '../../hooks/useVehiclesMap';
import type { VehicleFormData } from '../../hooks/useVehiclesMap';

type NumericFieldKey = 'numberOfDoors' | 'mileage' | 'modelYear' | 'productionYear' | 'lat' | 'lon';
const toNumericDrafts = (data: VehicleFormData): Record<NumericFieldKey, string> => ({
    numberOfDoors: String(data.numberOfDoors),
    mileage: String(data.mileage),
    modelYear: String(data.modelYear),
    productionYear: String(data.productionYear),
    lat: String(data.lat),
    lon: String(data.lon)
});

// Resolve icon URL: use the remote's origin when mounted in the shell, fall back to relative path for standalone
const OPENMAPS_BASE = process.env.NEXT_PUBLIC_REMOTE_OPENMAPS_URL || '';
const iconCar = L.icon({
    iconUrl: `${OPENMAPS_BASE}/icons/voyager.png`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// Helper component for map clicks
const MapClickEvent = ({ onClick }: { onClick: (e: any) => void }) => {
    useMapEvents({ click: onClick });
    return null;
};

const MapResizeSync = ({
    resizeKey,
    onResize
}: {
    resizeKey: string;
    onResize: (map: L.Map | null) => void;
}) => {
    const map = useMap();

    React.useEffect(() => {
        onResize(map);
    }, [map, onResize, resizeKey]);

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
        manufacturers,
        bodyOptions,
        fuelTypeOptions,
        submitting,
        formError,
        handleFormSubmit,
        handleMapClick,
        deleteVehicle,
        openCreate,
        openEdit
    } = useVehicleMap();

    const inputClassName = "w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none";
    const labelClassName = "text-xs font-semibold text-gray-500 uppercase";
    const coordInputClassName = "w-full p-2 border rounded-lg bg-gray-100 text-gray-700 font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100";
    const panelHeaderClassName = "p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-900";
    const panelTitleClassName = "min-w-0 flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white";
    const panelActionButtonClassName = "shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 shadow-sm";
    const [numericDrafts, setNumericDrafts] = React.useState<Record<NumericFieldKey, string>>(toNumericDrafts(formData));
    const [mobilePanel, setMobilePanel] = React.useState<'fleet' | 'map'>('map');
    const [isDesktopViewport, setIsDesktopViewport] = React.useState(true);
    const desktopMapRef = React.useRef<L.Map | null>(null);
    const mobileMapRef = React.useRef<L.Map | null>(null);
    const fleetExpanded = mobilePanel === 'fleet';
    const mapExpanded = mobilePanel === 'map';

    const scheduleMapResize = React.useCallback((map: L.Map | null) => {
        if (!map) {
            return;
        }

        window.requestAnimationFrame(() => {
            map.invalidateSize();
            window.requestAnimationFrame(() => {
                map.invalidateSize();
            });
        });

        window.setTimeout(() => {
            map.invalidateSize();
        }, 250);
    }, []);

    React.useEffect(() => {
        if (showModal) {
            setNumericDrafts(toNumericDrafts(formData));
        }
    }, [showModal, formData]);

    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);

        syncViewport();
        mediaQuery.addEventListener('change', syncViewport);

        return () => {
            mediaQuery.removeEventListener('change', syncViewport);
        };
    }, []);

    React.useEffect(() => {
        if (!mapExpanded || isDesktopViewport) {
            return;
        }

        const timer = window.setTimeout(() => {
            scheduleMapResize(mobileMapRef.current);
        }, 150);

        return () => window.clearTimeout(timer);
    }, [isDesktopViewport, mapExpanded, scheduleMapResize]);

    React.useEffect(() => {
        if (!isDesktopViewport) {
            return;
        }

        const timer = window.setTimeout(() => {
            scheduleMapResize(desktopMapRef.current);
        }, 150);

        return () => window.clearTimeout(timer);
    }, [isDesktopViewport, scheduleMapResize, vehicles]);

    const updateField = <K extends keyof VehicleFormData,>(key: K, value: VehicleFormData[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const updateNumberField = (key: NumericFieldKey, value: string) => {
        setNumericDrafts(prev => ({ ...prev, [key]: value }));

        if (!value.trim()) {
            return;
        }

        // Accept both dot/comma while typing and only sync valid numeric values to form state.
        const parsed = Number(value.replace(',', '.'));
        if (Number.isFinite(parsed)) {
            updateField(key, parsed as VehicleFormData[typeof key]);
        }
    };

    const restoreNumberDraftFromState = (key: NumericFieldKey) => {
        setNumericDrafts(prev => ({ ...prev, [key]: String(formData[key]) }));
    };

    const bodySelectOptions = bodyOptions.includes(formData.body as (typeof bodyOptions)[number])
        ? bodyOptions
        : [formData.body, ...bodyOptions];

    const fuelTypeSelectOptions = fuelTypeOptions.includes(formData.fuelType as (typeof fuelTypeOptions)[number])
        ? fuelTypeOptions
        : [formData.fuelType, ...fuelTypeOptions];

    const renderFleetList = () => (
        <>
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
        </>
    );

    const renderMapSurface = (mapRef: React.RefObject<L.Map | null>, hintOffsetClassName: string, resizeKey: string) => (
        <div className="relative flex-1 min-h-0">
            <MapContainer
                ref={mapRef}
                center={center}
                zoom={11}
                scrollWheelZoom={true}
                whenReady={() => scheduleMapResize(mapRef.current)}
                style={{ height: "100%", width: "100%" }}
                className="h-full min-h-[22rem] lg:min-h-0"
            >
                <MapResizeSync resizeKey={resizeKey} onResize={scheduleMapResize} />
                <MapClickEvent onClick={handleMapClick} />

                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="CartoDB Voyager">
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="OpenStreetMap">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    </LayersControl.BaseLayer>
                </LayersControl>

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

            <div className={`absolute ${hintOffsetClassName} bg-white/90 dark:bg-black/70 backdrop-blur px-3 py-1 rounded-md shadow text-xs font-medium z-[400] pointer-events-none`}>
                Click anywhere on map to add vehicle
            </div>
        </div>
    );

    const modalViewportStyle = {
        paddingTop: isDesktopViewport
            ? 'max(5rem, env(safe-area-inset-top))'
            : 'max(7rem, calc(env(safe-area-inset-top) + 1rem))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
    };

    return (
        <div className="relative isolate h-full min-h-0 p-4">
            {isDesktopViewport ? (
                <div className="flex h-full min-h-0 flex-row gap-4 xl:gap-6">
                    <div className="w-[26rem] shrink-0 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden xl:w-[28rem]">
                        <div className={panelHeaderClassName}>
                            <div className={panelTitleClassName}>
                                <CarFront className="h-5 w-5 text-blue-600" />
                                <span className="truncate">Fleet Manager</span>
                            </div>
                            <button type="button" onClick={openCreate} className={`ml-2 ${panelActionButtonClassName}`} aria-label="Add vehicle" title="Add vehicle">
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                            {renderFleetList()}
                        </div>
                    </div>

                    <div className="min-w-0 flex-1 min-h-0 flex flex-col bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-300 dark:border-gray-700">
                        <div className={panelHeaderClassName}>
                            <div className={panelTitleClassName}>
                                <MapIcon className="h-5 w-5 text-blue-600" />
                                <span className="truncate">Map View</span>
                            </div>
                            <button type="button" onClick={openCreate} className={`ml-2 ${panelActionButtonClassName}`} aria-label="Add vehicle" title="Add vehicle">
                                <Plus size={20} />
                            </button>
                        </div>
                        {showModal ? (
                            <div className="flex-1 min-h-0 bg-gray-100 dark:bg-gray-900" />
                        ) : (
                            renderMapSurface(desktopMapRef, 'left-4 top-4', `desktop-${vehicles.length}`)
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex h-full min-h-0 flex-col gap-3">
                    <div className={`w-full flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0 ${fleetExpanded ? 'flex-1' : 'shrink-0'}`}>
                        <div className={panelHeaderClassName}>
                            <button
                                type="button"
                                onClick={() => setMobilePanel(current => current === 'fleet' ? 'map' : 'fleet')}
                                className="flex flex-1 items-center justify-between text-left"
                            >
                                <span className={panelTitleClassName}>
                                    <CarFront className="h-5 w-5 text-blue-600" />
                                    <span className="truncate">Fleet Manager</span>
                                </span>
                                <span className="text-gray-400">
                                    {fleetExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </span>
                            </button>
                            <button type="button" onClick={openCreate} className={`ml-3 ${panelActionButtonClassName}`} aria-label="Add vehicle" title="Add vehicle">
                                <Plus size={20} />
                            </button>
                        </div>
                        {fleetExpanded && (
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                                {renderFleetList()}
                            </div>
                        )}
                    </div>

                    <div className={`w-full flex flex-col bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-300 dark:border-gray-700 ${mapExpanded ? 'flex-1' : 'shrink-0'}`}>
                        <div className={panelHeaderClassName}>
                            <button
                                type="button"
                                onClick={() => setMobilePanel(current => current === 'map' ? 'fleet' : 'map')}
                                className="flex flex-1 items-center justify-between text-left"
                            >
                                <span className={panelTitleClassName}>
                                    <MapIcon className="h-5 w-5 text-blue-600" />
                                    <span className="truncate">Map View</span>
                                </span>
                                <span className="text-gray-400">
                                    {mapExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </span>
                            </button>
                            <button type="button" onClick={openCreate} className={`ml-3 ${panelActionButtonClassName}`} aria-label="Add vehicle" title="Add vehicle">
                                <Plus size={20} />
                            </button>
                        </div>
                        {mapExpanded && (
                            showModal ? (
                                <div className="flex-1 min-h-[22rem] bg-gray-100 dark:bg-gray-900" />
                            ) : (
                                renderMapSurface(mobileMapRef, 'left-4 top-4', `mobile-${vehicles.length}-${mapExpanded ? 'open' : 'closed'}`)
                            )
                        )}
                    </div>
                </div>
            )}

            {/* --- MODAL --- */}
            {showModal && (
                <div className="fixed inset-0 z-[5000]">
                    <div
                        className="absolute inset-0 z-0 bg-black/60"
                        onClick={() => setShowModal(false)}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute inset-0 z-10 flex items-stretch justify-center overflow-hidden p-2 sm:p-4"
                        style={modalViewportStyle}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label={formMode === 'CREATE' ? 'Add Vehicle' : 'Edit Vehicle'}
                            className="relative z-20 flex h-full w-full max-w-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
                            style={{ height: '100%' }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 shrink-0 border-b border-gray-100 p-5 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {formMode === 'CREATE' ? 'Add Vehicle' : 'Edit Vehicle'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="flex flex-1 min-h-0 flex-col">
                                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                                    {formError && (
                                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900">
                                            {formError}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Manufacturer</label>
                                            <select
                                                className={inputClassName}
                                                value={formData.manufacturerCode}
                                                onChange={e => updateField('manufacturerCode', Number(e.target.value))}
                                                required
                                            >
                                                {manufacturers.map(manufacturer => (
                                                    <option key={manufacturer.code} value={manufacturer.code}>
                                                        {manufacturer.name} ({manufacturer.code})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Model</label>
                                            <input
                                                className={inputClassName}
                                                placeholder="e.g. Impala"
                                                value={formData.model}
                                                onChange={e => updateField('model', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Condition</label>
                                            <select
                                                className={inputClassName}
                                                value={formData.condition}
                                                onChange={e => updateField('condition', e.target.value as VehicleFormData['condition'])}
                                            >
                                                <option value="NEW">New</option>
                                                <option value="USED">Used</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Body</label>
                                            <select
                                                className={inputClassName}
                                                value={formData.body}
                                                onChange={e => updateField('body', e.target.value)}
                                                required
                                            >
                                                {bodySelectOptions.map(body => (
                                                    <option key={body} value={body}>
                                                        {body.charAt(0).toUpperCase() + body.slice(1)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Exterior Color</label>
                                            <input
                                                className={inputClassName}
                                                placeholder="e.g. White"
                                                value={formData.color}
                                                onChange={e => updateField('color', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Fuel Type</label>
                                            <select
                                                className={inputClassName}
                                                value={formData.fuelType}
                                                onChange={e => updateField('fuelType', e.target.value)}
                                                required
                                            >
                                                {fuelTypeSelectOptions.map(fuelType => (
                                                    <option key={fuelType} value={fuelType}>{fuelType}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1 md:col-span-1">
                                            <label className={labelClassName}>Engine</label>
                                            <input
                                                className={inputClassName}
                                                placeholder="e.g. 3.6L V6"
                                                value={formData.engine}
                                                onChange={e => updateField('engine', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Doors</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={8}
                                                step={1}
                                                className={inputClassName}
                                                value={numericDrafts.numberOfDoors}
                                                onChange={e => updateNumberField('numberOfDoors', e.target.value)}
                                                onBlur={() => restoreNumberDraftFromState('numberOfDoors')}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Mileage</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={2000000}
                                                step={1}
                                                className={inputClassName}
                                                value={numericDrafts.mileage}
                                                onChange={e => updateNumberField('mileage', e.target.value)}
                                                onBlur={() => restoreNumberDraftFromState('mileage')}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Model Year</label>
                                            <input
                                                type="number"
                                                min={1886}
                                                max={2100}
                                                step={1}
                                                className={inputClassName}
                                                value={numericDrafts.modelYear}
                                                onChange={e => updateNumberField('modelYear', e.target.value)}
                                                onBlur={() => restoreNumberDraftFromState('modelYear')}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={labelClassName}>Production Year</label>
                                            <input
                                                type="number"
                                                min={1886}
                                                max={2100}
                                                step={1}
                                                className={inputClassName}
                                                value={numericDrafts.productionYear}
                                                onChange={e => updateNumberField('productionYear', e.target.value)}
                                                onBlur={() => restoreNumberDraftFromState('productionYear')}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-1">
                                        <label className={`${labelClassName} block mb-1`}>Location (Lat / Lon)</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="number"
                                                min={-90}
                                                max={90}
                                                step="0.000001"
                                                className={coordInputClassName}
                                                value={numericDrafts.lat}
                                                onChange={e => updateNumberField('lat', e.target.value)}
                                                onBlur={() => restoreNumberDraftFromState('lat')}
                                                required
                                            />
                                            <input
                                                type="number"
                                                min={-180}
                                                max={180}
                                                step="0.000001"
                                                className={coordInputClassName}
                                                value={numericDrafts.lon}
                                                onChange={e => updateNumberField('lon', e.target.value)}
                                                onBlur={() => restoreNumberDraftFromState('lon')}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="sticky bottom-0 z-10 shrink-0 border-t border-gray-100 p-4 dark:border-gray-700 bg-white dark:bg-gray-800"
                                    style={{
                                        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
                                    }}
                                >
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className={`w-full text-white py-2.5 rounded-lg font-medium shadow-lg transition-all ${
                                            submitting
                                                ? 'bg-blue-400 shadow-blue-400/20 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                                        }`}
                                    >
                                        {submitting
                                            ? (formMode === 'CREATE' ? 'Creating Vehicle...' : 'Saving Changes...')
                                            : (formMode === 'CREATE' ? 'Create Vehicle' : 'Save Changes')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
