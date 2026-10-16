import { fileURLToPath } from "url";
import path from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function getAssetPath(fileName: string) {
	return path.join(__dirname, "../assets", fileName);
}
