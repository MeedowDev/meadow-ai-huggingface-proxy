import { NextApiRequest, NextApiResponse } from "next";

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
	lat: string,
	lon: string,
	loc?: string
}

interface RequestBody {
	coordinates: Coordinate[],
	cookie: string
}



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method === "POST") {
		try {
			const { coordinates, cookie } = req.body as RequestBody;

			const successful: {location: Coordinate; data: any}[] = [];
			const failed: (Coordinate & {error: string})[] = [];
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
				console.warn("No cookie given, defaulting to default")
				// return res.status(400).json({ error: "Invalid input for cookie. 'cookie' must be a string and not empty", received: cookie });
			}else{
				defaultCookie = `${cookiePref}${cookie}`
			}

			const headers = {
				"Content-Type": "application/json",
				Origin: "https://selector.kalro.org",
				Cookie: defaultCookie,
			};

			const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
			
			for (const coord of coordinates) {
				await sleep	(300)
				console.log("Coord: ", coord)
				const { lat, lon, loc } = coord;
				if (typeof lat !== "string" || typeof lon !== "string") {
					failed.push({ ...coord, error: "Invalid latitude or longitude format" });
					// processed.push(coord);
					console.error(`Invalid lat: ${lat} or invalid lon: ${lon}`)
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

					if (!response.ok) {
						failed.push({ ...coord, error: `Request failed with status: ${response.status} - ${response.statusText}` });
						return res.status(401).json({
							error: "Request rejected by Karlo",
							successful_count: Object.keys(successful).length,
							unprocessed_coordinates: coordinates.filter(
								(coord) => !processed.some((p) => p.lat === coord.lat && p.lon === coord.lon)
							),
							failed_coordinates: failed,
							successful_data: successful,
						});
					}

					const data = await response.json();
					console.log(data)
					// successful[`${lat},${lon}`] = data;
					// const datum = 

					successful.push({
						location: payload,
						data: data.data
					})
				} catch (err) {
					failed.push({ ...coord, error: err.message });
				}
			}

			res.status(200).json({
				successful_count: Object.keys(successful).length,
				unprocessed_coordinates: coordinates.filter((coord) => !processed.some((p) => p.lat === coord.lat && p.lon === coord.lon)),
				failed_coordinates: failed,
				successful_data: successful,
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
