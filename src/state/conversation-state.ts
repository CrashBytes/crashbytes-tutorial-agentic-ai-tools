import { MessageParam } from '@anthropic-ai/sdk/resources/messages';

export interface ConversationState {
  session_id: string;
  messages: MessageParam[];
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export class StateManager {
  private sessions = new Map<string, ConversationState>();

  create(sessionId: string, metadata: Record<string, any> = {}): ConversationState {
    const state: ConversationState = {
      session_id: sessionId,
      messages: [],
      created_at: new Date(),
      updated_at: new Date(),
      metadata,
    };
    
    this.sessions.set(sessionId, state);
    return state;
  }

  get(sessionId: string): ConversationState | undefined {
    return this.sessions.get(sessionId);
  }

  addMessage(sessionId: string, message: MessageParam): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    state.messages.push(message);
    state.updated_at = new Date();
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getAllSessions(): ConversationState[] {
    return Array.from(this.sessions.values());
  }
}
