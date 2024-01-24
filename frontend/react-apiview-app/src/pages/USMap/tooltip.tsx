interface TooltipProps {
    data: {
        NAME: string;
        Obesity: number;
    };
}

const Tooltip: React.FC<TooltipProps> = ({ data }) => {
    return (
        <div className="absolute bg-white border p-2 rounded shadow text-sm">
            <strong>{data.NAME}</strong>
            <br />
            Obesity: {data.Obesity}%
        </div>
    );
};
export default Tooltip;