import type { Attributes } from "graphology-types";
import type { NodeHoverDrawingFunction } from "sigma/rendering";
import type { EdgeDisplayData, NodeDisplayData } from "sigma/types";

import accountIcon from "bootstrap-icons/icons/wallet-fill.svg?url";
import companyIcon from "bootstrap-icons/icons/buildings-fill.svg?url";
import loanIcon from "bootstrap-icons/icons/receipt-cutoff.svg?url";
import seedIcon from "bootstrap-icons/icons/pin-map-fill.svg?url";
import mediumIcon from "bootstrap-icons/icons/router-fill.svg?url";
import personIcon from "bootstrap-icons/icons/person-vcard-fill.svg?url";
import { useClientStore } from "../../store/ClientStore";

const DEFAULT_NODE_SIZE = 15;
const SEED_NODE_SIZE = 15;

type VisualNodeDisplayData = Partial<NodeDisplayData> & {
    image?: string;
    pictoColor?: string;
};

const nodeVisualsByType = {
    PERSON: { color: "#4da3ff", image: personIcon },
    COMPANY: { color: "#9b7cff", image: companyIcon },
    ACCOUNT: { color: "#3cc7d6", image: accountIcon },
    LOAN: { color: "#ffd166", image: loanIcon },
    MEDIUM: { color: "#8b95a7", image: mediumIcon },
} as const;

export const nodeIconByType = {
    PERSON: personIcon,
    COMPANY: companyIcon,
    ACCOUNT: accountIcon,
    LOAN: loanIcon,
    MEDIUM: mediumIcon,
} as const;

const LOW_RISK_COLOR = "#44c767";
const MEDIUM_RISK_COLOR = "#f2a93b";
const HIGH_RISK_COLOR = "#e15454";

const mediumRiskBucketByLevel = {
    "MINIMAL RISK": LOW_RISK_COLOR,
    "LOW RISK": LOW_RISK_COLOR,
    "MODERATE RISK": LOW_RISK_COLOR,
    "SIGNIFICANT RISK": MEDIUM_RISK_COLOR,
    "HIGH RISK": MEDIUM_RISK_COLOR,
    "VERY HIGH RISK": MEDIUM_RISK_COLOR,
    "SEVERE RISK": HIGH_RISK_COLOR,
    "CRITICAL RISK": HIGH_RISK_COLOR,
    "EXTREME RISK": HIGH_RISK_COLOR,
} as const;

const BLOCKED_NODE_COLOR = "#f3f5f7";
const BLOCKED_PICTO_COLOR = "#111827";
const DEFAULT_PICTO_COLOR = "rgba(238, 244, 255, 0.84)";
const SELECTED_EDGE_COLOR = "#6cff8f";
const DEFAULT_NODE_HOVER_BACKGROUND = "#FFF";
const DEFAULT_NODE_HOVER_SHADOW_COLOR = "#000";
const DEFAULT_NODE_HOVER_SHADOW_BLUR = 8;
const DEFAULT_NODE_HOVER_PADDING = 2;

const getClusterHighlightColor = (nodeId: unknown) => {
    if (typeof nodeId !== "string") return undefined;

    const {
        graphMode,
        clusterIdsByNodeId,
        clustersById,
        selectedClusterId,
    } = useClientStore.getState();

    if (graphMode !== "cluster") return undefined;

    const clusterIds = Array.from(clusterIdsByNodeId.get(nodeId) ?? []);
    if (clusterIds.length === 0) return undefined;

    if (selectedClusterId) {
        const selectedCluster = clustersById.get(selectedClusterId);
        if (selectedCluster && clusterIds.includes(selectedClusterId)) {
            return selectedCluster.activeColor;
        }
    }

    const cluster = clustersById.get(clusterIds[0]);
    return cluster?.color;
};

const getMediumRiskColor = (data: Attributes) => {
    const nestedAttributes = data.attributes as Record<string, unknown> | undefined;
    const rawRiskLevel = data.riskLevel ?? data.risk_level ?? nestedAttributes?.riskLevel ?? nestedAttributes?.risk_level;

    if (typeof rawRiskLevel === "string") {
        const normalizedRiskLevel = rawRiskLevel.toUpperCase();
        return mediumRiskBucketByLevel[normalizedRiskLevel as keyof typeof mediumRiskBucketByLevel];
    }

    if (typeof rawRiskLevel === "number") {
        if (rawRiskLevel >= 67) return HIGH_RISK_COLOR;
        if (rawRiskLevel >= 34) return MEDIUM_RISK_COLOR;
        return LOW_RISK_COLOR;
    }

    return undefined;
};

const isBlockedNode = (data: Attributes) => {
    const nestedAttributes = data.attributes as Record<string, unknown> | undefined;
    const statuses = Array.isArray(data.statuses)
        ? data.statuses.filter((status): status is string => typeof status === "string")
        : [];

    return data.isBlocked === true ||
        data.is_blocked === true ||
        data.isBlacklist === true ||
        data.is_blacklist === true ||
        nestedAttributes?.isBlocked === true ||
        nestedAttributes?.is_blocked === true ||
        nestedAttributes?.isBlacklist === true ||
        nestedAttributes?.is_blacklist === true ||
        statuses.includes("BLACKLIST");
};

export const graphNodeReducer = (_node: string, data: Attributes): VisualNodeDisplayData => {
    if (data.nodeId === "seedNode") {
        return {
            ...data,
            type: "pictogram",
            size: SEED_NODE_SIZE,
            color: "#7f8794",
            image: seedIcon,
            pictoColor: "rgba(238, 244, 255, 0.84)",
        };
    }

    const nodeType = typeof data.nodeType === "string" ? data.nodeType.toUpperCase() : undefined;
    const visual = nodeType ? nodeVisualsByType[nodeType as keyof typeof nodeVisualsByType] : undefined;
    const baseColor = visual?.color ?? "#7f8794";
    const defaultColor = nodeType === "MEDIUM" ? getMediumRiskColor(data) ?? baseColor : baseColor;
    const isBlocked = isBlockedNode(data);

    return {
        ...data,
        type: "pictogram",
        size: DEFAULT_NODE_SIZE,
        color: isBlocked ? BLOCKED_NODE_COLOR : defaultColor,
        image: visual?.image,
        pictoColor: isBlocked ? BLOCKED_PICTO_COLOR : DEFAULT_PICTO_COLOR,
    };
};

export const drawNodeHover: NodeHoverDrawingFunction = (context, data, settings) => {
    const { labelFont, labelSize, labelWeight } = settings;
    const clusterHighlightColor = getClusterHighlightColor((data as Attributes).nodeId);
    const backgroundColor = clusterHighlightColor ?? DEFAULT_NODE_HOVER_BACKGROUND;
    const shadowColor = clusterHighlightColor ?? DEFAULT_NODE_HOVER_SHADOW_COLOR;

    context.font = `${labelWeight} ${labelSize}px ${labelFont}`;
    context.fillStyle = backgroundColor;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.shadowBlur = clusterHighlightColor ? 14 : DEFAULT_NODE_HOVER_SHADOW_BLUR;
    context.shadowColor = shadowColor;

    if (typeof data.label === "string") {
        const textWidth = context.measureText(data.label).width;
        const boxWidth = Math.round(textWidth + 5);
        const boxHeight = Math.round(labelSize + 2 * DEFAULT_NODE_HOVER_PADDING);
        const radius = Math.max(data.size, labelSize / 2) + DEFAULT_NODE_HOVER_PADDING;
        const angleRadian = Math.asin(boxHeight / 2 / radius);
        const xDeltaCoord = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));

        context.beginPath();
        context.moveTo(data.x + xDeltaCoord, data.y + boxHeight / 2);
        context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
        context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
        context.lineTo(data.x + xDeltaCoord, data.y - boxHeight / 2);
        context.arc(data.x, data.y, radius, angleRadian, -angleRadian);
        context.closePath();
        context.fill();
    } else {
        context.beginPath();
        context.arc(data.x, data.y, data.size + DEFAULT_NODE_HOVER_PADDING, 0, Math.PI * 2);
        context.closePath();
        context.fill();
    }

    if (clusterHighlightColor) {
        context.strokeStyle = clusterHighlightColor;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(data.x, data.y, data.size + DEFAULT_NODE_HOVER_PADDING + 2, 0, Math.PI * 2);
        context.closePath();
        context.stroke();
    }

    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.shadowBlur = 0;

    if (!data.label) return;

    const labelColor = settings.labelColor.attribute
        ? data[settings.labelColor.attribute] ?? settings.labelColor.color ?? "#000"
        : settings.labelColor.color;

    context.fillStyle = String(labelColor);
    context.font = `${labelWeight} ${labelSize}px ${labelFont}`;
    context.fillText(data.label, data.x + data.size + 3, data.y + labelSize / 3);
};

export const graphEdgeReducer = (
    _edge: string,
    data: Attributes,
): Partial<EdgeDisplayData> => {
    const isHovered = data.hovered === true;
    const isSelected = data.selected === true;

    if (isHovered || isSelected) {
        return {
            ...data,
            color: SELECTED_EDGE_COLOR,
            size: 3,
        }} else {
        return {
            ...data
        }
    }
};
