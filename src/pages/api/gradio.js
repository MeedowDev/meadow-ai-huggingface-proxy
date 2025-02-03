// pages/api/gradio.js
import { createClient } from "@gradio/client";

// Replace with your actual Gradio app URL
const gradioClient = createClient("https://huggingface.co/spaces/mark-kithinji/meadowai-crop-predictor");

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method Not Allowed" });
	}
	try {
		const { data } = req.body; // Expecting { data: [...] } from your app
        console.log("Data received: ", data);
		const prediction = await gradioClient.predict(data);
		res.status(200).json(prediction);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}
