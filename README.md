# NavyAI Extras API

A high-performance SillyTavern Extras server powered by [NavyAI](https://api.navy)  for your SillyTavern instance.

## Features

- 🎨 **Image Generation** - Create images using Flux and other models
- 🎤 **Speech-to-Text** - Transcribe audio with Whisper
- 📝 **Text Summarization** - Summarize conversations and content
- 🖼️ **Image Captioning** - Describe images with vision models
- 😊 **Text Classification** - Classify emotions and sentiments
- 🔢 **Text Embeddings** - Generate embeddings for semantic search

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [NavyAI API key](https://api.navy) (get one for free!)
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) instance

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/api-navy/NavyAI-ExtrasAPI
   cd NavyAI-ExtrasAPI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the server**
   
   Edit `config.json` and add your NavyAI API key:
   
   ```json
   {
     "navy": {
       "apiKey": "YOUR_NAVY_API_KEY_HERE"
     }
   }
   ```

4. **Start the server**
   ```bash
   npm start
   ```

   The server will start on `http://localhost:5100` by default.

## Configuration

Edit `config.json` to customize your setup:

### Server Settings

```json
{
  "server": {
    "port": 5100,
    "listen": false,
    "publicTunnel": false,
    "apiKey": ""
  }
}
```

- **`port`** - Port number to run the server on (default: `5100`)
- **`listen`** - Set to `true` to listen on all network interfaces (`0.0.0.0`), `false` for localhost only
- **`publicTunnel`** - Enable public tunnel via localtunnel for remote access (default: `false`)
- **`apiKey`** - Optional API key to protect your server (leave empty to disable)

### NavyAI Settings

```json
{
  "navy": {
    "apiKey": "YOUR_NAVY_API_KEY_HERE",
    "apiEndpoint": "https://api.navy/v1",
    "models": {
      "image": "flux.1-schnell",
      "whisper": "whisper-1",
      "summarization": "gemini-2.5-flash-lite",
      "classification": "gemini-2.5-flash-lite",
      "captioning": "gemini-2.5-flash-lite",
      "embedding": "text-embedding-3-small"
    }
  }
}
```

- **`apiKey`** - Your NavyAI API key (required)
- **`apiEndpoint`** - NavyAI API endpoint (default: `https://api.navy/v1`)
- **`models`** - Configure which models to use for each feature

### Module Management

Disable specific modules by adding them to the `disabled` array:

```json
{
  "modules": {
    "disabled": ["sd", "whisper-stt"]
  }
}
```

Available modules:
- `sd` - Image generation
- `whisper-stt` - Speech-to-text
- `summarize` - Text summarization
- `caption` - Image captioning
- `classify` - Text classification
- `embeddings` - Text embeddings

### Custom Prompts

Customize the prompts used for classification, summarization, and captioning:

```json
{
  "prompts": {
    "classification": {
      "instruction": "Your custom classification instruction",
      "labels": ["joy", "anger", "sadness", "fear", "love"]
    },
    "summarization": "Your custom summarization prompt",
    "captioning": "Your custom captioning prompt"
  }
}
```

## Connecting to SillyTavern

1. Open SillyTavern
2. Go to **Extensions** → **Extras API**.
3. Set the API URL to: `http://localhost:5100` (or your public tunnel URL)
4. If you set an API key, enter it in the authentication field
5. Connect to the API

## Public Access

### Built-in Public Tunnel (Recommended)
The server includes a built-in public tunnel via localtunnel, enabled by default. When you start the server, you'll see:

```
NavyAI Extras API is running on http://localhost:5100
Public tunnel is running on https://your-unique-url.loca.lt
```

Use the public tunnel URL to connect from anywhere. Before accessing it, you must first unlock the tunnel by visiting the URL in a web browser and entering the tunnel password. The tunnel password is the IP address of the server where it's running.

### Alternative: Listen on Network
Set `"listen": true` in config to allow connections from your local network. Access via `http://YOUR_IP:5100`

### Alternative: Reverse Proxy
Use nginx, Caddy, or Cloudflare Tunnel for production deployments.

## API Endpoints

- `GET /` - Health check
- `GET /api/modules` - List available modules
- `POST /api/image` - Generate images
- `POST /api/speech-recognition/whisper/process-audio` - Transcribe audio
- `POST /api/summarize` - Summarize text
- `POST /api/caption` - Caption images
- `POST /api/classify` - Classify text emotions
- `POST /api/embeddings/compute` - Generate embeddings

## Troubleshooting

### Server won't start
- Check if port 5100 is already in use
- Verify Node.js version is 18 or higher
- Ensure all dependencies are installed (`npm install`)

### API errors
- Verify your NavyAI API key is correct in `config.json`
- Check your internet connection
- Ensure you have sufficient API credits

### SillyTavern can't connect
- Verify the server is running
- Check the URL in SillyTavern matches your server address
- If using an API key, ensure it's entered correctly in SillyTavern
- Try using the public tunnel URL if localhost doesn't work

### Public tunnel issues
- If the tunnel URL doesn't work, try restarting the server
- Set `"publicTunnel": false` if you don't need remote access

## Support

- 🐛 [Report Issues](https://github.com/api-navy/NavyAI-ExtrasAPI/issues)
- 💬 [NavyAI Discord](https://discord.api.navy/)
- 📖 [NavyAI Documentation](https://api.navy/docs/)