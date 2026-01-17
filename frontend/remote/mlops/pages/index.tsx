'use client';
import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {
    ScatterChart,
    Scatter as RechartsScatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell
} from 'recharts';

// --- Constants & Helper Functions (Outside Component for Performance) ---

const SEGMENT_COLORS: Record<number, string> = {
    0: "#3b82f6",  // Blue
    1: "#10b981",  // Emerald/Green
    2: "#8b5cf6",  // Purple/Violet
    3: "#f59e0b",  // Amber/Orange
    4: "#ec4899"   // Pink/Rose
};

const GENDER_COLORS = {
    Male: "#225ea8",
    Female: "#7fcdbb"
};

// KDE Calculation Logic
// Now robust against empty arrays and ensures consistent grid points
const calculateKDE = (values: number[], displayMin: number, displayMax: number, bandwidth: number, points: number = 70): Array<{ x: number, y: number }> => {
    const result: Array<{ x: number, y: number }> = [];
    // Protect against division by zero if min == max
    const range = displayMax - displayMin || 1;
    const step = range / (points - 1);

    for (let i = 0; i < points; i++) {
        const x = displayMin + i * step;
        let density = 0;

        if (values.length > 0 && bandwidth > 0) {
            for (let j = 0; j < values.length; j++) {
                const z = (x - values[j]) / bandwidth;
                density += Math.exp(-0.5 * z * z);
            }
            density /= (values.length * bandwidth * Math.sqrt(2 * Math.PI));
        }

        result.push({ x, y: density });
    }
    return result;
};

// Bandwidth calculation with safeguard for low variance/N
const calculateBandwidth = (values: number[]): number => {
    if (values.length < 2) return 1.0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

    // Standard rule of thumb: 1.06 * sigma * n^(-1/5)
    // If std is 0 (all points same), return 1 to prevent division by zero errors later
    if (std === 0) return 1.0;

    return 1.06 * std * Math.pow(values.length, -0.2);
};

// --- Main Component ---

const initialCustomerValues = {
    id: "",
    gender: "",
    age: 18,
    annual_income: 15,
    spending_score: 5,
    segment: 0
};

const initialSampleValues = {
    sampleSize: 10,
};

const initialGetCustomerValues = {
    id: "",
    gender: "",
    age: 0,
    annual_income: 0,
    spending_score: 0,
    segment: 0
};

const genders = [
    {value: "Female", label: "Female"},
    {value: "Male", label: "Male"}
];

const mlEndpoint = "http://localhost:80/mlops-segmentation";

export default function Index(this: any) {

    const [loading, setLoading] = useState(false);
    const [values, setValues] = useState(initialCustomerValues);
    const [values2, setValues2] = useState(initialSampleValues);
    const [customers, setCustomers] = useState([initialGetCustomerValues]);
    // Replaced 'images' state with 'mlData' to hold raw data for charts
    const [mlData, setMlData] = useState<any>(null);
    const [selectedGender, setSelectedGender] = useState("Female");

    const [userToken, setUserToken] = useState('');
    //Make sure only runs once
    const effectRan = useRef(false);
    if (!effectRan.current) {
        if (typeof window !== "undefined") {
            setUserToken(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
            effectRan.current = true;
        }
    }

    // Load all get methods once, when page renders
    useEffect(() => {
        getCustomers()
        getMLInfo(-2)
    }, []);


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const { name, value } = event.target;
        setValues({ ...values, [name]: value });
    };

    const handleOptionSelect = (event: { target: { options: any; }; }) => {
        for (var i = 0, l = event.target.options.length; i < l; i++) {
            if (event.target.options[i].selected) {
                setSelectedGender(event.target.options[i].value)
            }
        }
    };

    function getCustomers() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        axios.get(mlEndpoint + "/getSegmentationCustomers", axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setCustomers(response.data)

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", Data);
            })
    }

    function getMLInfo(sample: number) {
        setLoading(true);
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        const postData = {
            sampleSize: Number(sample),
        };

        axios.post(mlEndpoint + "/getMLInfo", postData, axiosConfig)
            .then((response) => {
                console.log("ML INFO RECEIVED: ", response.data);
                setMlData(response.data);
                getCustomers();
                setLoading(false);
            })
            .catch((error) => {
                setLoading(false);
            })
    }

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        newCustomer(values)
    };

    function newCustomer(input: any) {
        const postData = {
            fields: {
                gender: selectedGender,
                age: Number(input.age),
                annual_income: Number(input.annual_income),
                spending_score: Number(input.spending_score),
                segment: 0
            }
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        axios.post(mlEndpoint + "/addCustomer", postData, axiosConfig)
            .then((response) => {
                getCustomers()
                getMLInfo(-1)
            })
            .catch((error) => { })
    }

    // --- Data Preparation for Recharts (Memoized) ---

    // 1. Cluster Data
    const clusterData = useMemo(() => {
        if (!mlData?.cluster_scatter?.pca_component_1) return {};

        const { pca_component_1, pca_component_2, segment, customer_id } = mlData.cluster_scatter;
        const segmentGroups: Record<number, Array<{ x: number; y: number; customerId: number; segment: number }>> = {};

        for (let i = 0; i < pca_component_1.length; i++) {
            const seg = segment[i];
            if (!segmentGroups[seg]) segmentGroups[seg] = [];
            segmentGroups[seg].push({
                x: pca_component_1[i],
                y: pca_component_2[i],
                customerId: customer_id[i],
                segment: seg
            });
        }
        return segmentGroups;
    }, [mlData?.cluster_scatter]);

    // 2. Pairplot Data
    const pairplotData = useMemo(() => {
        if (!mlData?.pairplot_data?.age) return [];
        const { age, annual_income, spending_score, gender } = mlData.pairplot_data;
        return age.map((_: number, i: number) => ({
            age: age[i],
            annual_income: annual_income[i],
            spending_score: spending_score[i],
            gender: gender[i]
        }));
    }, [mlData?.cluster_scatter]);

    // 3. KDE Metrics & Global Domains (Optimized for Small Samples)
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
            const range = dataMax - dataMin;

            // Calculate Bandwidths
            const maleBandwidth = calculateBandwidth(maleValues);
            const femaleBandwidth = calculateBandwidth(femaleValues);
            const maxBandwidth = Math.max(maleBandwidth, femaleBandwidth);

            // FIX: Use Bandwidth-based padding.
            // Gaussian distributions extend ~3-4 sigmas (bandwidths) out.
            // We use 4*Bandwidth or 20% of range, whichever is larger.
            // This ensures small clusters don't get cut off.
            const padding = Math.max(range * 0.2, maxBandwidth * 4);

            const extendedMin = dataMin - padding;
            const extendedMax = dataMax + padding;

            if (dataMin === dataMax && maxBandwidth <= 1) {
                // Special case: Single point or identical points
                results[key] = { isSingle: true, value: dataMin, domain: [extendedMin, extendedMax] };
                return;
            }

            const maleKDE = calculateKDE(maleValues, extendedMin, extendedMax, maleBandwidth);
            const femaleKDE = calculateKDE(femaleValues, extendedMin, extendedMax, femaleBandwidth);

            results[key] = {
                isSingle: false,
                data: maleKDE.map((point, i) => ({
                    x: point.x,
                    male: point.y,
                    female: femaleKDE[i]?.y || 0
                })),
                domain: [extendedMin, extendedMax]
            };
        });
        return results;
    }, [pairplotData]);


    // --- Render Functions ---

    const renderClusterPlot = () => {
        const segments = Object.keys(clusterData).sort((a, b) => Number(a) - Number(b));
        if (segments.length === 0) return <div className="flex items-center justify-center h-full text-gray-400">No Data</div>;

        return (
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="PC1" tick={{ fontSize: 10 }} label={{ value: 'PC1', position: 'bottom', offset: 20 }} />
                    <YAxis type="number" dataKey="y" name="PC2" tick={{ fontSize: 10 }} label={{ value: 'PC2', angle: -90, position: 'insideLeft' }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend verticalAlign="top" height={36} />
                    {segments.map(seg => (
                        <RechartsScatter key={seg} name={`Seg ${seg}`} data={clusterData[Number(seg)]} fill={SEGMENT_COLORS[Number(seg)]} />
                    ))}
                </ScatterChart>
            </ResponsiveContainer>
        );
    };

    const renderPairplotCell = (xKey: string, yKey: string) => {
        const xMetric = kdeMetrics[xKey];
        const yMetric = kdeMetrics[yKey];

        if (!xMetric || !yMetric) return null;

        if (xKey === yKey) {
            // Diagonal KDE
            if (xMetric.isSingle) return null;
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={xMetric.data} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                        <XAxis dataKey="x" hide type="number" domain={xMetric.domain} />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip
                            formatter={(value: number, name: string) => [value.toFixed(4), name === 'male' ? 'Male' : 'Female']}
                            labelFormatter={(label: number) => `${xKey}: ${label.toFixed(1)}`}
                            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="female" stroke={GENDER_COLORS.Female} fill={GENDER_COLORS.Female} fillOpacity={0.4} />
                        <Area type="monotone" dataKey="male" stroke={GENDER_COLORS.Male} fill={GENDER_COLORS.Male} fillOpacity={0.4} />
                    </AreaChart>
                </ResponsiveContainer>
            );
        } else {
            // Scatter Plot
            const maleData = pairplotData.filter((d: any) => d.gender === 'Male').map((d: any) => ({ x: d[xKey], y: d[yKey] }));
            const femaleData = pairplotData.filter((d: any) => d.gender === 'Female').map((d: any) => ({ x: d[xKey], y: d[yKey] }));

            // Custom tooltip to show actual field names
            const CustomScatterTooltip = ({ active, payload }: any) => {
                if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                        <div style={{
                            backgroundColor: 'white',
                            padding: '8px 12px',
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            fontSize: '12px'
                        }}>
                            <p style={{ margin: '4px 0 0 0' }}>{xKey}: {data.x.toFixed(1)}</p>
                            <p style={{ margin: '4px 0 0 0' }}>{yKey}: {data.y.toFixed(1)}</p>
                        </div>
                    );
                }
                return null;
            };

            return (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" dataKey="x" hide domain={xMetric.domain} />
                        <YAxis type="number" dataKey="y" hide domain={yMetric.domain} />
                        <Tooltip content={<CustomScatterTooltip />} />
                        <RechartsScatter data={femaleData} fill={GENDER_COLORS.Female} name="Female">
                            {femaleData.map((_: any, index: number) => <Cell key={`f-${index}`} fillOpacity={0.6} />)}
                        </RechartsScatter>
                        <RechartsScatter data={maleData} fill={GENDER_COLORS.Male} name="Male">
                            {maleData.map((_: any, index: number) => <Cell key={`m-${index}`} fillOpacity={0.6} />)}
                        </RechartsScatter>
                    </ScatterChart>
                </ResponsiveContainer>
            );
        }
    };

const renderPairplotGrid = () => {
    if (pairplotData.length === 0) return <div className="flex items-center justify-center h-full">No Data</div>;
    const vars = ['age', 'annual_income', 'spending_score'];
    const varLabels: Record<string, string> = {
        'age': 'Age',
        'annual_income': 'Annual Income',
        'spending_score': 'Spending Score'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            {/* Main grid with left labels */}
            <div style={{ display: 'flex', flex: 1 }}>
                {/* Y-axis labels (left side) - using grid to match row heights */}
                <div style={{
                    display: 'grid',
                    gridTemplateRows: 'repeat(3, 1fr)',
                    width: '20px',
                    marginRight: '8px'
                }}>
                    {vars.map(v => (
                        <div
                            key={`y-label-${v}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}
                        >
                            <span style={{
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg)',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#374151',
                                whiteSpace: 'nowrap'
                            }}>
                                {varLabels[v]}
                            </span>
                        </div>
                    ))}
                </div>

                {/* The 3x3 grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridTemplateRows: 'repeat(3, 1fr)',
                    flex: 1,
                    gap: '2px'
                }}>
                    {vars.map(y => vars.map(x => (
                        <div key={`${y}-${x}`} style={{ border: '1px solid #eee', overflow: 'hidden' }}>
                            {renderPairplotCell(x, y)}
                        </div>
                    )))}
                </div>
            </div>

            {/* X-axis labels (bottom) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                marginLeft: '28px',  /* 20px width + 8px margin */
                marginTop: '8px'
            }}>
                {vars.map(v => (
                    <div
                        key={`x-label-${v}`}
                        style={{
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#374151'
                        }}
                    >
                        {varLabels[v]}
                    </div>
                ))}
            </div>
        </div>
    );
};

    const columns: GridColDef[] = [
        { field: "id", headerName: "ID", width: 50 },
        { field: "gender", headerName: "Gender", width: 80 },
        { field: "age", headerName: "Age", width: 50 },
        { field: "annual_income", headerName: "Annual Income", width: 120 },
        { field: "spending_score", headerName: "Spending score", width: 120 },
        { field: "segment", headerName: "Segment", width: 105 }
    ];


    return (
        <div className="flex-container px-4 pb-4 pt-6 flex-col items-center justify-center">
            <div className="">
                <div className="">
                <h1>{("Dataset creation with sampling from predefined DB or new data - choose one option")}</h1>
                <form onSubmit={handleSubmit}>
                    <div>
                        1. Manual data input
                    </div>

                    <label>
                        <select onChange={handleOptionSelect}>
                            {genders.map((gender, index) => (
                                <option key={index} value={gender.value}>
                                    {gender.label}
                                </option>
                            ))}
                        </select>
                        <div>
                        Customer age:
                        <input
                            type="number"
                            name="age"
                            placeholder="Enter customer age"
                            onChange={handleChange}
                            value={values.age}
                            maxLength={50}
                            required
                            min="18"
                            max="120"
                        />
                        </div>
                        <div>
                        Spending score:
                        <input
                            type="number"
                            name="spending_score"
                            placeholder="Enter customer spending_score"
                            onChange={handleChange}
                            value={values.spending_score}
                            maxLength={50}
                            required
                            min="5"
                            max="100"
                        />
                        <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                        </div>
                    </label>
                    <br/>

                </form>
                </div>
                2. Test a sample size from predefined DB with specific amount of customer:
                <br/>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(10)}
                > 10
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(20)}
                > 20
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(50)}
                > 50
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(100)}
                > 100
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(200)}
                > 200
                </button>
            </div>
            <div className="flex-row">
                <h1>{("ML Classification Results: ")}</h1>
                <div id="banner">
                    {/* Pairplot Grid */}
                    <div className="inline-block" style={{ height: 450, width: 550, verticalAlign: 'top', background: '#fff' }}>
                         {renderPairplotGrid()}
                    </div>

                    {/* Cluster Scatter */}
                    <div className="inline-block" style={{ height: 450, width: 550, verticalAlign: 'top', background: '#fff' }}>
                        {renderClusterPlot()}
                    </div>
                </div>

            </div>
            <div className="section">
                <div className="Item">
                    {loading ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                            Customer List
                            <DataGrid
                                rows={customers}
                                columns={columns}
                                className="text-black dark:text-white h-auto"
                                slotProps={{
                                    row: {
                                        className: "text-black dark:text-white"
                                    },
                                    cell: {
                                        className: "text-black dark:text-white",
                                    },
                                    pagination: {
                                        className: "text-black dark:text-white",
                                    },
                                }}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>

    )
}

