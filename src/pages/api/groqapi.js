import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	try {
		console.log("Request received:", req.body);

		const { messages, model, temperature, max_completion_tokens, top_p, stop } = req.body;

		// Call Groq API with defaults where necessary
		const completion = await groq.chat.completions.create({
			messages,
			model: model || "llama-3.3-70b-versatile",
			temperature: temperature ?? 1,
			max_completion_tokens: max_completion_tokens ?? 1024,
			top_p: top_p ?? 1,
			stream: false, // No streaming for now
			stop: stop ?? null,
		});

		console.log("Response from Groq:", completion);
		res.status(200).json(completion.choices[0].message);
	} catch (error) {
		console.error("Error:", error);
		res.status(500).json({ error: error.message });
	}
}
