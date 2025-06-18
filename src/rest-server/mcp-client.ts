import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import the actual tool functions
import { instructionsToCreateACourse } from "../prompts/instructions_to_create_a_course";
import { instructionsToCreateLessonActions } from "../prompts/instructions_to_create_lesson_actions";
import { instructionsToCreateLessonVideo } from "../prompts/instructions_to_create_lesson_video";
import { instructionsToTranslateActions } from "../prompts/instructions_to_translate_actions";
import { makeVideoFromActions } from "../tools/make_video_from_actions";
import { makeVideoFromLesson } from "../tools/make_video_from_lesson";
import { makeBlogPost } from "../tools/make_blog_post";
import { makeHTMLWebPage } from "../tools/make_html_web_page";
import { createCourseWithInitialMetadata } from "../tools/create_course_with_initial_metadata";
import { addLessonToCourse } from "../tools/add_lesson_to_course";
import { addActionsToLesson } from "../tools/add_actions_to_lesson";
import { getFinalLessonSnapshot } from "../tools/get_final_lesson_snapshot";
import { getEmptyLessonSnapshot } from "../tools/get_empty_lesson_snapshot";
import { validateActions } from "../tools/validate_actions";
import { isRepeatable } from "../tools/is_repeatable_action";
import { critiqueVideoUsingGemini } from "../tools/critique_video_using_gemini";
import { setCurrentActions } from "../tools/set_current_actions";
import { getCurrentActions } from "../tools/get_current_actions";
import { setCurrentLesson } from "../tools/set_current_lesson";
import { getCurrentLesson } from "../tools/get_current_lesson";
import { getInitialLessonStateFromLocalCodebase } from "../tools/get_initial_lesson_state_from_local_repo";
import { getInitialLessonStateFromGitHubRepo } from "../tools/get_initial_lesson_state_from_github_repo";
import { getActionNames } from "../resources/get_action_names";
import { getExampleActionsArrayByKeyword } from "../resources/get_example_actions_array_by_keyword";
import { getExampleLessonByKeyword } from "../resources/get_example_lessons_by_keyword";

interface McpToolCall {
  name: string;
  arguments: any;
}

interface McpResponse {
  content: any[];
  isError?: boolean;
}

export class McpClient {
  private server: McpServer;
  private isConnected: boolean = false;

  constructor(server: McpServer) {
    this.server = server;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      this.isConnected = true;
      console.log('MCP Client connected to server');
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  public async listTools(): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      // Return the list of actual available tools
      return [
        {
          name: 'codevideo_instructions_to_create_a_course',
          description: 'Generate instructions for creating a course',
          inputSchema: {
            type: 'object',
            properties: {
              additionalContext: {
                type: 'string',
                description: 'Additional context for the instructions'
              }
            },
            required: ['additionalContext']
          }
        },
        {
          name: 'codevideo_instructions_to_create_lesson_actions',
          description: 'Generate instructions for creating lesson actions',
          inputSchema: {
            type: 'object',
            properties: {
              additionalContext: {
                type: 'string',
                description: 'Additional context for the instructions'
              }
            },
            required: ['additionalContext']
          }
        },
        {
          name: 'codevideo_make_video_from_actions',
          description: 'Generate a video from CodeVideo actions',
          inputSchema: {
            type: 'object',
            properties: {
              actions: {
                type: 'array',
                description: 'Array of CodeVideo actions'
              }
            }
          }
        },
        {
          name: 'codevideo_make_video_from_lesson',
          description: 'Generate a video from a complete lesson object',
          inputSchema: {
            type: 'object',
            properties: {
              lesson: {
                type: 'object',
                description: 'Complete lesson object with snapshots'
              }
            }
          }
        },
        {
          name: 'codevideo_make_blog_post',
          description: 'Generate a markdown blog post from CodeVideo actions',
          inputSchema: {
            type: 'object',
            properties: {
              actions: {
                type: 'array',
                description: 'Array of CodeVideo actions'
              }
            }
          }
        },
        {
          name: 'codevideo_get_action_names',
          description: 'Get list of available action names',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ];
    } catch (error) {
      console.error('Failed to list tools:', error);
      throw error;
    }
  }

  public async callTool(toolCall: McpToolCall): Promise<McpResponse> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      console.log(`Calling real tool: ${toolCall.name}`, toolCall.arguments);
      
      // Call the actual tool implementation
      let result: any;
      
      switch (toolCall.name) {
        case 'codevideo_instructions_to_create_a_course':
          result = instructionsToCreateACourse(toolCall.arguments.additionalContext);
          break;
          
        case 'codevideo_instructions_to_create_lesson_actions':
          result = instructionsToCreateLessonActions(toolCall.arguments.additionalContext);
          break;
          
        case 'codevideo_instructions_to_create_lesson_video':
          result = instructionsToCreateLessonVideo(toolCall.arguments.additionalContext);
          break;
          
        case 'codevideo_instructions_to_translate_actions':
          result = instructionsToTranslateActions(toolCall.arguments.actionsToTranslation, toolCall.arguments.targetLanguage);
          break;
          
        case 'codevideo_make_video_from_actions':
          result = await makeVideoFromActions(toolCall.arguments.actions);
          break;
          
        case 'codevideo_make_video_from_lesson':
          result = await makeVideoFromLesson(toolCall.arguments.lesson);
          break;
          
        case 'codevideo_make_blog_post':
          result = makeBlogPost(toolCall.arguments.actions);
          break;
          
        case 'codevideo_make_html_web_page':
          result = await makeHTMLWebPage(toolCall.arguments.actions);
          break;
          
        case 'codevideo_create_course_with_initial_metadata':
          result = createCourseWithInitialMetadata(
            toolCall.arguments.id,
            toolCall.arguments.name,
            toolCall.arguments.description,
            toolCall.arguments.primaryLanguage
          );
          break;
          
        case 'codevideo_add_lesson_to_course':
          result = addLessonToCourse(
            toolCall.arguments.course,
            toolCall.arguments.id,
            toolCall.arguments.name,
            toolCall.arguments.description
          );
          break;
          
        case 'codevideo_add_actions_to_lesson':
          result = addActionsToLesson(toolCall.arguments.lesson, toolCall.arguments.actions);
          break;
          
        case 'codevideo_get_final_lesson_snapshot':
          result = getFinalLessonSnapshot(toolCall.arguments.actions);
          break;
          
        case 'codevideo_get_empty_lesson_snapshot':
          result = getEmptyLessonSnapshot();
          break;
          
        case 'codevideo_validate_actions':
          result = validateActions(toolCall.arguments.actions);
          break;
          
        case 'codevideo_is_repeatable_action':
          result = isRepeatable(toolCall.arguments.action);
          break;
          
        case 'codevideo_critique_video_using_gemini':
          result = await critiqueVideoUsingGemini(toolCall.arguments.videoPath, toolCall.arguments.actions);
          break;
          
        case 'codevideo_set_current_actions':
          result = setCurrentActions(toolCall.arguments.actions);
          break;
          
        case 'codevideo_get_current_actions':
          const actions = getCurrentActions();
          result = actions ? JSON.stringify(actions, null, 2) : "No actions found in storage";
          break;
          
        case 'codevideo_set_current_lesson':
          result = setCurrentLesson(toolCall.arguments.lesson);
          break;
          
        case 'codevideo_get_current_lesson':
          const lesson = getCurrentLesson();
          result = lesson ? JSON.stringify(lesson, null, 2) : "No lesson found in storage";
          break;
          
        case 'codevideo_get_initial_lesson_state_from_local_repo':
          result = await getInitialLessonStateFromLocalCodebase(toolCall.arguments.repoLocation);
          break;
          
        case 'codevideo_get_initial_lesson_state_from_github_repo':
          result = await getInitialLessonStateFromGitHubRepo(toolCall.arguments.repoUrl);
          break;
          
        case 'codevideo_get_action_names':
          result = getActionNames();
          break;
          
        case 'codevideo_get_example_actions_array_by_keyword':
          result = getExampleActionsArrayByKeyword(toolCall.arguments.keyword);
          break;
          
        case 'codevideo_get_example_lesson_by_keyword':
          result = getExampleLessonByKeyword(toolCall.arguments.keyword);
          break;
          
        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }
      
      // Handle different result formats
      if (result && typeof result === 'object' && 'outputPath' in result) {
        // Video result format
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              outputPath: result.outputPath,
              stdout: result.stdout,
              stderr: result.stderr
            }, null, 2)
          }],
          isError: false
        };
      } else {
        // Standard text result
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }],
          isError: false
        };
      }
      
    } catch (error) {
      console.error(`Failed to call tool ${toolCall.name}:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error calling tool ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  public async getPrompts(): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      return [];
    } catch (error) {
      console.error('Failed to get prompts:', error);
      throw error;
    }
  }

  public async getPrompt(name: string, args?: any): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      return {
        description: `Prompt ${name}`,
        messages: []
      };
    } catch (error) {
      console.error(`Failed to get prompt ${name}:`, error);
      throw error;
    }
  }

  public async getResources(): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      return [];
    } catch (error) {
      console.error('Failed to get resources:', error);
      throw error;
    }
  }

  public async readResource(uri: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      return [];
    } catch (error) {
      console.error(`Failed to read resource ${uri}:`, error);
      throw error;
    }
  }

  public disconnect(): void {
    this.isConnected = false;
    console.log('MCP Client disconnected');
  }
}
