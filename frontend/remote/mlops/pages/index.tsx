'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Brain, Database, Activity, ChevronLeft, ChevronRight, BarChart2, CircleDot, LayoutGrid } from 'lucide-react';
import {
    ScatterChart,
    Scatter as RechartsScatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    AreaChart,
    Area
} from 'recharts';
import { useCustomerSegmentation } from '../hooks/useCustomerSegmentation';

// Default segment colors
const SEGMENT_COLORS: Record<number, string> = {
    0: "#3b82f6",  // Blue
    1: "#10b981",  // Emerald/Green
    2: "#8b5cf6",  // Purple/Violet
    3: "#f59e0b",  // Amber/Orange
    4: "#ec4899"   // Pink/Rose
};

// Gender colors matching seaborn YlGnBu palette
const GENDER_COLORS = {
    Male: "#225ea8",    // Blue from YlGnBu
    Female: "#7fcdbb"   // Teal/Green from YlGnBu
};

type VisualizationTab = 'clusters' | 'histogram' | 'pairplot';

// --- PERFORMANCE OPTIMIZATION: Moved pure functions outside component ---

// Simple KDE approximation for smooth distribution curves
const calculateKDE = (values: number[], displayMin: number, displayMax: number, bandwidth: number, points: number = 100): Array<{ x: number, y: number }> => {
    if (values.length === 0) return Array(points).fill(0).map((_, i) => ({
        x: displayMin + (i / (points - 1)) * (displayMax - displayMin),
        y: 0
    }));

    const result: Array<{ x: number, y: number }> = [];

    for (let i = 0; i < points; i++) {
        const x = displayMin + (i / (points - 1)) * (displayMax - displayMin);
        let density = 0;

        // Inner loop runs N times for every point (N^2 complexity)
        values.forEach(v => {
            const z = (x - v) / bandwidth;
            density += Math.exp(-0.5 * z * z);
        });

        // Normalize
        density /= (values.length * bandwidth * Math.sqrt(2 * Math.PI));
        result.push({ x, y: density });
    }

    return result;
};

// Calculate bandwidth
const calculateBandwidth = (values: number[]): number => {
    if (values.length < 2) return 1;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

    // Smaller bandwidth to show multiple peaks (similar to seaborn default)
    const bandwidth = 1.06 * std * Math.pow(values.length, -0.2);

    return bandwidth > 0 ? bandwidth : 1;
};


export default function CloudMLOps() {
    const {
        customers,
        mlData,
        loading,
        formValues,
        selectedGender,
        sampleSize,
        handleInputChange,
        handleGenderChange,
        handleSubmit,
        handleSampleClick
    } = useCustomerSegmentation();

    // --- State for Features ---
    const [activeVizTab, setActiveVizTab] = useState<VisualizationTab>('clusters');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Reset to page 1 when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [customers.length]);

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCustomers = customers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(customers.length / itemsPerPage);

    const handlePageChange = (direction: 'next' | 'prev') => {
        if (direction === 'next' && currentPage < totalPages) {
            setCurrentPage(prev => prev + 1);
        } else if (direction === 'prev' && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };

    // Get segment color from metadata or default
    const getSegmentColor = (segmentId: number): string => {
        if (mlData?.segment_metadata?.[segmentId]?.color) {
            return mlData.segment_metadata[segmentId].color;
        }
        return SEGMENT_COLORS[segmentId] || "#808080";
    };

    // Prepare histogram data
    const histogramData = useMemo(() => {
        if (!mlData?.spending_histogram?.data || mlData.spending_histogram.data.length === 0) return [];

        const values = mlData.spending_histogram.data;
        const bins = mlData.spending_histogram.bins || 10;
        const min = Math.min(...values);
        const max = Math.max(...values);

        if (min === max) {
            return [{
                range: `${Math.round(min)}`,
                count: values.length
            }];
        }

        const binWidth = (max - min) / bins;

        const histogram = Array(bins).fill(0).map((_, i) => ({
            range: `${Math.round(min + i * binWidth)}-${Math.round(min + (i + 1) * binWidth)}`,
            count: 0
        }));

        values.forEach((val: number) => {
            const binIndex = Math.min(Math.max(0, Math.floor((val - min) / binWidth)), bins - 1);
            if (histogram[binIndex]) {
                histogram[binIndex].count++;
            }
        });

        return histogram;
    }, [mlData?.spending_histogram]);

    // Prepare cluster scatter data grouped by segment
    const clusterData = useMemo(() => {
        if (!mlData?.cluster_scatter?.pca_component_1) return {};

        const { pca_component_1, pca_component_2, segment, customer_id } = mlData.cluster_scatter;

        const segmentGroups: Record<number, Array<{ x: number; y: number; customerId: number; segment: number }>> = {};
        for (let i = 0; i < pca_component_1.length; i++) {
            const seg = segment[i];
            if (!segmentGroups[seg]) {
                segmentGroups[seg] = [];
            }
            segmentGroups[seg].push({
                x: pca_component_1[i],
                y: pca_component_2[i],
                customerId: customer_id[i],
                segment: seg
            });
        }

        return segmentGroups;
    }, [mlData?.cluster_scatter]);

    // Prepare pairplot data
    const pairplotData = useMemo(() => {
        if (!mlData?.pairplot_data?.age) return [];

        const { age, annual_income, spending_score, gender } = mlData.pairplot_data;
        return age.map((_: number, i: number) => ({
            age: age[i],
            annual_income: annual_income[i],
            spending_score: spending_score[i],
            gender: gender[i]
        }));
    }, [mlData?.pairplot_data]);

    // --- PERFORMANCE FIX: Pre-calculate KDEs inside useMemo ---
    // This prevents the O(N^2) calculation from running on every render/hover
    const kdeMetrics = useMemo(() => {
        if (!pairplotData || pairplotData.length === 0) return {};

        const variables = ['age', 'annual_income', 'spending_score'];
        const results: Record<string, any> = {};

        variables.forEach(key => {
            const allValues = pairplotData.map((d: any) => d[key]);
            if (allValues.length === 0) return;

            const maleValues = pairplotData.filter((d: any) => d.gender === 'Male').map((d: any) => d[key]);
            const femaleValues = pairplotData.filter((d: any) => d.gender === 'Female').map((d: any) => d[key]);

            const dataMin = Math.min(...allValues);
            const dataMax = Math.max(...allValues);

            // Handle edge case where all values are the same
            if (dataMin === dataMax) {
                results[key] = { isSingle: true, value: dataMin };
                return;
            }

            // Extend range beyond data for full distribution curve
            const range = dataMax - dataMin;
            const extendedMin = dataMin - range * 0.5;
            const extendedMax = dataMax + range * 0.5;

            // Calculate bandwidth
            const maleBandwidth = calculateBandwidth(maleValues);
            const femaleBandwidth = calculateBandwidth(femaleValues);

            // Calculate KDEs
            const maleKDE = calculateKDE(maleValues, extendedMin, extendedMax, maleBandwidth);
            const femaleKDE = calculateKDE(femaleValues, extendedMin, extendedMax, femaleBandwidth);

            // Combine data
            const combinedData = maleKDE.map((point, i) => ({
                x: point.x,
                male: point.y,
                female: femaleKDE[i]?.y || 0
            }));

            results[key] = {
                isSingle: false,
                data: combinedData,
                domain: [extendedMin, extendedMax]
            };
        });

        return results;
    }, [pairplotData]);

    // Custom tooltip for cluster scatter
    const ClusterTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-600 rounded shadow-lg text-sm">
                    <p className="font-semibold text-gray-900 dark:text-white">Customer #{d.customerId}</p>
                    <p className="text-gray-600 dark:text-gray-300">Segment: {d.segment}</p>
                    <p className="text-gray-500 dark:text-gray-400">PC1: {d.x.toFixed(2)}</p>
                    <p className="text-gray-500 dark:text-gray-400">PC2: {d.y.toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    // Render cluster scatter plot
    const renderClusterPlot = () => {
        const segments = Object.keys(clusterData).sort((a, b) => Number(a) - Number(b));

        if (segments.length === 0) {
            return (
                <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    No cluster data available. Run segmentation first.
                </div>
            );
        }

        return (
            <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 50, left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        type="number"
                        dataKey="x"
                        name="PC1"
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Principal Component 1', position: 'bottom', offset: 35, fontSize: 12 }}
                    />
                    <YAxis
                        type="number"
                        dataKey="y"
                        name="PC2"
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Principal Component 2', angle: -90, position: 'insideLeft', offset: -5, fontSize: 12 }}
                    />
                    <Tooltip content={<ClusterTooltip />} />
                    <Legend verticalAlign="top" height={36} />
                    {segments.map(seg => (
                        <RechartsScatter
                            key={seg}
                            name={`Segment ${seg}`}
                            data={clusterData[Number(seg)]}
                            fill={getSegmentColor(Number(seg))}
                            opacity={0.7}
                        />
                    ))}
                </ScatterChart>
            </ResponsiveContainer>
        );
    };

    // Render spending histogram
    const renderHistogram = () => {
        if (histogramData.length === 0) {
            return (
                <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    No histogram data available.
                </div>
            );
        }

        return (
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="range"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 10 }}
                    />
                    <YAxis
                        label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fontSize: 12 }}
                        tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                        formatter={(value: number) => [value, 'Count']}
                        labelFormatter={(label: string) => `Range: ${label}`}
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {histogramData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${240 + index * 12}, 70%, 55%)`} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    };

    // Render single pairplot scatter or KDE (for diagonal)
    const renderPairplotCell = (xKey: string, yKey: string) => {
        const maleData = pairplotData.filter((d: any) => d.gender === 'Male');
        const femaleData = pairplotData.filter((d: any) => d.gender === 'Female');

        // Diagonal: render KDE distribution curve from Pre-Calculated Memo
        if (xKey === yKey) {
            const metric = kdeMetrics[xKey];

            if (!metric) return null;

            if (metric.isSingle) {
                return (
                    <div className="h-[100px] flex items-center justify-center text-xs text-gray-400">
                        Single value: {metric.value}
                    </div>
                );
            }

            return (
                <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={metric.data} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                        <XAxis
                            dataKey="x"
                            tick={{ fontSize: 8 }}
                            tickFormatter={(v) => Math.round(v).toString()}
                            type="number"
                            domain={metric.domain}
                        />
                        <Area
                            type="monotone"
                            dataKey="female"
                            stroke={GENDER_COLORS.Female}
                            fill={GENDER_COLORS.Female}
                            fillOpacity={0.4}
                            strokeWidth={1.5}
                        />
                        <Area
                            type="monotone"
                            dataKey="male"
                            stroke={GENDER_COLORS.Male}
                            fill={GENDER_COLORS.Male}
                            fillOpacity={0.4}
                            strokeWidth={1.5}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        // Off-diagonal: render scatter plot with explicit x/y mapping
        const maleScatterData = maleData.map((d: any) => ({ x: d[xKey], y: d[yKey] }));
        const femaleScatterData = femaleData.map((d: any) => ({ x: d[xKey], y: d[yKey] }));

        return (
            <ResponsiveContainer width="100%" height={100}>
                <ScatterChart margin={{ top: 5, right: 5, bottom: 20, left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        type="number"
                        dataKey="x"
                        tick={{ fontSize: 8 }}
                        name={xKey}
                        domain={['dataMin', 'dataMax']}
                    />
                    <YAxis
                        type="number"
                        dataKey="y"
                        tick={{ fontSize: 8 }}
                        width={25}
                        name={yKey}
                        domain={['dataMin', 'dataMax']}
                    />
                    <Tooltip
                        formatter={(value: number) => value.toFixed(1)}
                        labelFormatter={() => ''}
                    />
                    <RechartsScatter
                        name="Female"
                        data={femaleScatterData}
                        fill={GENDER_COLORS.Female}
                    >
                        {femaleScatterData.map((_: any, index: number) => (
                            <Cell key={`female-${index}`} opacity={0.8} />
                        ))}
                    </RechartsScatter>
                    <RechartsScatter
                        name="Male"
                        data={maleScatterData}
                        fill={GENDER_COLORS.Male}
                    >
                        {maleScatterData.map((_: any, index: number) => (
                            <Cell key={`male-${index}`} opacity={0.8} />
                        ))}
                    </RechartsScatter>
                </ScatterChart>
            </ResponsiveContainer>
        );
    };

    // Render pairplot grid
    const renderPairplot = () => {
        const variables = ['age', 'annual_income', 'spending_score'];

        if (pairplotData.length === 0) {
            return (
                <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    No pairplot data available.
                </div>
            );
        }

        return (
            <div>
                <div className="flex justify-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: GENDER_COLORS.Male }}></div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">Male</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: GENDER_COLORS.Female }}></div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">Female</span>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {variables.map((yVar) => (
                        variables.map((xVar) => (
                            <div key={`${yVar}-${xVar}`} className="border border-gray-100 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
                                {renderPairplotCell(xVar, yVar)}
                            </div>
                        ))
                    ))}
                </div>
            </div>
        );
    };

    // Render segment metadata cards
    const renderSegmentCards = () => {
        if (!mlData?.segment_metadata) return null;

        const segments = Object.keys(mlData.segment_metadata).sort((a, b) => Number(a) - Number(b));

        return (
            <div className="flex gap-2 flex-wrap justify-center mb-4">
                {segments.map(segId => {
                    const meta = mlData.segment_metadata[Number(segId)];
                    return (
                        <div
                            key={segId}
                            className="px-3 py-2 rounded-lg text-white text-center min-w-16 shadow-sm"
                            style={{ backgroundColor: meta.color || getSegmentColor(Number(segId)) }}
                        >
                            <div className="font-bold text-sm">Seg {segId}</div>
                            {meta.centroid_age && (
                                <div className="text-[10px] mt-1 opacity-90 space-y-0.5">
                                    <div>Age: {meta.centroid_age?.toFixed(0)}</div>
                                    <div>Inc: {meta.centroid_income?.toFixed(0)}</div>
                                    <div>Spd: {meta.centroid_spending?.toFixed(0)}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const vizTabs = [
        { id: 'clusters' as VisualizationTab, label: 'Clusters', icon: CircleDot },
        { id: 'histogram' as VisualizationTab, label: 'Spending Dist.', icon: BarChart2 },
        { id: 'pairplot' as VisualizationTab, label: 'Relationships', icon: LayoutGrid },
    ];

    return (
        <div className="space-y-8 pb-10 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen relative">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">ML Customer Segmentation</h1>
                <p className="text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                    <Activity size={16} /> K-Means Clustering Analysis Dashboard
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {/* --- Left Column: Controls --- */}
                <div className="lg:col-span-1 space-y-6">
                    {/* 1. Manual Input Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Manual Data Input
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Gender</label>
                                <select
                                    className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={selectedGender}
                                    onChange={handleGenderChange}
                                >
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Age</label>
                                <input
                                    type="number"
                                    name="age"
                                    className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={formValues.age}
                                    onChange={handleInputChange}
                                    min="18" max="120"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Income (k$)</label>
                                    <input
                                        type="number"
                                        name="annual_income"
                                        className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={formValues.annual_income}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Score (1-100)</label>
                                    <input
                                        type="number"
                                        name="spending_score"
                                        className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={formValues.spending_score}
                                        onChange={handleInputChange}
                                        min="1" max="100"
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition shadow-lg shadow-indigo-200 dark:shadow-none">
                                Add & Re-Cluster
                            </button>
                        </form>
                    </div>

                    {/* 2. Sampling Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Run Sampling
                        </h3>
                        <p className="text-sm text-gray-500 mb-3">Select dataset size to retrain:</p>
                        <div className="grid grid-cols-3 gap-2">
                            {[10, 20, 50, 100, 200, 500].map(n => (
                                <button
                                    key={n}
                                    onClick={() => handleSampleClick(n)}
                                    className={`py-2 rounded-lg border text-sm font-medium transition
                                    ${sampleSize === n
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300'}`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Segment Legend Cards */}
                    {mlData?.segment_metadata && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                Segment Centroids
                            </h3>
                            {renderSegmentCards()}
                        </div>
                    )}
                </div>

                {/* --- Right Column: Visuals & Data --- */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Visualizations Panel */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Brain className="text-indigo-500" /> Clustering Visualization
                        </h3>

                        {/* Visualization Tabs */}
                        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                            {vizTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveVizTab(tab.id)}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${activeVizTab === tab.id
                                            ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 animate-pulse">
                                <Activity className="animate-spin mb-2" size={32} />
                                <p>Processing ML Model...</p>
                            </div>
                        ) : mlData ? (
                            <div className="min-h-[320px]">
                                {activeVizTab === 'clusters' && renderClusterPlot()}
                                {activeVizTab === 'histogram' && renderHistogram()}
                                {activeVizTab === 'pairplot' && renderPairplot()}
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                No results generated yet
                            </div>
                        )}
                    </div>

                    {/* Data Table Panel with Pagination */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-[500px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Database className="text-emerald-500" /> Customer Data
                            </h3>
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300">
                                Total: {customers.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase text-gray-500 dark:text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">ID</th>
                                        <th className="px-4 py-3">Gender</th>
                                        <th className="px-4 py-3">Age</th>
                                        <th className="px-4 py-3">Income</th>
                                        <th className="px-4 py-3">Score</th>
                                        <th className="px-4 py-3 rounded-r-lg text-right">Segment</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {currentCustomers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-10 text-gray-400">No customers found</td>
                                        </tr>
                                    )}
                                    {currentCustomers.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.id}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.gender}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.age}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">${c.annual_income}k</td>
                                            <td className="px-4 py-3">
                                                <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                                                    <div
                                                        className="bg-indigo-500 h-1.5 rounded-full"
                                                        style={{ width: `${c.spending_score}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span
                                                    className="px-2 py-1 rounded-full text-xs text-white font-medium"
                                                    style={{ backgroundColor: getSegmentColor(c.segment) }}
                                                >
                                                    Seg {c.segment}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                            <button
                                onClick={() => handlePageChange('prev')}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                Page {currentPage} of {totalPages || 1}
                            </span>
                            <button
                                onClick={() => handlePageChange('next')}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronRight size={18} className="text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}