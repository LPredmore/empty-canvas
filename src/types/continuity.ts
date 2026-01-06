import { Conversation } from './index';

export interface FirstSentenceMatch {
  conversation: Conversation;
  matchedSentence: string;
  existingMessageCount: number;
  lastMessage: { 
    id: string;
    rawText: string; 
    sentAt: string;
  };
}
