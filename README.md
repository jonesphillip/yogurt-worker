# Yogurt Worker

This repository contains the [Cloudflare Worker](https://developers.cloudflare.com/workers/) implementation for [Yogurt](https://github.com/jonesphillip/yogurt), a macOS notes app that enhances meeting notes by capturing and transcribing both system audio and microphone input.

The Worker handles audio transcription and note enhancement using [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/), providing two key endpoints that the Yogurt macOS app relies on.

## Features

- Real-time audio transcription using [whisper-large-v3-turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)
- Context-aware note enhancement using [llama-3.3-70b-instruct-fp8-fast](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- Zero data retention - processes data in-memory only
- Optional Cloudflare Access authentication support

## Requirements

- A Cloudflare account with Workers AI enabled
- Wrangler CLI (for development)

## API Endpoints

### POST /transcribe

Handles audio transcription requests.

**Input:**
- Raw audio data in WAV format
- Automatically filters out background noise using VAD (Voice Activity Detection)

**Output:**
```json
{
  "text": "Transcribed text content"
}
```

### POST /enhance

Processes and enhances meeting notes using transcript context.

**Input:**
```json
{
  "notes": "User's markdown notes",
  "transcript": "Meeting transcript"
}
```

**Output:**
- Server-sent events (SSE) stream
- Enhances notes using [prompt](https://github.com/jonesphillip/yorgurt-worker/blob/main/src/prompts.ts#L1)

## Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/jonesphillip/yogurt-worker.git
   cd yogurt-worker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Deploy to Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```

## Integration with Yogurt

To connect this worker with the Yogurt macOS app:

1. Deploy the worker to your Cloudflare account
2. Copy your worker's URL (e.g., `https://your-worker.username.workers.dev`)
3. Open Yogurt settings and paste the URL
4. (Optional) Add your Cloudflare Access service token if configured

## Development

For local development:

```bash
npx wrangler dev
```

This will start a local development server that you can use for testing.

## Security considerations

- Consider enabling Cloudflare Access for additional security
- The worker processes all data in-memory and does not persist any information
- Audio data is processed in chunks and immediately discarded

## Related projects

- [Yogurt](https://github.com/jonesphillip/yogurt) - The main macOS application
