export async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const url = "/api/generate-image";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt,
      apiKey: apiKey
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server Error: ${response.status}`);
  }

  const data = await response.json();
  if (data.image) {
    return `data:image/jpeg;base64,${data.image}`;
  }
  
  throw new Error("Failed to generate image: Invalid response format");
}
