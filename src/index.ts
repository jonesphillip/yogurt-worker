import { Buffer } from 'node:buffer';
import {
	TRANSCRIPT_NOTES_PROMPT_SYSTEM,
	TRANSCRIPT_NOTES_PROMPT_USER,
	POINTS_OF_EMPHASIS_PROMPT_SYSTEM,
	POINTS_OF_EMPHASIS_PROMPT_USER,
	ACTION_ITEMS_PROMPT_SYSTEM,
	ACTION_ITEMS_PROMPT_USER,
	FINAL_NOTES_PROMPT_SYSTEM,
	FINAL_NOTES_PROMPT_USER,
} from './prompts';

interface TranscriptionNotesRequestBody {
	transcript: string;
}

interface EmphasisRequestBody {
	userNotes: string;
	transcriptNotes: string;
}

interface ActionItemsRequestBody {
	transcriptNotes: string;
	userNotes: string;
}

interface FinalNotesRequestBody {
	userNotes: string;
	transcriptNotes: string;
	pointsOfEmphasis: string;
	actionItems: string;
}

interface LLMMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface TranscriptionResponse {
	text: string;
}

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// LLM model configuration
const LLM_CONFIG = {
	model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as keyof AiModels,
	options: {
		stream: true,
		max_tokens: 2000,
		temperature: 0.6,
		top_p: 0.9,
		frequency_penalty: 0.3,
		presence_penalty: 0.3,
	},
};

/**
 * Error handling utility
 */
function handleError(error: unknown, errorMessage: string): Response {
	console.error(`${errorMessage}: ${(error as Error).message}`);
	return Response.json(
		{
			error: errorMessage,
			details: (error as Error).message,
		},
		{
			status: 500,
			headers: corsHeaders,
		},
	);
}

/**
 * Validates request JSON and returns parsed data or throws an error
 */
async function validateJsonRequest<T extends Record<string, any>>(request: Request, requiredFields: string[]): Promise<T> {
	try {
		const data = (await request.json()) as T;

		// Check for required fields
		for (const field of requiredFields) {
			if (!(field in data)) {
				throw new Error(`Missing required field: ${field}`);
			}
		}

		return data;
	} catch (e) {
		throw new Error(`Invalid request format: ${(e as Error).message}`);
	}
}

/**
 * Helper function to interact with LLM calls
 */
async function callLLM(env: Env, systemPrompt: string, userPrompt: string, replacements: Record<string, string> = {}): Promise<any> {
	// Apply all replacements to the user prompt
	let processedPrompt = userPrompt;
	for (const [key, value] of Object.entries(replacements)) {
		processedPrompt = processedPrompt.replace(`{${key}}`, value);
	}

	const messages: LLMMessage[] = [
		{
			role: 'system',
			content: systemPrompt,
		},
		{
			role: 'user',
			content: processedPrompt,
		},
	];

	return await env.AI.run(LLM_CONFIG.model, {
		messages,
		...LLM_CONFIG.options,
	});
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		try {
			// TRANSCRIBE ENDPOINT
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
					const result = (await env.AI.run('@cf/openai/whisper-large-v3-turbo', input)) as TranscriptionResponse;
					return Response.json(result);
				} catch (e) {
					return handleError(e, 'Error during audio transcription');
				}
			}

			// TRANSCRIPTION NOTES ENDPOINT
			if (url.pathname === '/transcription-notes' && request.method === 'POST') {
				try {
					const { transcript } = await validateJsonRequest<TranscriptionNotesRequestBody>(request, ['transcript']);

					const responseStream = await callLLM(env, TRANSCRIPT_NOTES_PROMPT_SYSTEM, TRANSCRIPT_NOTES_PROMPT_USER, { transcript });

					return new Response(responseStream, {
						headers: { ...corsHeaders, 'content-type': 'text/event-stream' },
					});
				} catch (e) {
					return handleError(e, 'Error generating transcript notes');
				}
			}

			// POINTS OF EMPHASIS ENDPOINT (compare user notes and transcript notes)
			if (url.pathname === '/points-of-emphasis' && request.method === 'POST') {
				try {
					const { userNotes, transcriptNotes } = await validateJsonRequest<EmphasisRequestBody>(request, ['userNotes', 'transcriptNotes']);

					const responseStream = await callLLM(env, POINTS_OF_EMPHASIS_PROMPT_SYSTEM, POINTS_OF_EMPHASIS_PROMPT_USER, {
						userNotes,
						transcriptNotes,
					});

					return new Response(responseStream, {
						headers: { ...corsHeaders, 'content-type': 'text/event-stream' },
					});
				} catch (e) {
					return handleError(e, 'Error generating points of emphasis');
				}
			}

			// ACTION ITEMS ENDPOINT
			if (url.pathname === '/action-items' && request.method === 'POST') {
				try {
					const { transcriptNotes, userNotes } = await validateJsonRequest<ActionItemsRequestBody>(request, [
						'transcriptNotes',
						'userNotes',
					]);

					const responseStream = await callLLM(env, ACTION_ITEMS_PROMPT_SYSTEM, ACTION_ITEMS_PROMPT_USER, { transcriptNotes, userNotes });

					return new Response(responseStream, {
						headers: { ...corsHeaders, 'content-type': 'text/event-stream' },
					});
				} catch (e) {
					return handleError(e, 'Error extracting action items');
				}
			}

			// FINAL ENHANCED NOTES ENDPOINT
			if (url.pathname === '/final-notes' && request.method === 'POST') {
				try {
					const { userNotes, transcriptNotes, pointsOfEmphasis, actionItems } = await validateJsonRequest<FinalNotesRequestBody>(request, [
						'userNotes',
						'transcriptNotes',
						'pointsOfEmphasis',
						'actionItems',
					]);

					const responseStream = await callLLM(env, FINAL_NOTES_PROMPT_SYSTEM, FINAL_NOTES_PROMPT_USER, {
						userNotes,
						transcriptNotes,
						pointsOfEmphasis,
						actionItems,
					});

					return new Response(responseStream, {
						headers: { ...corsHeaders, 'content-type': 'text/event-stream' },
					});
				} catch (e) {
					return handleError(e, 'Error finalizing notes');
				}
			}

			// If no matching route
			return Response.json({ error: 'Not Found', message: 'The requested endpoint does not exist' }, { status: 404, headers: corsHeaders });
		} catch (e) {
			return handleError(e, 'Unexpected error');
		}
	},
} satisfies ExportedHandler<Env>;
