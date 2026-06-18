/**
 * ═══════════════════════════════════════════════════════════════════════
 * CANONICAL QUESTION CONTRACT
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * This is the SINGLE SOURCE OF TRUTH for question data shape.
 * 
 * ⚠️ RULES:
 * 1. This is the ONLY question type used in online battles
 * 2. DO NOT create other Question interfaces elsewhere
 * 3. DO NOT add defensive fallbacks when mapping to this type
 * 4. If data doesn't match this shape, FAIL LOUDLY
 * 
 * Last updated: 2025-11-27
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * ═══════════════════════════════════════════════════════════════════════
 * GRAPH CONTRACT (ONE PER QUESTION)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * - Graphs are stored at the QUESTION level (not per-step).
 * - Supports one shared graph canvas with plotted series and geometry overlays.
 * - Each series can be a function graph (y = f(x)) or points/line graph.
 * - Styling: transparent background, graph elements rendered in white/black.
 */

export type GraphColor = 'white' | 'black';
export type GraphDisplayMode = 'standard' | 'aLevelSketch';
export type GraphScaleMode = 'equalUnits' | 'fill';

export interface GraphPoint {
    x: number;
    y: number;
}

export interface GraphSeriesBase {
    /** Draw dots at the endpoints of this series */
    showEndpoints?: boolean;

    /** Draw auto-generated coordinate labels like "(4, 2)" at the endpoints */
    showEndpointLabels?: boolean;
}

export interface GraphFunctionSeries extends GraphSeriesBase {
    type: 'function';
    equation: string;

    /**
     * Optional plotting cap for this specific function series.
     * When omitted, the function spans the graph's visible x-domain.
     */
    xStart?: number;
    xEnd?: number;
}

export interface GraphPointsSeries extends GraphSeriesBase {
    type: 'points';
    points: GraphPoint[];
}

export interface GraphPolygon {
    points: GraphPoint[];
    fill?: boolean;
    stroke?: boolean;
}

export interface GraphLabel {
    x: number;
    y: number;
    text: string;
    offsetX?: number;
    offsetY?: number;
}

export interface GraphAngleMarker {
    vertex: GraphPoint;
    p1: GraphPoint;
    p2: GraphPoint;
    type: 'right';
}

export type GraphSeries = GraphFunctionSeries | GraphPointsSeries;

export interface GraphConfig {
    /** Explicit rendering preset for the graph surface */
    displayMode?: GraphDisplayMode;

    /** Shared graph styling, scaling mode, and viewport overrides */
    color?: GraphColor;
    scaleMode?: GraphScaleMode;
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;

    /** Ordered list of plotted series on the same graph */
    series?: GraphSeries[];

    /** Closed geometry overlays such as triangles or quadrilaterals */
    polygons?: GraphPolygon[];

    /** Explicit text labels anchored to graph coordinates */
    labels?: GraphLabel[];

    /** Geometry angle markers such as right-angle squares */
    angleMarkers?: GraphAngleMarker[];
}

/**
 * A single step in a multi-step question.
 * Steps are ordered by `index` (0, 1, 2, ...).
 */
export interface QuestionStep {
    /** Unique identifier for this step */
    id: string;

    /** 0-based display order (0 = first step) */
    index?: number;

    /** Step type - MCQ or True/False */
    type?: 'mcq' | 'true_false';

    /** Step heading/title (e.g., "Find the derivative") */
    title?: string;

    /** The actual question text for this step */
    prompt?: string;

    /** Optional SMILES string for a step-level skeletal/structure diagram */
    diagramSmiles?: string;

    /** Optional image URL for a step-level diagram */
    diagramImageUrl?: string;

    /**
     * Answer options.
     * - MCQ: 2–6 options
     * - True/False: exactly 2 options
     */
    options: string[];

    /** Index of correct option (0 <= correctAnswer < options.length) */
    correctAnswer: number;

    /** Time limit for this step in seconds (null = no limit) */
    timeLimitSeconds?: number | null;

    /** Points awarded for correct answer */
    marks?: number;

    /** Explanation shown after answering (null = no explanation) */
    explanation?: string | null;

    /**
     * Optional sub-steps inside this step.
     * - NOT extra steps/parts (still counts toward the same step)
     * - If present and ANY are failed, the whole step awards 0 marks (server enforces)
     */
    subSteps?: QuestionSubStep[];
}

/**
 * Optional sub-step inside a step.
 * Same answer shape as a normal step, but it awards no marks by itself.
 */
export interface QuestionSubStep {
    /** Sub-step type - MCQ or True/False */
    type: 'mcq' | 'true_false';

    /** The actual question text for the sub-step */
    prompt: string;

    /**
     * Answer options.
     * - MCQ: 2–6 options
     * - True/False: exactly 2 options
     */
    options: string[];

    /** Index of correct option (0 <= correctAnswer < options.length) */
    correctAnswer: number;

    /** Time limit for this sub-step in seconds (default: 5; null = no limit) */
    timeLimitSeconds: number | null;

    /** Explanation shown after answering (null = no explanation) */
    explanation: string | null;
}

/**
 * Complete question structure.
 * Can be single-step (steps.length === 1) or multi-step (steps.length > 1).
 */
export interface StepBasedQuestion {
    /** Unique identifier for this question */
    id: string;

    /** Question title/name */
    title: string;

    /** Subject area */
    subject: 'math' | 'physics' | 'chemistry';

    /** Chapter/topic (e.g., "Integration", "Kinematics") */
    chapter: string;

    /** Educational level */
    level: 'A1' | 'A2';

    /** Difficulty rating */
    difficulty: 'easy' | 'medium' | 'hard';

    /** Optional rank tier requirement */
    rankTier?: string;

    /** Main question context/setup/stem */
    stem?: string;

    /**
     * Time limit (seconds) for the main question phase (before steps begin).
     * Server-enforced; Admin-configurable; clamped to a safe range.
     */
    mainQuestionTimerSeconds?: number;

    /** Total marks (sum of all step marks) */
    totalMarks: number;

    /** Topic tags for filtering */
    topicTags: string[];

    /** Question steps - MUST be sorted by index (0..n) */
    steps: QuestionStep[];

    /** Optional question image URL */
    imageUrl?: string;

    /** Optional SMILES string for a main-question skeletal/structure diagram */
    structureSmiles?: string;

    /** Optional graph config (ONE graph per question) */
    graph?: GraphConfig;

    /**
     * Admin-controlled flag (stored in questions_v2.is_enabled).
     * When false, this question should be excluded from online battle selection.
     * Practice mode may still surface it (product choice).
     */
    isEnabled?: boolean;

    /**
     * Admin-controlled flag (stored in questions_v2.is_done).
     * When true, this question is marked as done in admin views.
     */
    isDone?: boolean;
}

function isFiniteNumber(n: any): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}

function isValidGraphPoint(obj: any): obj is GraphPoint {
    return !!obj && typeof obj === 'object' && isFiniteNumber(obj.x) && isFiniteNumber(obj.y);
}

function isValidGraphPolygon(obj: any): obj is GraphPolygon {
    if (!obj || typeof obj !== 'object') return false;
    if (!Array.isArray(obj.points) || obj.points.length < 3) return false;
    if (!obj.points.every((point: any) => isValidGraphPoint(point))) return false;
    if (obj.fill != null && typeof obj.fill !== 'boolean') return false;
    if (obj.stroke != null && typeof obj.stroke !== 'boolean') return false;
    if (obj.fill === false && obj.stroke === false) return false;
    return true;
}

function isValidGraphLabel(obj: any): obj is GraphLabel {
    if (!obj || typeof obj !== 'object') return false;
    if (!isFiniteNumber(obj.x) || !isFiniteNumber(obj.y)) return false;
    if (typeof obj.text !== 'string' || obj.text.trim().length === 0) return false;
    if (obj.offsetX != null && !isFiniteNumber(obj.offsetX)) return false;
    if (obj.offsetY != null && !isFiniteNumber(obj.offsetY)) return false;
    return true;
}

function isValidGraphAngleMarker(obj: any): obj is GraphAngleMarker {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.type !== 'right') return false;
    if (!isValidGraphPoint(obj.vertex)) return false;
    if (!isValidGraphPoint(obj.p1)) return false;
    if (!isValidGraphPoint(obj.p2)) return false;
    return true;
}

export function isValidGraphConfig(obj: any): obj is GraphConfig {
    if (!obj || typeof obj !== 'object') return false;

    const displayModeOk =
        obj.displayMode == null ||
        obj.displayMode === 'standard' ||
        obj.displayMode === 'aLevelSketch';
    if (!displayModeOk) return false;

    const scaleModeOk =
        obj.scaleMode == null ||
        obj.scaleMode === 'equalUnits' ||
        obj.scaleMode === 'fill';
    if (!scaleModeOk) return false;

    const colorOk =
        obj.color == null ||
        obj.color === 'white' ||
        obj.color === 'black';
    if (!colorOk) return false;

    const hasXMin = obj.xMin != null;
    const hasXMax = obj.xMax != null;
    const hasYMin = obj.yMin != null;
    const hasYMax = obj.yMax != null;

    if (hasXMin && !isFiniteNumber(obj.xMin)) return false;
    if (hasXMax && !isFiniteNumber(obj.xMax)) return false;
    if (hasYMin && !isFiniteNumber(obj.yMin)) return false;
    if (hasYMax && !isFiniteNumber(obj.yMax)) return false;
    if (hasXMin && hasXMax && obj.xMin >= obj.xMax) return false;
    if (hasYMin && hasYMax && obj.yMin >= obj.yMax) return false;

    if (obj.series != null && !Array.isArray(obj.series)) return false;
    if (obj.polygons != null && !Array.isArray(obj.polygons)) return false;
    if (obj.labels != null && !Array.isArray(obj.labels)) return false;
    if (obj.angleMarkers != null && !Array.isArray(obj.angleMarkers)) return false;

    const seriesOk = (obj.series ?? []).every((series: any) => {
        if (!series || typeof series !== 'object') return false;
        if (series.showEndpoints != null && typeof series.showEndpoints !== 'boolean') return false;
        if (series.showEndpointLabels != null && typeof series.showEndpointLabels !== 'boolean') return false;

        if (series.type === 'function') {
            const hasXStart = series.xStart != null;
            const hasXEnd = series.xEnd != null;
            if (hasXStart && !isFiniteNumber(series.xStart)) return false;
            if (hasXEnd && !isFiniteNumber(series.xEnd)) return false;
            if (hasXStart && hasXEnd && series.xStart >= series.xEnd) return false;
            return typeof series.equation === 'string' && series.equation.trim().length > 0;
        }

        if (series.type === 'points') {
            return (
                Array.isArray(series.points) &&
                series.points.length >= 2 &&
                series.points.every(
                    (p: any) => p && typeof p === 'object' && isFiniteNumber(p.x) && isFiniteNumber(p.y)
                )
            );
        }

        return false;
    });

    if (!seriesOk) return false;

    const polygonsOk = (obj.polygons ?? []).every((polygon: any) => isValidGraphPolygon(polygon));
    if (!polygonsOk) return false;

    const labelsOk = (obj.labels ?? []).every((label: any) => isValidGraphLabel(label));
    if (!labelsOk) return false;

    const angleMarkersOk = (obj.angleMarkers ?? []).every((marker: any) => isValidGraphAngleMarker(marker));
    if (!angleMarkersOk) return false;

    const hasRenderableGeometry =
        (Array.isArray(obj.series) && obj.series.length > 0) ||
        (Array.isArray(obj.polygons) && obj.polygons.length > 0) ||
        (Array.isArray(obj.labels) && obj.labels.length > 0) ||
        (Array.isArray(obj.angleMarkers) && obj.angleMarkers.length > 0);

    return hasRenderableGeometry;
}

/**
 * Type guard to validate if an object is a valid QuestionStep
 */
export function isValidQuestionStep(obj: any): obj is QuestionStep {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.id !== 'string') return false;
    if (typeof obj.index !== 'number') return false;
    if (obj.type !== 'mcq' && obj.type !== 'true_false') return false;
    if (typeof obj.title !== 'string') return false;
    if (typeof obj.prompt !== 'string') return false;

    if (!Array.isArray(obj.options) || !obj.options.every((o: any) => typeof o === 'string')) return false;
    const optionCount = obj.options.length;
    const optionCountOk = obj.type === 'true_false'
        ? optionCount === 2
        : optionCount >= 2 && optionCount <= 6;
    if (!optionCountOk) return false;

    if (typeof obj.correctAnswer !== 'number' || !Number.isInteger(obj.correctAnswer)) return false;
    if (obj.correctAnswer < 0 || obj.correctAnswer >= optionCount) return false;

    if (typeof obj.marks !== 'number') return false;

    if (obj.subSteps != null) {
        if (!Array.isArray(obj.subSteps)) return false;
        const isValidSub = (s: any) => {
            if (!s || typeof s !== 'object') return false;
            if (s.type !== 'mcq' && s.type !== 'true_false') return false;
            if (typeof s.prompt !== 'string') return false;
            if (!Array.isArray(s.options) || !s.options.every((o: any) => typeof o === 'string')) return false;
            const subCount = s.options.length;
            const subCountOk = s.type === 'true_false'
                ? subCount === 2
                : subCount >= 2 && subCount <= 6;
            if (!subCountOk) return false;
            if (typeof s.correctAnswer !== 'number' || !Number.isInteger(s.correctAnswer)) return false;
            if (s.correctAnswer < 0 || s.correctAnswer >= subCount) return false;
            return true;
        };
        if (!obj.subSteps.every(isValidSub)) return false;
    }

    return true;
}

/**
 * Type guard to validate if an object is a valid StepBasedQuestion
 */
export function isValidStepBasedQuestion(obj: any): obj is StepBasedQuestion {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.title === 'string' &&
        ['math', 'physics', 'chemistry'].includes(obj.subject) &&
        typeof obj.chapter === 'string' &&
        ['A1', 'A2'].includes(obj.level) &&
        ['easy', 'medium', 'hard'].includes(obj.difficulty) &&
        typeof obj.stem === 'string' &&
        typeof obj.totalMarks === 'number' &&
        Array.isArray(obj.topicTags) &&
        Array.isArray(obj.steps) &&
        obj.steps.length > 0 &&
        obj.steps.every(isValidQuestionStep) &&
        (obj.graph == null || isValidGraphConfig(obj.graph))
    );
}
