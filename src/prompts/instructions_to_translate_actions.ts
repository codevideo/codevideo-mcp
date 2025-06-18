import { IAction } from "@fullstackcraftllc/codevideo-types";
import { getCurrentActions } from "../tools/get_current_actions";

export const instructionsToTranslateActions = (actionsToTranslation: Array<IAction> | undefined, targetLanguage: string): string => {
    let actionsToUse: IAction[];

    if (actionsToTranslation && actionsToTranslation.length > 0) {
        // Use provided actions
        actionsToUse = actionsToTranslation;
    } else {
        // Try to get from storage
        const storedActions = getCurrentActions();
        if (!storedActions || storedActions.length === 0) {
            return "No actions provided and no actions found in storage. Either pass actionsToTranslation parameter or use codevideo_set_current_actions first to store actions.";
        }
        actionsToUse = storedActions;
    }

    return `## 📝 Translation Instructions for CodeVideo Action Scripts

### 📌 Objective

You are given a JSON array representing an instructional CodeVideo script. Your task is to translate all relevant text **within the \`"value"\` fields** into the specified target language **while preserving CodeVideo execution logic**.

**WORKFLOW TIP**: Use \`codevideo_set_current_actions\` to store actions first, then call this tool without the actionsToTranslation parameter. This allows you to work with the same actions across multiple translation operations or other CodeVideo tools like \`codevideo_validate_actions\`, \`codevideo_make_video_from_actions\`, etc.

**VALIDATION TIP**: After translation, you can validate the translated actions using \`codevideo_validate_actions\` to ensure the CodeVideo structure remains intact.

---

### ✅ What to Translate
Translate the following, only if found within the \`"value"\` fields:

1. **All narration steps:**
   - \`"name": "author-speak-before"\` or \`"author-speak-after"\`  
     → Fully translate narration into fluent, natural speech in the target language.

2. **Code comments:**
   - Lines starting with \`#\` or \`//\` or between \`/* ... */\`  
     → Translate the comment portion only, preserving syntax markers.

3. **String literals inside code:**
   - e.g., \`print("Hello, World!")\`  
     → Translate the string inside the quotes, preserving quote marks and code structure.

4. **Terminal outputs:**
   - \`"name": "terminal-set-output"\`  
     → Translate printed outputs line by line.

---

### 🚫 What NOT to Translate
Do **not** translate the following:

- \`"name"\` field values (e.g., \`"author-speak-before"\`, \`"editor-type"\`, etc.)  
  → These are CodeVideo internal commands.

- File names, identifiers, variables, or function names (e.g., \`main.py\`, \`range\`, \`print\`, \`for i in range(...)\`)  
  → Keep code functional and consistent.

- Keywords or syntax in programming code  
  → Only translate *comments* and *strings*.

---

### 💡 Examples

#### Code Comment

\`\`\`json
{ "name": "editor-type", "value": "# Print 'Hello, World!' five times" }
\`\`\`

➡ becomes:

\`\`\`json
{ "name": "editor-type", "value": "# Imprime '¡Hola, Mundo!' cinco veces" }
\`\`\`

#### Narration
\`\`\`json
{ "name": "author-speak-before", "value": "Let's open a terminal and run the script." }
\`\`\`
➡ becomes:
\`\`\`json
{ "name": "author-speak-before", "value": "Vamos a abrir una terminal y ejecutar el script." }
\`\`\`

#### Terminal Output
\`\`\`json
{ "name": "terminal-set-output", "value": "Hello, World!\nHello, World!" }
\`\`\`
➡ becomes:
\`\`\`json
{ "name": "terminal-set-output", "value": "¡Hola, Mundo!\n¡Hola, Mundo!" }
\`\`\`

---

### 🌍 Target Language

The target language will be specified separately. Use fluent, natural phrasing appropriate to that language's tone and style of instruction.

---

### 🧠 Tips

- Match tone to the original narration (enthusiastic, beginner-friendly).
- Avoid overly literal translations — clarity is more important.
- Maintain line breaks, indentation, and special characters exactly as they appear in code or outputs.

---

### ✅ Output Format

Return the translated JSON with only the \`value\` fields updated. The JSON structure must remain valid and unchanged otherwise.

\`\`\`json
{ "name": "editor-type", "value": "# Print 'Hello, World!' five times" }
\`\`\`
➡ becomes:
\`\`\`json
{ "name": "editor-type", "value": "# Imprime '¡Hola, Mundo!' cinco veces" }
\`\`\`

#### Narration
\`\`\`json
{ "name": "author-speak-before", "value": "Let's open a terminal and run the script." }
\`\`\`
➡ becomes:
\`\`\`json
{ "name": "author-speak-before", "value": "Vamos a abrir una terminal y ejecutar el script." }
\`\`\`

#### Terminal Output
\`\`\`json
{ "name": "terminal-set-output", "value": "Hello, World!\nHello, World!" }
\`\`\`
➡ becomes:
\`\`\`json
{ "name": "terminal-set-output", "value": "¡Hola, Mundo!\n¡Hola, Mundo!" }
\`\`\`

---

### 🌍 Target Language

The target language will be specified below. Use fluent, natural phrasing appropriate to that language's tone and style of instruction.

---

### 🧠 Tips

- Match tone to the original narration (enthusiastic, beginner-friendly).
- Avoid overly literal translations — clarity is more important.
- Maintain line breaks, indentation, and special characters exactly as they appear in code or outputs.

---

### ✅ Output Format
Return the translated JSON with only the \`"value"\` fields updated. The JSON structure must remain valid and unchanged otherwise.


Considering all these instructions, please translate the following actions into ${targetLanguage}:

\`\`\`json
${JSON.stringify(actionsToUse, null, 4)}
\`\`\`

`;
}