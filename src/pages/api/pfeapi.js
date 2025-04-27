export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	try {
		console.log("Request received:", req.body);

		const { forecast, config } = req.body;

		// Validate input
		if (!forecast || !Array.isArray(forecast) || forecast.length === 0) {
			return res.status(400).json({ error: "Invalid forecast data. 'forecast' must be a non-empty array." });
		}

		// Send POST request using fetch
		const engineResponse = await fetch("https://pattern-fitting-algorithm.onrender.com/run-engine", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ forecast, config }),
		});

		// If the Pattern Fitting Engine returns an error
		if (!engineResponse.ok) {
			const errorData = await engineResponse.json();
			return res.status(engineResponse.status).json(errorData);
		}

		// Successful response
		const responseData = await engineResponse.json();
		console.log("Response from Pattern Fitting Engine:", responseData);
		return res.status(200).json(responseData);
	} catch (error) {
		console.error("Error proxying to Pattern Fitting Engine:", error.message);
		res.status(500).json({ error: error.message });
	}
}
