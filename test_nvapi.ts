const apiKey = "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";
fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "OPTIONS",
  headers: {
    "Origin": "http://localhost:3000",
    "Access-Control-Request-Method": "POST",
  }
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
}).catch(console.error);
