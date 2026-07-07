import type { Timeline } from '../../types';
import styles from './RadarChart.module.css';

interface RadarChartProps {
    timelines: Timeline[];
}

const METRIC_KEYS = ['emotional', 'financial', 'career', 'relationships', 'risk'] as const;
const METRIC_LABELS: Record<typeof METRIC_KEYS[number], string> = {
    emotional: '😊 Emotional',
    financial: '💰 Financial',
    career: '📈 Career',
    relationships: '❤️ Relationships',
    risk: '⚠️ Risk',
};

const TIMELINE_COLORS = [
    'var(--timeline-color-1)',
    'var(--timeline-color-2)',
    'var(--timeline-color-3)',
];

export default function RadarChart({ timelines }: RadarChartProps) {
    const cx = 160;
    const cy = 160;
    const r = 90;
    const numAxes = METRIC_KEYS.length;

    // Helper to calculate X/Y for a specific metric on an axis index
    const getCoordinates = (axisIndex: number, score: number) => {
        // -pi/2 starts the first axis pointing straight up
        const angle = (axisIndex * 2 * Math.PI) / numAxes - Math.PI / 2;
        const distance = (score / 100) * r;
        const x = cx + distance * Math.cos(angle);
        const y = cy + distance * Math.sin(angle);
        return { x, y };
    };

    // Calculate grid lines (5 concentric pentagons)
    const gridLevels = [20, 40, 60, 80, 100];
    const gridPoints = gridLevels.map((level) => {
        const pointsList: string[] = [];
        for (let i = 0; i < numAxes; i++) {
            const { x, y } = getCoordinates(i, level);
            pointsList.push(`${x},${y}`);
        }
        return pointsList.join(' ');
    });

    // Draw axis lines and label placements
    const axes = METRIC_KEYS.map((key, i) => {
        const outerPt = getCoordinates(i, 100);
        // Place label slightly outside the outer point
        const labelAngle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const labelDistance = r + 24; // 24px padding for labels
        const labelX = cx + labelDistance * Math.cos(labelAngle);
        // Offset Y slightly based on whether it is top or bottom for better alignment
        const labelY = cy + labelDistance * Math.sin(labelAngle) + (labelAngle > -Math.PI/2 && labelAngle < Math.PI/2 ? 4 : 2);

        return {
            key,
            label: METRIC_LABELS[key],
            outerX: outerPt.x,
            outerY: outerPt.y,
            labelX,
            labelY,
        };
    });

    // Render polygon path for each timeline
    const series = timelines.map((timeline, index) => {
        const color = TIMELINE_COLORS[index % TIMELINE_COLORS.length];
        const pointsList: string[] = [];
        const coordinates: { x: number; y: number; label: string; score: number }[] = [];

        METRIC_KEYS.forEach((key, i) => {
            const metricObj = timeline.metrics[key];
            const score = metricObj ? metricObj.score : 50; // fallback to 50 if missing
            const { x, y } = getCoordinates(i, score);
            pointsList.push(`${x},${y}`);
            coordinates.push({ x, y, label: METRIC_LABELS[key], score });
        });

        const pointsStr = pointsList.join(' ');

        return {
            timelineId: timeline.id,
            title: timeline.title,
            pointsStr,
            coordinates,
            color,
        };
    });

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Visual Dimension Trade-offs</h3>
            <div className={styles.chartWrapper}>
                <svg viewBox="0 0 320 320" className={styles.radarSvg}>
                    {/* Concentric grid lines */}
                    {gridPoints.map((points, idx) => (
                        <polygon
                            key={idx}
                            points={points}
                            className={styles.gridLine}
                        />
                    ))}

                    {/* Axis lines */}
                    {axes.map((axis) => (
                        <line
                            key={axis.key}
                            x1={cx}
                            y1={cy}
                            x2={axis.outerX}
                            y2={axis.outerY}
                            className={styles.axisLine}
                        />
                    ))}

                    {/* Axis labels */}
                    {axes.map((axis) => (
                        <text
                            key={axis.key}
                            x={axis.labelX}
                            y={axis.labelY}
                            className={styles.axisLabel}
                        >
                            {axis.label}
                        </text>
                    ))}

                    {/* Series polygons */}
                    {series.map((item) => (
                        <polygon
                            key={item.timelineId}
                            points={item.pointsStr}
                            className={styles.seriesPolygon}
                            fill={item.color}
                            stroke={item.color}
                        />
                    ))}

                    {/* Data points */}
                    {series.map((item) =>
                        item.coordinates.map((coord, ptIdx) => (
                            <g key={`${item.timelineId}-${ptIdx}`}>
                                <circle
                                    cx={coord.x}
                                    cy={coord.y}
                                    r={4}
                                    fill="var(--color-bg-secondary)"
                                    stroke={item.color}
                                    strokeWidth={2}
                                    className={styles.dataPoint}
                                />
                                <title>
                                    {item.title} - {coord.label}: {coord.score}%
                                </title>
                            </g>
                        ))
                    )}
                </svg>
            </div>

            {/* Chart Legend */}
            <div className={styles.legend}>
                {series.map((item) => (
                    <div key={item.timelineId} className={styles.legendItem}>
                        <div
                            className={styles.legendColor}
                            style={{ backgroundColor: item.color }}
                        />
                        <span>{item.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
