import type { Attributes } from "graphology-types";

export type HoveredNodeDetail = {
    label: string;
    value: string;
};

type DetailConfig = {
    label: string;
    keys: string[];
    format?: (value: unknown, attributes: Attributes) => string;
};

const DETAIL_CONFIG_BY_TYPE: Record<string, DetailConfig[]> = {
    PERSON: [
        { label: "City", keys: ["city"] },
        { label: "Country", keys: ["country"] },
        { label: "Gender", keys: ["gender"] },
    ],
    COMPANY: [
        { label: "Business", keys: ["business"] },
        { label: "City", keys: ["city"] },
        { label: "Country", keys: ["country"] },
    ],
    ACCOUNT: [
        { label: "Type", keys: ["type", "accountType", "account_type"] },
        { label: "Level", keys: ["accountLevel", "account_level"], format: formatNumber },
        { label: "Owner", keys: ["Owner", "owner"] },
    ],
    LOAN: [
        { label: "Amount", keys: ["loanAmount", "loan_amount"], format: formatNumber },
        { label: "Balance", keys: ["balance"], format: formatNumber },
    ],
    MEDIUM: [
        { label: "Type", keys: ["type", "mediumType", "medium_type"] },
        { label: "Risk", keys: ["riskLevel", "risk_level"] },
    ],
};

const nestedAttributes = (attributes: Attributes) => {
    return attributes.attributes as Record<string, unknown> | undefined;
};

const readAttribute = (attributes: Attributes, keys: string[]) => {
    const nested = nestedAttributes(attributes);
    for (const key of keys) {
        const value = attributes[key] ?? nested?.[key];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
};

function formatNumber(value: unknown) {
    return typeof value === "number" ? new Intl.NumberFormat("ru-RU").format(value) : String(value);
}

export const getHoveredNodeDetails = (attributes: Attributes): HoveredNodeDetail[] => {
    const nodeType = typeof attributes.nodeType === "string" ? attributes.nodeType.toUpperCase() : "";
    return (DETAIL_CONFIG_BY_TYPE[nodeType] ?? []).flatMap((detail) => {
        const value = readAttribute(attributes, detail.keys);
        if (value === undefined) return [];
        return [{ label: detail.label, value: detail.format ? detail.format(value, attributes) : String(value) }];
    });
};

export const getHoveredNodeStatuses = (attributes: Attributes) => {
    const statuses = Array.isArray(attributes.statuses)
        ? attributes.statuses.filter((status): status is string => typeof status === "string")
        : [];
    const nested = nestedAttributes(attributes);

    if (
        (
            attributes.isBlocked === true ||
            attributes.is_blocked === true ||
            attributes.isBlacklist === true ||
            attributes.is_blacklist === true ||
            nested?.isBlocked === true ||
            nested?.is_blocked === true ||
            nested?.isBlacklist === true ||
            nested?.is_blacklist === true
        ) &&
        !statuses.includes("BLACKLIST")
    ) {
        statuses.push("BLACKLIST");
    }
    if (nested?.isVip === true && !statuses.includes("VIP")) statuses.push("VIP");

    return statuses;
};
