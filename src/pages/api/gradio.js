import { Client } from "@gradio/client";

export default async function handler(req, res) {
	console.log("Request received: ", req.method);
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method Not Allowed" });
	}
	try {
		const client = await Client.connect("mark-kithinji/meadowai-crop-predictor");
		const result = await client.predict("/predict", req.body);
		res.status(200).json(result);
		
	} catch (error) {
		console.log("Error: ", error);
		res.status(500).json({ error: error.message });
	}
}
