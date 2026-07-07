import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Decision, Timeline } from '../../types';
import styles from './DecisionTree.module.css';

interface DecisionTreeProps {
    decision: Decision;
    timelines: Timeline[];
    branches: any[]; // child decisions
    parent: { id: string; content: string } | null;
    selectedTimelineForFollowUp?: string | null;
    onSelectTimelineForFollowUp?: (timelineId: string) => void;
}

const TIMELINE_COLORS = [
    'var(--timeline-color-1)',
    'var(--timeline-color-2)',
    'var(--timeline-color-3)',
    'var(--timeline-color-4)',
    'var(--timeline-color-5)',
];

// Helper to summarize prompts client-side to 4-5 descriptive words
function getShortSummary(content: string, category?: string): string {
    const text = content.toLowerCase();
    const hasDoubt = text.includes('doubt') || text.includes('confused') || text.includes('sure') || text.includes('should i') || text.includes('choose') || text.includes('what if');
    const hasMistake = text.includes('mistake') || text.includes('regret') || text.includes('wrong') || text.includes('bad') || text.includes('mess');

    // 1. Career / Job keyword matches
    if (text.includes('job') || text.includes('offer') || text.includes('salary') || text.includes('lpa') || text.includes('ctc') || text.includes('promotion') || text.includes('resign') || text.includes('company') || text.includes('work')) {
        if (hasDoubt) {
            return 'Job Shift Doubt';
        }
        if (hasMistake) {
            return 'Career Shift Regret';
        }
        if (text.includes('offer')) {
            return 'Job Offer Decision';
        }
        return 'Career Path Decision';
    }

    // 2. Education / Academic keyword matches
    if (text.includes('college') || text.includes('university') || text.includes('exam') || text.includes('study') || text.includes('course') || text.includes('degree') || text.includes('academic') || text.includes('major') || text.includes('engineering') || text.includes('mba') || text.includes('mtech') || text.includes('school') || text.includes('education')) {
        if (hasDoubt) {
            return 'Academic Decision';
        }
        if (hasMistake) {
            return 'Academic Regret Choice';
        }
        return 'Academic Decision';
    }

    // 3. Relationships keyword matches
    if (text.includes('relationship') || text.includes('break') || text.includes('split') || text.includes('girlfriend') || text.includes('boyfriend') || text.includes('partner') || text.includes('marry') || text.includes('marriage') || text.includes('divorce') || text.includes('proposal') || text.includes('date') || text.includes('dating') || text.includes('love') || text.includes('propose') || text.includes('ex')) {
        if (hasMistake) {
            return 'Relationship Mistake';
        }
        if (hasDoubt) {
            return 'Relationship Doubt Choice';
        }
        if (text.includes('break') || text.includes('split')) {
            return 'Relationship Breakup Choice';
        }
        return 'Relationship Decision';
    }

    // 4. Financial keyword matches
    if (text.includes('buy') || text.includes('invest') || text.includes('stock') || text.includes('crypto') || text.includes('loan') || text.includes('debt') || text.includes('car') || text.includes('house') || text.includes('flat') || text.includes('property') || text.includes('rent') || text.includes('money')) {
        if (hasDoubt) {
            return 'Financial Investment Doubt';
        }
        return 'Financial Management Choice';
    }

    // 5. Health & Wellness keyword matches
    if (text.includes('health') || text.includes('gym') || text.includes('doctor') || text.includes('disease') || text.includes('sick') || text.includes('weight') || text.includes('diet') || text.includes('therapy') || text.includes('mental')) {
        return 'Health & Lifestyle Choice';
    }

    // 6. Category fallback if keywords didn't trigger
    if (category) {
        const cat = category.toLowerCase();
        if (cat === 'career') return 'Career Path Decision';
        if (cat === 'finance') return 'Financial Management Choice';
        if (cat === 'relationships' || cat === 'relationship') return 'Relationship Decision';
        if (cat === 'health') return 'Health & Lifestyle Choice';
        if (cat === 'education') return 'Academic Decision';
        if (cat === 'lifestyle') return 'Personal Lifestyle Choice';
    }

    // 7. Default fallback: take the first 5 words
    const words = content.trim().split(/\s+/);
    if (words.length <= 5) {
        return content;
    }
    return words.slice(0, 5).join(' ') + '...';
}

export default function DecisionTree({
    decision,
    timelines,
    branches,
    parent,
    selectedTimelineForFollowUp,
    onSelectTimelineForFollowUp
}: DecisionTreeProps) {
    const navigate = useNavigate();

    // Zoom and pan state
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Setup coordinates layout (Larger dimensions to support full unwrapped text)
    const startX = parent ? 20 : 120;
    const parentWidth = 200;
    const parentHeight = 64;

    const currentX = startX + (parent ? 260 : 0);
    const currentWidth = 220;
    const currentHeight = 72;

    const timelineX = currentX + 280;
    const timelineWidth = 190;
    const timelineHeight = 48;

    const childX = timelineX + 250;
    const childWidth = 200;
    const childHeight = 64;

    // Calculate vertical coordinates for timelines based on count
    const numTimelines = timelines.length;
    const timelineSpacing = 85;
    const heightNeeded = Math.max(300, numTimelines * timelineSpacing + 40);
    const centerY = heightNeeded / 2;

    const getTimelineY = (idx: number) => {
        if (numTimelines === 1) return centerY;
        const totalHeight = (numTimelines - 1) * timelineSpacing;
        return centerY - totalHeight / 2 + idx * timelineSpacing;
    };

    // Current node vertical coordinate is centered relative to centerY
    const currentY = centerY - currentHeight / 2;

    // Edge drawing helpers (Cubic Bezier curve)
    const drawCurve = (x1: number, y1: number, x2: number, y2: number) => {
        const controlOffset = Math.abs(x2 - x1) * 0.5;
        return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
    };

    // Smooth scroll to timeline card element
    const handleTimelineClick = (title: string) => {
        const cards = document.querySelectorAll('h3');
        for (const card of Array.from(cards)) {
            if (card.textContent?.trim() === title.trim()) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.parentElement?.classList.add('pulse-highlight');
                setTimeout(() => card.parentElement?.classList.remove('pulse-highlight'), 2000);
                break;
            }
        }
    };

    // Mouse Panning handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // only left click dragging
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch Panning handlers (mobile swipe)
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            const touch = e.touches[0];
            setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const handleZoomIn = () => {
        setScale(prev => Math.min(2.5, prev + 0.15));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(0.5, prev - 0.15));
    };

    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    return (
        <section className={styles.container} aria-label="Decision branch exploration">
            <div className={styles.headerRow}>
                <h3 className={styles.title}>🔮 Branching Simulation Map</h3>
                <div className={styles.controls}>
                    <button type="button" onClick={handleZoomIn} title="Zoom In">➕</button>
                    <button type="button" onClick={handleZoomOut} title="Zoom Out">➖</button>
                    <button type="button" onClick={handleReset} title="Reset View">🎯</button>
                </div>
            </div>

            <div 
                className={styles.graphWrapper}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
            >
                <svg 
                    viewBox={`0 0 ${childX + childWidth + 20} ${heightNeeded}`} 
                    className={styles.svg}
                    style={{ height: `${heightNeeded}px` }}
                >
                    <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`}>
                        {/* CONNECTIONS (Rendered behind nodes) */}
                        {/* Parent -> Current */}
                        {parent && (
                            <path
                                d={drawCurve(
                                    startX + parentWidth,
                                    centerY,
                                    currentX,
                                    centerY
                                )}
                                className={`${styles.edge} ${styles.edgeActive}`}
                            />
                        )}

                        {/* Current -> Timelines & Timelines -> Children */}
                        {timelines.map((timeline, idx) => {
                            const tY = getTimelineY(idx);
                            const color = TIMELINE_COLORS[idx % TIMELINE_COLORS.length];
                            const childBranch = branches.find(b => b.parentTimelineId === timeline.id);

                            return (
                                <g key={timeline.id}>
                                    {/* Current to Timeline path */}
                                    <path
                                        d={drawCurve(
                                            currentX + currentWidth,
                                            centerY,
                                            timelineX,
                                            tY
                                        )}
                                        className={styles.edge}
                                        style={{ stroke: `rgba(255, 255, 255, 0.08)` }}
                                    />

                                    {/* Timeline to Child path */}
                                    {childBranch && (
                                        <path
                                            d={drawCurve(
                                                timelineX + timelineWidth,
                                                tY,
                                                childX,
                                                tY
                                            )}
                                            className={`${styles.edge} ${styles.edgeActive}`}
                                            style={{ '--color-accent-primary': color } as React.CSSProperties}
                                        />
                                    )}
                                </g>
                            );
                        })}

                        {/* NODES */}
                        {/* Parent Node */}
                        {parent && (
                            <foreignObject
                                x={startX}
                                y={centerY - parentHeight / 2}
                                width={parentWidth}
                                height={parentHeight}
                                className={styles.nodeForeignObject}
                            >
                                <div 
                                    className={`${styles.htmlNode} ${styles.parentNode}`}
                                    onClick={() => navigate(`/decision/${parent.id}`)}
                                >
                                    <div className={styles.htmlNodeText}>{getShortSummary(parent.content)}</div>
                                    <div className={styles.htmlNodeSubtext}>↩ Parent Decision</div>
                                </div>
                            </foreignObject>
                        )}

                        {/* Current Decision Node */}
                        <foreignObject
                            x={currentX}
                            y={currentY}
                            width={currentWidth}
                            height={currentHeight}
                            className={styles.nodeForeignObject}
                        >
                            <div className={`${styles.htmlNode} ${styles.currentNode}`}>
                                <div className={styles.htmlNodeText} style={{ fontWeight: 800 }}>
                                    {getShortSummary(decision.content, decision.category)}
                                </div>
                                <div className={styles.htmlNodeSubtext} style={{ color: 'var(--color-accent-primary)', fontWeight: 700 }}>
                                    ● Active Simulation
                                </div>
                            </div>
                        </foreignObject>

                        {/* Timeline Pill Nodes */}
                        {timelines.map((timeline, idx) => {
                            const tY = getTimelineY(idx);
                            const color = TIMELINE_COLORS[idx % TIMELINE_COLORS.length];
                            const childBranch = branches.find(b => b.parentTimelineId === timeline.id);
                            const isSelected = selectedTimelineForFollowUp === timeline.id;

                            return (
                                <g key={timeline.id}>
                                    <foreignObject
                                        x={timelineX}
                                        y={tY - timelineHeight / 2}
                                        width={timelineWidth}
                                        height={timelineHeight}
                                        className={styles.nodeForeignObject}
                                    >
                                        <div 
                                            className={`${styles.htmlNode} ${styles.timelinePillNode} ${isSelected ? styles.selectedPill : ''}`}
                                            onClick={() => {
                                                if (onSelectTimelineForFollowUp) {
                                                    onSelectTimelineForFollowUp(timeline.id);
                                                }
                                                handleTimelineClick(timeline.title);
                                            }}
                                            style={{ '--accent-color': color } as React.CSSProperties}
                                            title="Click to select for follow-up & view details"
                                        >
                                            <div className={styles.htmlNodeText} style={{ fontWeight: 700, textAlign: 'center', width: '100%' }}>
                                                {timeline.title}
                                            </div>
                                        </div>
                                    </foreignObject>

                                    {/* Child Decision Node */}
                                    {childBranch && (
                                        <foreignObject
                                            x={childX}
                                            y={tY - childHeight / 2}
                                            width={childWidth}
                                            height={childHeight}
                                            className={styles.nodeForeignObject}
                                        >
                                            <div 
                                                className={`${styles.htmlNode} ${styles.parentNode}`}
                                                onClick={() => navigate(`/decision/${childBranch.id}`)}
                                            >
                                                <div className={styles.htmlNodeText}>{getShortSummary(childBranch.content)}</div>
                                                <div className={styles.htmlNodeSubtext} style={{ fill: color, color: color }}>
                                                    ↪ Injected Path
                                                </div>
                                            </div>
                                        </foreignObject>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>
        </section>
    );
}
