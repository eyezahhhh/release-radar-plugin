import { fileURLToPath } from "url";
import path from "path";
import {
	AttributeType,
	AttributeValue,
	AttributeValues,
} from "@pipe-bomb/plugin-sdk";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function getAssetPath(fileName: string) {
	return path.join(__dirname, "../assets", fileName);
}

const TYPEOF_MAP: Record<AttributeType, string> = {
	boolean: "boolean",
	string: "string",
	integer: "number",
	decimal: "number",
	buffer: "object",
} as const;

export function getAttribute<T extends AttributeType>(
	attributes: AttributeValue[],
	key: string,
	type: T,
): AttributeValues[T] | null {
	for (const attribute of attributes) {
		if (attribute.key == key && typeof attribute.value == TYPEOF_MAP[type]) {
			return attribute.value as AttributeValues[T];
		}
	}

	return null;
}

export function getDiscoveryDate(attributes: AttributeValue[]) {
	const releaseTimestamp = getAttribute(
		attributes,
		"release_timestamp",
		"integer",
	);
	if (releaseTimestamp !== null) {
		return releaseTimestamp;
	}

	const releaseDate = getAttribute(attributes, "release_date", "string");
	if (releaseDate) {
		const date = new Date(releaseDate);
		console.log(date);
		return date.getTime();
	}
	return null;
}
