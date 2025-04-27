import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { promisify } from "util";

/**
 * Sample request:
 * 
 {
    "coordinates": [
        {
            "lat": "0.032552",
            "lon": "37.676013",
            "loc": "0"
        }
    ]
}

{
    "coordinates": [
        {
            "lat": "0.032552",
            "lon": "37.676013",
            "loc": "0"
        }
    ],
    "cookie": "Cm92jt2ZYl1xYiCcgpMQ3mnvFZLOhzbC"
}
 */

interface Coordinate {
	lat: string;
	lon: string;
	loc?: string;
}

interface RequestBody {
	coordinates: Coordinate[];
	cookie: string;
}

interface ProcessedCoordinate {
	location: Coordinate;
	data: any; // Using any for the API response data
}

// Convert fs functions to Promise-based versions
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method === "POST") {
		try {
			const { coordinates, cookie } = req.body as RequestBody;

			const successful: { location: Coordinate; data: any }[] = [];
			const failed: (Coordinate & { error: string })[] = [];
			const processed: Coordinate[] = [];
			const cookiePref = "csrftoken=";
			let defaultCookie = `${cookiePref}GA1.1.1976615837.1741062447`;

			if (!Array.isArray(coordinates)) {
				return res.status(400).json({
					error: "Invalid input for coordinates. 'coordinates' must be an array of objects and not empty",
					received: coordinates,
				});
			}

			if (!cookie) {
				console.warn("No cookie given, defaulting to default");
			} else {
				defaultCookie = `${cookiePref}${cookie}`;
			}

			// Create data directory if it doesn't exist
			const dataDir = path.join(process.cwd(), "data");
			if (!(await existsAsync(dataDir))) {
				await mkdirAsync(dataDir, { recursive: true });
			}

			// Generate timestamp for filenames (down to minutes)
			const now = new Date();
			const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);

			// Filename for the main data export
			const exportFilename = path.join(dataDir, `crop_data_${timestamp}.json`);

			// Filename for the coordination file (to track processed coordinates)
			const coordinationFilename = path.join(dataDir, "processed_coordinates.json");

			// Create or load the coordination file
			let processedCoordinates: Record<string, boolean> = {};
			try {
				if (await existsAsync(coordinationFilename)) {
					const data = await readFileAsync(coordinationFilename, "utf8");
					processedCoordinates = JSON.parse(data);
				} else {
					await writeFileAsync(coordinationFilename, JSON.stringify({}), "utf8");
				}
			} catch (err) {
				console.error("Error handling coordination file:", err);
				// Continue execution even if coordination file fails
			}

			const headers = {
				"Content-Type": "application/json",
				Origin: "https://selector.kalro.org",
				Cookie: defaultCookie,
			};

			const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

			// Function to safely update the coordination file
			const updateCoordinationFile = async (coord: Coordinate) => {
				try {
					const coordKey = `${coord.lat},${coord.lon}`;
					processedCoordinates[coordKey] = true;

					// Use a write lock approach by writing to a temp file first
					const tempFile = `${coordinationFilename}.temp`;
					await writeFileAsync(tempFile, JSON.stringify(processedCoordinates), "utf8");

					// Then rename (atomic operation in most file systems)
					fs.renameSync(tempFile, coordinationFilename);
				} catch (err) {
					console.error("Failed to update coordination file:", err);
					// Continue execution even if update fails
				}
			};

			// Function to save a result to the export file
			const saveResultToFile = async (result: ProcessedCoordinate) => {
				console.log("saveResultToFile called");
				try {
					// Create the file with initial array structure if it doesn't exist
					if (!(await existsAsync(exportFilename))) {
						console.log("creating file: ", exportFilename)
						await writeFileAsync(exportFilename, JSON.stringify([result], null, 2), "utf8");
						return;
					}

					// Otherwise read current content, append, and write back
					// This approach is not ideal for many concurrent writes, but works for this use case
					const currentContent = await readFileAsync(exportFilename, "utf8");
					let data = [];
					try {
						data = JSON.parse(currentContent);
						if (!Array.isArray(data)) data = [];
					} catch (e) {
						// If file is corrupted, start fresh
						data = [];
					}
					console.log("updating data")
					data.push(result);
					await writeFileAsync(exportFilename, JSON.stringify(data, null, 2), "utf8");
				} catch (err) {
					console.error(`Failed to save result to ${exportFilename}:`, err);
				}
			};

			// Filter out already processed coordinates
			const filteredCoordinates = coordinates.filter((coord) => {
				const coordKey = `${coord.lat},${coord.lon}`;
				return !processedCoordinates[coordKey];
			});

			console.log(
				`Processing ${filteredCoordinates.length} coordinates out of ${coordinates.length} (${
					coordinates.length - filteredCoordinates.length
				} already processed)`
			);

			// Process each coordinate
			for (const coord of filteredCoordinates) {
				await sleep(200); // Reduced to 200ms as requested
				console.log("Processing coordinate:", coord);

				const { lat, lon, loc } = coord;
				const coordKey = `${lat},${lon}`;

				// Skip if already processed (double-check)
				if (processedCoordinates[coordKey]) {
					console.log(`Skipping already processed coordinate: ${coordKey}`);
					continue;
				}

				const payload: Coordinate = {
					lat: lat,
					lon: lon,
					loc: loc ? loc : "0",
				};

				try {
					const response = await fetch("https://selector.kalro.org/cropselapi", {
						method: "POST",
						headers: headers,
						body: JSON.stringify(payload),
					});

					processed.push(coord);

					// Mark as processed even if it fails
					await updateCoordinationFile(coord);

					if (!response.ok) {
						failed.push({ ...coord, error: `Request failed with status: ${response.status} - ${response.statusText}` });
						continue;
					}

					const data = await response.json();
					console.log(`Successful response for ${coordKey}`);

					const result = {
						location: payload,
						data: data.data,
					};

					successful.push(result);

					// Save this result to the export file
					await saveResultToFile(result);
				} catch (err) {
					const error = err as Error;
					console.error(`Error processing ${coordKey}:`, error);
					failed.push({ ...coord, error: error.message });

					// Still mark as processed to avoid retrying failed coordinates
					await updateCoordinationFile(coord);
				}
			}

			res.status(200).json({
				successful_count: successful.length,
				total_processed: filteredCoordinates.length,
				skipped_coordinates: coordinates.length - filteredCoordinates.length,
				failed_coordinates: failed,
				successful_data: successful,
				export_filename: exportFilename,
			});
		} catch (error) {
			console.error("Error processing coordinates: ", error);
			res.status(500).json({ error: "Failed to process the provided coordinates" });
		}
	} else {
		res.setHeader("Allow", ["POST"]);
		res.status(405).end(`Method ${req.method} Not Allowed`);
	}
}
