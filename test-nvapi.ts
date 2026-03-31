const apiKey = "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";
fetch("https://ai.api.nvidia.com/v1/images/generations", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  body: JSON.stringify({
    model: "stabilityai/stable-diffusion-3-medium",
    prompt: "A cat",
    response_format: "b64_json"
  })
}).then(res => res.json()).then(data => console.log(Object.keys(data), data.data ? Object.keys(data.data[0]) : data)).catch(console.error);
