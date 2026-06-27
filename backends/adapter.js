// Backend dispatch. Adding a provider = one new module + one branch here;
// the rest of the app only ever calls generate({ backend, ... }).

import { generateGemini } from "./gemini.js";
import { generateLocalhost } from "./localhost.js";
import { generateOpenrouter } from "./openrouter.js";
import { generateAnthropic } from "./anthropic.js";
import { generateOpenai } from "./openai.js";

export async function generate({ backend, systemPrompt, userContent, settings, signal }) {
  if (backend === "gemini") {
    return generateGemini({ systemPrompt, userContent, settings, signal });
  }
  if (backend === "openrouter") {
    return generateOpenrouter({ systemPrompt, userContent, settings, signal });
  }
  if (backend === "anthropic") {
    return generateAnthropic({ systemPrompt, userContent, settings, signal });
  }
  if (backend === "openai") {
    return generateOpenai({ systemPrompt, userContent, settings, signal });
  }
  return generateLocalhost({ systemPrompt, userContent, settings, signal });
}
