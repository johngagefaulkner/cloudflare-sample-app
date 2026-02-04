/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import {
  AWW_COMMAND,
  GENERATE_IMAGE_COMMAND,
  INVITE_COMMAND,
} from './commands.js';
import { getCuteUrl } from './reddit.js';
import { InteractionResponseFlags } from 'discord-interactions';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = AutoRouter();
const GENERATE_IMAGE_MODAL_ID = 'generate_image_modal';
const NANO_BANANA_SPEC = {
  model: {
    label: 'Model',
    type: 'select',
    options: [
      {
        label: 'Gemini Nano Banana 3 Pro',
        value: 'gemini-nano-banana-3-pro',
      },
    ],
  },
  prompt: {
    label: 'Prompt',
    type: 'text',
    style: 2,
    placeholder: 'Describe the image you want to generate.',
  },
  negativePrompt: {
    label: 'Negative prompt',
    type: 'text',
    style: 2,
    required: false,
    placeholder: 'Optional: what should the model avoid?',
  },
  aspectRatio: {
    label: 'Aspect ratio',
    type: 'select',
    options: [
      { label: '1:1 (Square)', value: '1:1' },
      { label: '4:3 (Landscape)', value: '4:3' },
      { label: '3:4 (Portrait)', value: '3:4' },
      { label: '16:9 (Widescreen)', value: '16:9' },
      { label: '9:16 (Tall)', value: '9:16' },
    ],
  },
  imageSize: {
    label: 'Image size',
    type: 'select',
    options: [
      { label: '512 x 512', value: '512x512' },
      { label: '768 x 768', value: '768x768' },
      { label: '1024 x 1024', value: '1024x1024' },
    ],
  },
  outputFormat: {
    label: 'Output format',
    type: 'select',
    options: [
      { label: 'PNG', value: 'png' },
      { label: 'JPEG', value: 'jpeg' },
      { label: 'WEBP', value: 'webp' },
    ],
  },
  steps: {
    label: 'Steps',
    type: 'text',
    style: 1,
    placeholder: 'e.g. 30',
  },
  guidance: {
    label: 'Guidance scale',
    type: 'text',
    style: 1,
    placeholder: 'e.g. 7.5',
  },
  seed: {
    label: 'Seed',
    type: 'text',
    style: 1,
    required: false,
    placeholder: 'Optional seed value',
  },
  numImages: {
    label: 'Number of images',
    type: 'text',
    style: 1,
    placeholder: 'e.g. 1',
  },
  safetyFilter: {
    label: 'Safety filter',
    type: 'select',
    options: [
      { label: 'Enabled', value: 'true' },
      { label: 'Disabled', value: 'false' },
    ],
  },
  promptEnhancement: {
    label: 'Prompt enhancement',
    type: 'select',
    options: [
      { label: 'Enabled', value: 'true' },
      { label: 'Disabled', value: 'false' },
    ],
  },
};

const MODAL_COMPONENT_TYPES = {
  ACTION_ROW: 1,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
};

function buildSelectComponent({ customId, label, options }) {
  return {
    type: MODAL_COMPONENT_TYPES.ACTION_ROW,
    components: [
      {
        type: MODAL_COMPONENT_TYPES.STRING_SELECT,
        custom_id: customId,
        placeholder: label,
        min_values: 1,
        max_values: 1,
        options,
      },
    ],
  };
}

function buildTextComponent({
  customId,
  label,
  style,
  required = true,
  placeholder,
}) {
  return {
    type: MODAL_COMPONENT_TYPES.ACTION_ROW,
    components: [
      {
        type: MODAL_COMPONENT_TYPES.TEXT_INPUT,
        custom_id: customId,
        label,
        style,
        required,
        placeholder,
      },
    ],
  };
}

function buildGenerateImageModal() {
  const components = [
    buildSelectComponent({
      customId: 'model',
      label: NANO_BANANA_SPEC.model.label,
      options: NANO_BANANA_SPEC.model.options,
    }),
    buildTextComponent({
      customId: 'prompt',
      label: NANO_BANANA_SPEC.prompt.label,
      style: NANO_BANANA_SPEC.prompt.style,
      placeholder: NANO_BANANA_SPEC.prompt.placeholder,
    }),
    buildTextComponent({
      customId: 'negative_prompt',
      label: NANO_BANANA_SPEC.negativePrompt.label,
      style: NANO_BANANA_SPEC.negativePrompt.style,
      required: NANO_BANANA_SPEC.negativePrompt.required,
      placeholder: NANO_BANANA_SPEC.negativePrompt.placeholder,
    }),
    buildSelectComponent({
      customId: 'aspect_ratio',
      label: NANO_BANANA_SPEC.aspectRatio.label,
      options: NANO_BANANA_SPEC.aspectRatio.options,
    }),
    buildSelectComponent({
      customId: 'image_size',
      label: NANO_BANANA_SPEC.imageSize.label,
      options: NANO_BANANA_SPEC.imageSize.options,
    }),
    buildSelectComponent({
      customId: 'output_format',
      label: NANO_BANANA_SPEC.outputFormat.label,
      options: NANO_BANANA_SPEC.outputFormat.options,
    }),
    buildTextComponent({
      customId: 'steps',
      label: NANO_BANANA_SPEC.steps.label,
      style: NANO_BANANA_SPEC.steps.style,
      placeholder: NANO_BANANA_SPEC.steps.placeholder,
    }),
    buildTextComponent({
      customId: 'guidance',
      label: NANO_BANANA_SPEC.guidance.label,
      style: NANO_BANANA_SPEC.guidance.style,
      placeholder: NANO_BANANA_SPEC.guidance.placeholder,
    }),
    buildTextComponent({
      customId: 'seed',
      label: NANO_BANANA_SPEC.seed.label,
      style: NANO_BANANA_SPEC.seed.style,
      required: NANO_BANANA_SPEC.seed.required,
      placeholder: NANO_BANANA_SPEC.seed.placeholder,
    }),
    buildTextComponent({
      customId: 'num_images',
      label: NANO_BANANA_SPEC.numImages.label,
      style: NANO_BANANA_SPEC.numImages.style,
      placeholder: NANO_BANANA_SPEC.numImages.placeholder,
    }),
    buildSelectComponent({
      customId: 'safety_filter',
      label: NANO_BANANA_SPEC.safetyFilter.label,
      options: NANO_BANANA_SPEC.safetyFilter.options,
    }),
    buildSelectComponent({
      customId: 'prompt_enhancement',
      label: NANO_BANANA_SPEC.promptEnhancement.label,
      options: NANO_BANANA_SPEC.promptEnhancement.options,
    }),
  ];

  return {
    custom_id: GENERATE_IMAGE_MODAL_ID,
    title: 'Generate an image',
    components,
  };
}

function collectModalValues(components = []) {
  return components.reduce((acc, row) => {
    if (!row?.components) {
      return acc;
    }
    row.components.forEach((component) => {
      if (component.type === MODAL_COMPONENT_TYPES.TEXT_INPUT) {
        acc[component.custom_id] = component.value ?? '';
      }
      if (
        component.type === MODAL_COMPONENT_TYPES.STRING_SELECT &&
        Array.isArray(component.values)
      ) {
        [acc[component.custom_id]] = component.values;
      }
    });
    return acc;
  }, {});
}

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case AWW_COMMAND.name.toLowerCase(): {
        const cuteUrl = await getCuteUrl();
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: cuteUrl,
          },
        });
      }
      case INVITE_COMMAND.name.toLowerCase(): {
        const applicationId = env.DISCORD_APPLICATION_ID;
        const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: INVITE_URL,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
      case GENERATE_IMAGE_COMMAND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.MODAL,
          data: buildGenerateImageModal(),
        });
      }
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    if (interaction.data.custom_id === GENERATE_IMAGE_MODAL_ID) {
      const values = collectModalValues(interaction.data.components);
      const summary = [
        `Model: ${values.model ?? 'unknown'}`,
        `Prompt: ${values.prompt ?? ''}`,
        `Negative prompt: ${values.negative_prompt ?? ''}`,
        `Aspect ratio: ${values.aspect_ratio ?? ''}`,
        `Image size: ${values.image_size ?? ''}`,
        `Output format: ${values.output_format ?? ''}`,
        `Steps: ${values.steps ?? ''}`,
        `Guidance: ${values.guidance ?? ''}`,
        `Seed: ${values.seed ?? ''}`,
        `Number of images: ${values.num_images ?? ''}`,
        `Safety filter: ${values.safety_filter ?? ''}`,
        `Prompt enhancement: ${values.prompt_enhancement ?? ''}`,
      ]
        .filter(Boolean)
        .join('\n');

      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `✅ Image generation request received:\n${summary}`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;
