import { MessageDirection } from '../types';

export interface ParsedMessage {
  senderName: string;
  receiverName: string;
  sentAt: Date;
  subject: string;
  body: string;
  direction: MessageDirection;
}

export interface ParsedConversation {
  title: string;
  participants: Set<string>;
  messages: ParsedMessage[];
  lastDate: Date;
}

const cleanOFWNoise = (text: string): string => {
  const lines = text.split('\n');
  const cleanedLines = lines.filter(line => {
    const l = line.trim();
    if (l.startsWith('Generated:')) return false;
    if (l.startsWith('Timezone:')) return false;
    if (l.startsWith('Format:')) return false;
    if (l.startsWith('Parents:')) return false;
    if (l.startsWith('Child(ren):')) return false;
    if (l.startsWith('Date Range:')) return false;
    if (l.startsWith('Contains:')) return false;
    if (l.startsWith('Order:')) return false;
    if (l.includes('OurFamilyWizard, LLC')) return false;
    if (l.includes('ourfamilywizard.com')) return false;
    if (l.includes('Page ') && l.includes(' of ')) return false;
    if (l.includes('Message Report') && (l.length < 20 || l.includes('Page'))) return false;
    if (l.match(/^Message \d+ of \d+$/)) return false;
    return true;
  });
  return cleanedLines.join('\n');
};

const cleanGmailNoise = (text: string): string => {
  const lines = text.split('\n');
  const cleanedLines = lines.filter(line => {
    const l = line.trim();
    if (l.includes('Gmail - ')) return false;
    if (l.startsWith('https://mail.google.com/')) return false;
    if (l.match(/^\d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2} [AP]M/)) return false;
    if (l.match(/^\d+\/\d+$/)) return false;
    if (l === '[Quoted text hidden]') return false;
    if (l.startsWith('WARNING: CONFIDENTIALITY NOTICE')) return false;
    return true;
  });
  return cleanedLines.join('\n');
};

export const parseGmailExport = (rawText: string): ParsedConversation => {
  const cleanText = cleanGmailNoise(rawText);
  const lines = cleanText.split('\n');
  
  const messages: ParsedMessage[] = [];
  const participants = new Set<string>();
  
  const startLineRegex = /^(.+?)\s+(?:<.*?>)?\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M)/;

  let currentMessage: Partial<ParsedMessage> | null = null;
  let currentBodyLines: string[] = [];
  let conversationTitle = 'Gmail Conversation';

  for(let i=0; i<3; i++) {
     if (lines[i] && !startLineRegex.test(lines[i]) && lines[i].length < 100 && !lines[i].includes('messages')) {
         const potentialTitle = lines[i].trim();
         if (potentialTitle && !potentialTitle.includes('@')) {
             conversationTitle = potentialTitle;
             break;
         }
     }
  }

  lines.forEach((line) => {
    const match = line.match(startLineRegex);
    if (match) {
      if (currentMessage) {
        currentMessage.body = currentBodyLines.join('\n').trim();
        messages.push(currentMessage as ParsedMessage);
      }

      const name = match[1].trim();
      const dateStr = match[2].replace(' at ', ' ');
      participants.add(name);
      
      currentMessage = {
        senderName: name,
        receiverName: 'Unknown',
        sentAt: new Date(dateStr),
        subject: conversationTitle,
        direction: MessageDirection.Inbound,
        body: ''
      };
      currentBodyLines = [];
    } else if (currentMessage) {
      if (line.startsWith('To: ')) {
         const to = line.substring(4).trim();
         currentMessage.receiverName = to.split('<')[0].split(',')[0].trim();
         to.split(',').forEach(p => {
             const cleanName = p.split('<')[0].trim();
             if(cleanName) participants.add(cleanName);
         });
      } else if (line.startsWith('Cc: ')) {
         const cc = line.substring(4).trim();
         cc.split(',').forEach(p => {
             const cleanName = p.split('<')[0].trim();
             if(cleanName) participants.add(cleanName);
         });
      } else {
         const trimmed = line.trim();
         if (trimmed.startsWith('On ') && trimmed.endsWith('wrote:')) {
             // Skip reply headers
         } else if (currentBodyLines.length > 0 || trimmed !== '') {
             currentBodyLines.push(line);
         }
      }
    }
  });

  if (currentMessage) {
    currentMessage.body = currentBodyLines.join('\n').trim();
    messages.push(currentMessage as ParsedMessage);
  }

  return {
    title: conversationTitle,
    participants,
    messages: messages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()),
    lastDate: messages.length > 0 ? messages[messages.length - 1].sentAt : new Date()
  };
};

export const parseOFWExport = (rawText: string): ParsedConversation => {
  const cleanText = cleanOFWNoise(rawText);
  
  const messageBlockRegex = /Sent:\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+at\s+(\d{1,2}:\d{2}\s+[AP]M)/g;
  
  const messages: ParsedMessage[] = [];
  const participants = new Set<string>();
  let lastSubject = '';
  
  let match;
  const indices: number[] = [];
  while ((match = messageBlockRegex.exec(cleanText)) !== null) {
    indices.push(match.index);
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = indices[i + 1] || cleanText.length;
    const block = cleanText.substring(start, end).trim();

    const sentLineMatch = block.match(/Sent:\s+(.+)/);
    const fromLineMatch = block.match(/From:\s+(.+)/);
    const toLineMatch = block.match(/To:\s+(.+?)(?:\s\(First Viewed|$)/);
    const subjectLineMatch = block.match(/Subject:\s+(.+)/);

    if (sentLineMatch && fromLineMatch && subjectLineMatch) {
      const dateStr = sentLineMatch[1].trim();
      const from = fromLineMatch[1].trim();
      const to = toLineMatch ? toLineMatch[1].trim() : 'Unknown';
      const subject = subjectLineMatch[1].trim();
      
      const subjectIndex = block.indexOf(subject);
      let body = block.substring(subjectIndex + subject.length).trim();
      
      participants.add(from);
      participants.add(to);
      lastSubject = subject;

      const parsedDate = new Date(dateStr.replace(' at ', ' '));

      messages.push({
        senderName: from,
        receiverName: to,
        sentAt: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        subject,
        body,
        direction: MessageDirection.Inbound
      });
    }
  }

  const title = lastSubject.replace(/^(Re:|Fwd:)\s*/i, '').trim() || 'New Conversation';

  return {
    title,
    participants,
    messages: messages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()),
    lastDate: messages.length > 0 ? messages[messages.length - 1].sentAt : new Date()
  };
};

export const parseGenericText = (rawText: string): ParsedConversation => {
  const lines = rawText.split('\n');
  const preview = lines[0] ? lines[0].substring(0, 50) : 'Imported Text';
  
  return {
    title: preview,
    participants: new Set(),
    messages: [{
      senderName: 'Unknown',
      receiverName: 'Unknown',
      sentAt: new Date(),
      subject: 'Imported Note',
      body: rawText,
      direction: MessageDirection.Inbound
    }],
    lastDate: new Date()
  };
};
