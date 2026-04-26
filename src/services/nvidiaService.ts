export async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const seed = Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(prompt);
  // Using Pollinations AI for fast, robust, and free image generation. Using the flux model for superior text and anatomy generation.
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Image generation error:", error);
    throw new Error("Failed to generate image. Please try again.");
  }
}
