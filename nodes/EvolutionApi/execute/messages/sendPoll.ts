import {
	IExecuteFunctions,
	IRequestOptions,
	IHttpRequestMethods,
	NodeOperationError,
} from 'n8n-workflow';
import { evolutionRequest } from '../evolutionRequest';

export async function sendPoll(ef: IExecuteFunctions) {
	try {
		// Parâmetros obrigatórios
		const instanceName = ef.getNodeParameter('instanceName', 0);
		const remoteJid = ef.getNodeParameter('remoteJid', 0);
		const pollTitle = ef.getNodeParameter('caption', 0);
		const selectableCount = ef.getNodeParameter('selectableCount', 0) as number;
		const optionsInputType = ef.getNodeParameter('optionsInputType', 0) as string;

		// Opções adicionais
		const options_message = ef.getNodeParameter('options_message', 0, {}) as {
			delay?: number;
			quoted?: {
				messageQuoted: {
					messageId: string;
				};
			};
		};

		// Get poll options based on input type
		let pollOptions: string[] = [];

		if (optionsInputType === 'array') {
			const optionsArrayInput = ef.getNodeParameter('optionsArray', 0);

			if (optionsArrayInput) {
				// Handle if it's already an array (from expression)
				if (Array.isArray(optionsArrayInput)) {
					pollOptions = optionsArrayInput
						.map((item: any) => String(item).trim())
						.filter((item: string) => item !== '');
				} else {
					// Handle as string
					const trimmedInput = String(optionsArrayInput).trim();

					// Try to parse as JSON array first
					if (trimmedInput.startsWith('[')) {
						try {
							const parsed = JSON.parse(trimmedInput);
							if (Array.isArray(parsed)) {
								pollOptions = parsed
									.map((item: any) => String(item).trim())
									.filter((item: string) => item !== '');
							}
						} catch (e) {
							// If JSON parsing fails, treat as comma-separated
							pollOptions = trimmedInput
								.split(',')
								.map((item: string) => item.trim())
								.filter((item: string) => item !== '');
						}
					} else {
						// Treat as comma-separated values
						pollOptions = trimmedInput
							.split(',')
							.map((item: string) => item.trim())
							.filter((item: string) => item !== '');
					}
				}
			}
		} else {
			// Manual input mode
			const options = ef.getNodeParameter('options_display.metadataValues', 0) as {
				optionValue: string;
			}[];
			pollOptions = Array.isArray(options)
				? options.map((option) => option.optionValue).filter((item: string) => item !== '')
				: [];
		}

		// Remove duplicates
		pollOptions = [...new Set(pollOptions)];

		// Validate minimum 2 options
		if (pollOptions.length < 2) {
			const errorData = {
				success: false,
				error: {
					message: 'Invalid poll options',
					details: 'Poll must have at least 2 options',
					code: 'INVALID_POLL_OPTIONS',
					timestamp: new Date().toISOString(),
				},
			};
			return {
				json: errorData,
				error: errorData,
			};
		}

		// Validate maximum 12 options
		if (pollOptions.length > 12) {
			const errorData = {
				success: false,
				error: {
					message: 'Invalid poll options',
					details:
						'Poll cannot have more than 12 options. You provided ' +
						pollOptions.length +
						' options.',
					code: 'INVALID_POLL_OPTIONS',
					timestamp: new Date().toISOString(),
				},
			};
			return {
				json: errorData,
				error: errorData,
			};
		}

		// Validate selectableCount does not exceed number of options
		const validatedSelectableCount = Math.min(selectableCount, pollOptions.length);

		const body: any = {
			number: remoteJid,
			name: pollTitle,
			selectableCount: validatedSelectableCount,
			values: pollOptions,
		};

		// Adiciona delay se especificado
		if (options_message.delay) {
			body.delay = options_message.delay;
		}

		// Adiciona quoted se especificado
		if (options_message.quoted?.messageQuoted?.messageId) {
			body.quoted = {
				key: {
					id: options_message.quoted.messageQuoted.messageId,
				},
			};
		}

		const requestOptions: IRequestOptions = {
			method: 'POST' as IHttpRequestMethods,
			headers: {
				'Content-Type': 'application/json',
			},
			uri: `/message/sendPoll/${instanceName}`,
			body,
			json: true,
		};

		const response = await evolutionRequest(ef, requestOptions);
		return {
			json: {
				success: true,
				data: response,
			},
		};
	} catch (error) {
		const errorData = {
			success: false,
			error: {
				message: error.message.includes('Could not get parameter')
					? 'Parâmetros inválidos ou ausentes'
					: 'Erro ao enviar enquete',
				details: error.message.includes('Could not get parameter')
					? 'Verifique se todos os campos obrigatórios foram preenchidos corretamente'
					: error.message,
				code: error.code || 'UNKNOWN_ERROR',
				timestamp: new Date().toISOString(),
			},
		};

		if (!ef.continueOnFail()) {
			throw new NodeOperationError(ef.getNode(), error.message, {
				message: errorData.error.message,
				description: errorData.error.details,
			});
		}

		return {
			json: errorData,
			error: errorData,
		};
	}
}
