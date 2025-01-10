import { Buffer } from 'node:buffer';
import { ENHANCE_NOTES_SYSTEM } from './prompts';

interface EnhanceRequestBody {
	notes: string;
	transcript: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/transcribe' && request.method === 'POST') {
			const audioBuffer = await request.arrayBuffer();
			const buffer = Buffer.from(audioBuffer);

			const input = {
				audio: buffer.toString('base64'),
				task: 'transcribe',
				vad_filter: 'true',
				language: 'en',
			};

			try {
				const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', input);
				return Response.json(result);
			} catch (e) {
				console.log('Error calling AI: ' + (e as Error).message);
				return new Response('Error calling AI: ' + (e as Error).message, { status: 500 });
			}
		}

		if (url.pathname === '/enhance' && request.method === 'POST') {
			const { notes, transcript } = (await request.json()) as EnhanceRequestBody;

			const messages = [
				{
					role: 'system',
					content: ENHANCE_NOTES_SYSTEM,
				},
				{
					role: 'user',
					content: `User's notes:\n${notes}\n\nTranscript:\n${transcript}\n\nPlease produce a revised or refined version of the notes. Do not include your own commentary.`,
				},
			];

			const responseStream = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
				messages,
				stream: true,
				max_tokens: 500,
				temperature: 0.6,
			});

			return new Response(responseStream, {
				headers: { 'content-type': 'text/event-stream' },
			});
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
