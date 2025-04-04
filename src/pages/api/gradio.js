import { Client } from "@gradio/client";
export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method Not Allowed" });
	}
	try {
		console.log("Data fed to Gradio: ", req.body);
		const client = await Client.connect("mark-kithinji/meadowai-crop-predictor");
		const result = await client.predict("/predict", { input_json_str: JSON.stringify(req.body) }0);
		res.status(200).json(result);
		
	} catch (error) {
		console.log("Error: ", error);
		res.status(500).json({ error: error.message });
	}
}
