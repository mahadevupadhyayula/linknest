import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Bot, Send, BookOpen, Edit3, Save, Sparkles, Loader2, FolderOpen, Search, ListChecks, Plus, X, FileImage, File, XCircle } from 'lucide-react';
import { useSpaceRuntime } from '../SpaceRuntimeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getFriendlyTerm, getToolColor } from '../lib/friendly-terms';
import { tw } from '../lib/colors';

// Module-level guard to prevent duplicate mounts from sending messages
// This persists across component instances to handle React Strict Mode and accidental double-mounts
let globalSendingLock = false;
let lastSendTimestamp = 0;

interface MessageContent {
  type: 'text' | 'tool_use';
  text?: string;
  name?: string;
  input?: any;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | MessageContent[];
  attachments?: AttachmentMeta[];
}

interface AttachmentMeta {
  id: string;
  url: string;
  contentType: string;
  originalName: string;
}

interface BeaconIntakeResult {
  headline: string;
  reflection: string;
  anchor: string;
  nextSteps: string[];
  starterPrompts: string[];
}

function getStoredBeaconIntake(spaceId: string): BeaconIntakeResult | null {
  try {
    const sessionKey = `space_session_${spaceId}`;
    const stored =
      localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey);

    if (!stored) {
      return null;
    }

    const session = JSON.parse(stored);
    const intake = session?.intake?.result;

    if (
      intake &&
      typeof intake.headline === 'string' &&
      typeof intake.reflection === 'string' &&
      typeof intake.anchor === 'string' &&
      Array.isArray(intake.nextSteps) &&
      Array.isArray(intake.starterPrompts)
    ) {
      return intake as BeaconIntakeResult;
    }
  } catch (error) {
    console.error('[AgentChat] Failed to read Beacon intake state:', error);
  }

  return null;
}

interface AgentChatProps {
  spaceId: string;
  onFileAccess?: (log: { timestamp: number; path: string; action: 'read' | 'write'; tool: string }) => void;
  pendingMessage?: string | null;
  onPendingMessageConsumed?: () => void;
}

const BEACON_SPACE_IDS = new Set(["workspace-193216"]);
const BEACON_STARTER_PROMPTS = [
  "I need help before a hard conversation.",
  "A conversation just went badly and I need to process it.",
  "They asked me for money and I don't know what to say.",
];

function WorkingIndicator({ lastAction, agentLabel = "Agent" }: { lastAction?: string; agentLabel?: string }) {
  const actionIcons: Record<string, any> = {
    'read_file': BookOpen,
    'write_file': Save,
    'edit_file': Edit3,
    'write_task_list': ListChecks,
    'glob': Search,
    'grep': Search,
    'ls': FolderOpen,
  };

  const Icon = actionIcons[lastAction || ''] || Loader2;
  const friendlyText = getFriendlyTerm(lastAction || '', 'thinking');
  const color = getToolColor(lastAction || '');

  return (
    <div className="flex items-center justify-center py-2 mr-8">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
        <Icon className={`h-4 w-4 ${color} animate-spin`} />
        <span className={`text-xs font-medium ${color}`}>
          {agentLabel} is {friendlyText}...
        </span>
      </div>
    </div>
  );
}

// Generate unique instance ID for debugging
let instanceCounter = 0;

export default function AgentChat({ spaceId, onFileAccess, pendingMessage, onPendingMessageConsumed }: AgentChatProps) {
  const { sessionId, trackEvent } = useSpaceRuntime();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastAction, setLastAction] = useState<string | undefined>();
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [workspaceSessionId, setWorkspaceSessionId] = useState<string | undefined>();
  const [configWelcomeMessage, setConfigWelcomeMessage] = useState<string | null>(null);
  const [beaconIntake, setBeaconIntake] = useState<BeaconIntakeResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const pendingMessageProcessed = useRef(false);
  const isSendingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const instanceId = useRef(++instanceCounter);
  const isBeaconSpace = BEACON_SPACE_IDS.has(spaceId);
  const agentLabel = isBeaconSpace ? "Beacon" : "Agent";

  // Debug: Log mount/unmount
  useEffect(() => {
    console.log(`[AgentChat] Instance ${instanceId.current} MOUNTED for spaceId: ${spaceId}`);
    return () => {
      console.log(`[AgentChat] Instance ${instanceId.current} UNMOUNTED`);
    };
  }, [spaceId]);

  useEffect(() => {
    const fetchWelcomeMessage = async () => {
      try {
        const res = await fetch(`/api/space/${spaceId}/file/config.json`);
        if (res.ok) {
          const data = await res.json();
          const config = JSON.parse(data.content);
          if (config?.agent?.welcomeMessage) {
            setConfigWelcomeMessage(config.agent.welcomeMessage);
            console.log('[AgentChat] Loaded welcome message from config');
          }
        }
      } catch (e) {
        console.error('[AgentChat] Failed to load welcome message:', e);
      }
    };
    fetchWelcomeMessage();
  }, [spaceId]);

  useEffect(() => {
    if (!isBeaconSpace) {
      setBeaconIntake(null);
      return;
    }

    setBeaconIntake(getStoredBeaconIntake(spaceId));
  }, [isBeaconSpace, spaceId, sessionId]);

  const getSessionEmail = () => {
    try {
      const sessionKey = `space_session_${spaceId}`;
      // Use localStorage to match where EmailGate saves the session
      const stored = localStorage.getItem(sessionKey);
      if (stored) {
        const session = JSON.parse(stored);
        return session.email || null;
      }
    } catch (e) {
      console.error('[AgentChat] Failed to get session email:', e);
    }
    return null;
  };

  // Get pre-set workspaceSessionId from secure access link (if available)
  const getStoredWorkspaceSessionId = () => {
    try {
      const sessionKey = `space_session_${spaceId}`;
      // Use localStorage to match where EmailGate saves the session
      const stored = localStorage.getItem(sessionKey);
      if (stored) {
        const session = JSON.parse(stored);
        return session.workspaceSessionId || null;
      }
    } catch (e) {
      console.error('[AgentChat] Failed to get stored workspaceSessionId:', e);
    }
    return null;
  };

  // Load chat history when component mounts (if user has email session)
  useEffect(() => {
    const loadHistory = async () => {
      // Prioritize sessionId from context (authoritative, set by EmailGate)
      // Fall back to localStorage only for email (legacy compatibility)
      const params = new URLSearchParams();
      params.set('contextType', 'space');
      
      // Use sessionId from context - this is authoritative
      const effectiveSessionId = sessionId && sessionId.startsWith('wses_') ? sessionId : getStoredWorkspaceSessionId();
      
      if (effectiveSessionId) {
        params.set('sessionId', effectiveSessionId);
        console.log('[AgentChat] Using sessionId for history lookup:', effectiveSessionId);
        setWorkspaceSessionId(effectiveSessionId);
      }
      
      // Also include email from localStorage as fallback
      const email = getSessionEmail();
      if (email) {
        params.set('email', email);
      }
      
      // Need at least sessionId or email to load history
      if (!effectiveSessionId && !email) {
        console.log('[AgentChat] No session or email, skipping history load');
        setIsLoadingHistory(false);
        setHasLoadedHistory(true);
        return;
      }

      try {
        console.log('[AgentChat] Loading chat history with params:', params.toString());
        const response = await fetch(
          `/api/space/${spaceId}/chat/history?${params.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          console.log('[AgentChat] History response:', data);

          // Only update workspaceSessionId if not already set
          if (data.workspaceSessionId && !effectiveSessionId) {
            console.log('[AgentChat] workspace_session.id for WebSocket subscription:', data.workspaceSessionId);
            setWorkspaceSessionId(data.workspaceSessionId);
          } else if (effectiveSessionId) {
            console.log('[AgentChat] Keeping sessionId:', effectiveSessionId);
          } else {
            console.warn('[AgentChat] No workspaceSessionId returned from history endpoint');
          }

          if (data.messages && data.messages.length > 0) {
            // Transform backend messages to frontend format
            const transformedMessages: ChatMessage[] = [];
            for (const msg of data.messages) {
              const role = msg.role as 'user' | 'assistant';

              if (role === 'user') {
                transformedMessages.push({ role, content: msg.content });
              } else {
                // For assistant messages, extract text from various Claude Agent SDK formats
                let content: string | MessageContent[] = msg.content;

                // Check if content is already an array (contentType: json) or a JSON string
                let events: any[] | null = null;
                if (Array.isArray(content)) {
                  events = content;
                } else if (typeof content === 'string' && content.startsWith('[')) {
                  try {
                    events = JSON.parse(content);
                  } catch (e) {
                    // Not valid JSON, keep as string
                  }
                }

                if (events && Array.isArray(events)) {
                  try {
                    let extractedText = '';

                    // Method 1: Collect text_chunk events (streaming format)
                    const textChunks = events
                      .filter((e: any) => e.type === 'text_chunk' && e.data?.text)
                      .map((e: any) => e.data.text)
                      .join('');

                    if (textChunks) {
                      extractedText = textChunks;
                    }

                    // Method 2: Look for content_block_delta events with text_delta
                    if (!extractedText) {
                      const deltaChunks = events
                        .filter((e: any) => e.type === 'content_block_delta' && e.data?.delta?.text)
                        .map((e: any) => e.data.delta.text)
                        .join('');
                      if (deltaChunks) {
                        extractedText = deltaChunks;
                      }
                    }

                    // Method 3: Look for 'assistant' type events with content array
                    if (!extractedText) {
                      const assistantEvent = events.find((e: any) => e.type === 'assistant' && e.data?.content);
                      if (assistantEvent?.data?.content) {
                        const textParts = assistantEvent.data.content
                          .filter((c: any) => c.type === 'text')
                          .map((c: any) => c.text)
                          .join('');
                        if (textParts) {
                          extractedText = textParts;
                        }
                      }
                    }

                    // Method 4: Look for 'message' type events with content array
                    if (!extractedText) {
                      const messageEvent = events.find((e: any) => e.type === 'message' && e.data?.content);
                      if (messageEvent?.data?.content) {
                        const textParts = messageEvent.data.content
                          .filter((c: any) => c.type === 'text')
                          .map((c: any) => c.text)
                          .join('');
                        if (textParts) {
                          extractedText = textParts;
                        }
                      }
                    }

                    // Method 5: Look for result event with text result
                    if (!extractedText) {
                      const resultEvent = events.find((e: any) => e.type === 'result' && typeof e.data?.result === 'string');
                      if (resultEvent?.data?.result) {
                        extractedText = resultEvent.data.result;
                      }
                    }

                    if (extractedText) {
                      content = extractedText;
                    } else {
                      console.warn('[AgentChat] Could not extract text from events:', events.map((e: any) => e.type));
                    }
                  } catch (e) {
                    console.warn('[AgentChat] Failed to parse assistant message JSON:', e);
                  }
                }

                transformedMessages.push({ role, content });
              }
            }

            if (transformedMessages.length > 0) {
              const hasUserMessages = transformedMessages.some(m => m.role === 'user');
              if (hasUserMessages) {
                console.log('[AgentChat] Loaded', transformedMessages.length, 'messages from history (has user messages)');
                setMessages(transformedMessages);
              } else {
                console.log('[AgentChat] Skipping', transformedMessages.length, 'assistant-only messages (no user messages - likely booster messages)');
              }
            }
          }
        }
      } catch (error) {
        console.error('[AgentChat] Failed to load history:', error);
      } finally {
        setIsLoadingHistory(false);
        setHasLoadedHistory(true);
      }
    };

    loadHistory();
  }, [spaceId, sessionId]);

  useEffect(() => {
    if (hasLoadedHistory && messages.length === 0 && configWelcomeMessage) {
      console.log('[AgentChat] Injecting config welcome message for new user');
      setMessages([{ role: 'assistant', content: configWelcomeMessage }]);
    }
  }, [hasLoadedHistory, configWelcomeMessage]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, loading]);

  // WebSocket subscription for real-time messages using workspace_session.id
  useEffect(() => {
    if (!workspaceSessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?session_chat=${workspaceSessionId}`;

    console.log('[AgentChat] Connecting WebSocket with workspace_session.id:', workspaceSessionId);
    console.log('[AgentChat] WebSocket URL:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[AgentChat] WebSocket connected successfully');
      console.log('[AgentChat] Subscribed to workspace_session.id:', workspaceSessionId);
    };

    // Track processed message IDs to avoid duplicates
    const processedMessageIds = new Set<string>();

    ws.onmessage = (event) => {
      console.log('[AgentChat] WebSocket event received');
      try {
        const data = JSON.parse(event.data);
        console.log('[AgentChat] WebSocket message type:', data.type);

        if (data.type === 'session_message' && data.message) {
          const messageId = data.message.id;

          // Skip duplicate messages
          if (messageId && processedMessageIds.has(messageId)) {
            console.log('[AgentChat] Skipping duplicate message ID:', messageId);
            return;
          }
          if (messageId) {
            processedMessageIds.add(messageId);
          }

          console.log('[AgentChat] Processing message:', messageId, 'contentType:', data.message.contentType);

          let content: string | MessageContent[] = data.message.content;

          // Handle JSON event arrays (when contentType='json')
          if (data.message.contentType === 'json' && Array.isArray(data.message.content)) {
            console.log('[AgentChat] Processing JSON event array with', data.message.content.length, 'events');
            let extractedText = '';

            // Method 1: Look for 'result' event with response (final complete message)
            const resultEvent = data.message.content.find((e: any) => e.type === 'result' && e.data?.response);
            if (resultEvent?.data?.response) {
              extractedText = resultEvent.data.response;
              console.log('[AgentChat] ✓ Extracted from result.response:', extractedText.substring(0, 50) + '...');
            }

            // Method 2: Look for 'message' events with content
            if (!extractedText) {
              const messageEvent = data.message.content.find((e: any) => e.type === 'message' && e.data?.content);
              if (messageEvent?.data?.content) {
                const textParts = messageEvent.data.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('');
                if (textParts) {
                  extractedText = textParts;
                  console.log('[AgentChat] ✓ Extracted from message.content:', extractedText.substring(0, 50) + '...');
                }
              }
            }

            // Method 3: Reconstruct from text_chunk events (streaming response)
            if (!extractedText) {
              const textChunks = data.message.content
                .filter((e: any) => e.type === 'text_chunk' && e.data?.text)
                .map((e: any) => e.data.text);

              if (textChunks.length > 0) {
                extractedText = textChunks.join('');
                console.log('[AgentChat] ✓ Reconstructed from text_chunks:', extractedText.substring(0, 50) + '...');
              }
            }

            if (extractedText) {
              content = extractedText;
            } else {
              console.warn('[AgentChat] ✗ Could not extract text, event types:', data.message.content.map((e: any) => e.type));
              // Don't add messages with no extractable content
              return;
            }
          }

          // Skip empty content
          if (!content || (typeof content === 'string' && !content.trim())) {
            console.log('[AgentChat] Skipping empty content message');
            return;
          }

          const newMessage: ChatMessage = {
            role: data.message.role as 'user' | 'assistant',
            content
          };

          console.log('[AgentChat] ✓ Adding message to UI, role:', newMessage.role);
          setMessages(prev => [...prev, newMessage]);
        }
      } catch (e) {
        console.warn('[AgentChat] Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('[AgentChat] WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log('[AgentChat] WebSocket disconnected:', event.code, event.reason);
    };

    return () => {
      console.log('[AgentChat] Cleaning up WebSocket connection');
      ws.close(1000, 'Component unmounting');
      wsRef.current = null;
    };
  }, [workspaceSessionId]);

  // Auto-resize textarea - starts at 1 line, expands to 2-3 lines max
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Max height ~72px allows for about 3 lines before scrolling
      const newHeight = Math.min(textarea.scrollHeight, 72);
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  // Load Claude session synchronously on mount using initializer function
  const [claudeSessionId, setClaudeSessionId] = useState<string | undefined>(() => {
    const sessionKey = `claude_session_${spaceId}`;
    return sessionStorage.getItem(sessionKey) || undefined;
  });

  // Save Claude session when it changes
  useEffect(() => {
    if (claudeSessionId) {
      const sessionKey = `claude_session_${spaceId}`;
      sessionStorage.setItem(sessionKey, claudeSessionId);
    }
  }, [claudeSessionId, spaceId]);

  // Handle pending message from launcher input
  useEffect(() => {
    if (pendingMessage && !pendingMessageProcessed.current && !loading) {
      pendingMessageProcessed.current = true;
      setInput(pendingMessage);
      setTimeout(() => {
        onPendingMessageConsumed?.();
      }, 100);
    }
  }, [pendingMessage, loading]);

  // Auto-send when input is set from pending message
  // Must wait for hasLoadedHistory to be true before sending
  useEffect(() => {
    if (input && pendingMessageProcessed.current && !loading && hasLoadedHistory) {
      pendingMessageProcessed.current = false;
      sendMessageWithContent(input, []);
      setInput('');
    }
  }, [input, hasLoadedHistory]);

  // Helper function to upload files (used by file input, drag-drop, and paste)
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Check max files (5 total including pending)
    if (pendingAttachments.length + files.length > 5) {
      console.warn('[AgentChat] Too many files - max 5 allowed');
      return;
    }

    // Filter to only supported file types
    const supportedFiles = files.filter(file =>
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );

    if (supportedFiles.length === 0) {
      console.warn('[AgentChat] No supported files found');
      return;
    }

    setIsUploadingAttachment(true);

    try {
      const formData = new FormData();
      supportedFiles.forEach((file) => {
        formData.append("files", file);
      });

      // Upload to space-scoped endpoint
      const res = await fetch(`/api/uploads/attachments?configId=${spaceId}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      setPendingAttachments((prev) => [...prev, ...data.attachments]);
      console.log(`[AgentChat] Uploaded ${data.attachments.length} files`);
    } catch (error: any) {
      console.error('[AgentChat] Upload failed:', error.message);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // Handle file input selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFiles(Array.from(files));
    }
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove an attachment
  const removeAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  // Handle paste from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await uploadFiles(files);
    }
  };

  // Core send function that takes message content directly
  const sendMessageWithContent = async (messageContent: string, attachmentsToSend: AttachmentMeta[]) => {
    if ((!messageContent.trim() && attachmentsToSend.length === 0) || loading) return;

    // Wait for history to load before sending - prevents message being overwritten
    if (!hasLoadedHistory) {
      console.log('[AgentChat] Waiting for history to load before sending...');
      return;
    }

    // Prevent double submissions using ref guard
    if (isSendingRef.current) {
      console.log(`[AgentChat] Ignoring duplicate API call - already sending (ref)`);
      return;
    }

    // Module-level guard: Check timestamp FIRST (works even when lock is initially false)
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTimestamp;
    if (timeSinceLastSend < 1000) {
      console.log(`[AgentChat] Ignoring duplicate API call - sent ${timeSinceLastSend}ms ago`);
      return;
    }

    // Acquire locks for API call
    console.log(`[AgentChat] Sending message, acquiring locks`);
    isSendingRef.current = true;
    globalSendingLock = true;
    lastSendTimestamp = now;

    // Add user message to UI AFTER history is loaded and locks acquired
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setLastAction(undefined);

    trackEvent('agent_message', {
      messageLength: messageContent.length,
      messagePreview: messageContent.slice(0, 50),
      attachmentCount: attachmentsToSend.length,
    });

    try {
      const email = getSessionEmail();
      console.log('[AgentChat] Sending message with email:', email, 'attachments:', attachmentsToSend.length);

      const res = await fetch(`/api/space/${spaceId}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          sessionId: sessionId,
          claudeSessionId: claudeSessionId,
          email: email,
          attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined
        })
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let totalTextLength = 0;

      console.log('[SPACE-STREAM-DEBUG] Starting to read SSE stream...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[SPACE-STREAM-DEBUG] Stream ended. Total chunks:', chunkCount, 'Total text length:', totalTextLength);
          break;
        }

        const rawChunk = decoder.decode(value, { stream: true });
        console.log('[SPACE-STREAM-DEBUG] Raw chunk received, length:', rawChunk.length, 'bytes');

        buffer += rawChunk;
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('[SPACE-STREAM-DEBUG] Received [DONE] signal');
              setStreamingContent('');
              continue;
            }

            try {
              const event = JSON.parse(data);
              console.log('[SPACE-STREAM-DEBUG] Event type:', event.type, 'timestamp:', event.timestamp);

              if (event.type === 'text_chunk') {
                chunkCount++;
                const text = event.data?.text || '';
                totalTextLength += text.length;
                console.log('[SPACE-STREAM-DEBUG] text_chunk #' + chunkCount + ':', text.substring(0, 50), '(' + text.length + ' chars)');
                // PROGRESSIVE STREAMING: Use flushSync to bypass React 18 batching
                flushSync(() => {
                  setIsStreaming(true);
                  setStreamingContent(prev => prev + event.data.text);
                });
                // Yield to browser to allow paint cycle for typing effect
                await new Promise(resolve => requestAnimationFrame(resolve));
              } else if (event.type === 'message') {
                setIsStreaming(false);
                setStreamingContent('');
                setMessages(prev => [...prev, event.data]);

                if (event.data.content && Array.isArray(event.data.content)) {
                  for (const chunk of event.data.content) {
                    if (chunk.type === 'tool_use') {
                      setIsStreaming(false);
                      setStreamingContent('');
                      setLastAction(chunk.name);

                      if (chunk.name === 'read_file' && chunk.input?.file_path) {
                        onFileAccess?.({
                          timestamp: Date.now(),
                          path: chunk.input.file_path,
                          action: 'read',
                          tool: 'read_file'
                        });
                      } else if (chunk.name === 'write_file' && chunk.input?.file_path) {
                        onFileAccess?.({
                          timestamp: Date.now(),
                          path: chunk.input.file_path,
                          action: 'write',
                          tool: 'write_file'
                        });
                      }
                    }
                  }
                }
              } else if (event.type === 'progress') {
                if (event.data?.message) {
                  setIsStreaming(false);
                  setLastAction(event.data.message);
                }
                if (event.data?.sessionId) {
                  setClaudeSessionId(event.data.sessionId);
                }
              } else if (event.type === 'result') {
                setLoading(false);
                setIsStreaming(false);
                setLastAction(undefined);
                if (event.data?.sessionId) {
                  setClaudeSessionId(event.data.sessionId);
                }
              } else if (event.type === 'error') {
                throw new Error(event.data.error);
              }
            } catch (e) {
              console.warn('Failed to parse event:', data);
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error. Please try again.`
      }]);
    } finally {
      setLoading(false);
      setIsStreaming(false);
      setLastAction(undefined);
      isSendingRef.current = false;
      globalSendingLock = false;
    }
  };

  // Wrapper that uses input state and pending attachments
  const sendMessage = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || loading) return;
    const messageToSend = input;
    const attachmentsToSend = [...pendingAttachments];
    setInput('');
    setPendingAttachments([]);
    await sendMessageWithContent(messageToSend, attachmentsToSend);
  };

  // Handle keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) {
      e.preventDefault();
      sendMessage();
    }
  };

  const shortcutPrefix =
    typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl';
  const hasUserMessages = messages.some((message) => message.role === 'user');
  const shouldShowBeaconIntake = isBeaconSpace && !!beaconIntake && !hasUserMessages;
  const composerPlaceholder = pendingAttachments.length > 0
    ? (isBeaconSpace ? "Add any context about these files..." : "Add a message about the files...")
    : (isBeaconSpace
        ? (shouldShowBeaconIntake
            ? "We can keep building from your starter plan, or you can tell me what changed..."
            : "Tell me what happened, or what you're worried about...")
        : "Ask me anything... (paste or drop images here)");

  return (
    <div className={`h-full flex flex-col ${
      isBeaconSpace
        ? "bg-gradient-to-br from-emerald-50/60 via-stone-50 to-sky-50/30"
        : "bg-gradient-to-br from-blue-50/30 to-sky-50/30"
    }`}>
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Loading state - shown while checking for chat history */}
        {isLoadingHistory && messages.length === 0 && (
          <div className="flex justify-start mr-8">
            <div className="bg-slate-100 rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}

        {!isLoadingHistory && hasLoadedHistory && shouldShowBeaconIntake && beaconIntake && (
          <div className="px-4">
            <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-emerald-100 bg-white/90 shadow-sm">
              <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  Your Beacon starting point
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {beaconIntake.headline}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {beaconIntake.reflection}
                </p>
              </div>

              <div className="space-y-5 px-6 py-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Today's anchor
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {beaconIntake.anchor}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Good next steps
                  </p>
                  <div className="mt-3 space-y-2">
                    {beaconIntake.nextSteps.map((step) => (
                      <div
                        key={step}
                        className="flex items-start gap-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-600" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Continue from here
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {beaconIntake.starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          void sendMessageWithContent(prompt, []);
                        }}
                        className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Welcome message - only shown when confirmed no history exists */}
        {!isLoadingHistory && hasLoadedHistory && messages.length === 0 && !shouldShowBeaconIntake ? (
          <div className="mt-8 px-4">
            {isBeaconSpace ? (
              <div className="mx-auto max-w-xl rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50 via-white to-white px-6 py-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
                  <Bot className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">Start with the hard part</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Tell Beacon what happened, what conversation you are dreading, or what you need help saying next.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {BEACON_STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        void sendMessageWithContent(prompt, []);
                      }}
                      className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <Bot className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">Ask me anything to get started</p>
              </div>
            )}
          </div>
        ) : messages.length > 0 && (
          messages.map((msg, idx) => (
            <div key={idx}>
              <div
                className={`p-3 rounded-lg overflow-hidden min-w-0 ${
                  msg.role === 'user'
                    ? `${tw.message.user} ml-8`
                    : `${tw.message.assistant} mr-8`
                }`}
              >
                <p className="text-sm font-medium mb-1">
                  {isBeaconSpace
                    ? (msg.role === 'assistant' ? 'Beacon' : 'You')
                    : msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
                </p>

                {/* Show attachments for user messages */}
                {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-1 px-2 py-1 bg-white/50 rounded text-xs">
                        {att.contentType.startsWith('image/') ? (
                          <FileImage className="w-3 h-3 text-blue-500" />
                        ) : (
                          <File className="w-3 h-3 text-gray-500" />
                        )}
                        <span className="max-w-[100px] truncate">{att.originalName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {typeof msg.content === 'string' ? (
                  <div className={`prose prose-base max-w-none ${msg.role === 'user' ? 'text-base' : 'text-base'}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, children, ...props }) => (
                          <p className="my-2 text-base" {...props}>{children}</p>
                        ),
                        ul: ({ node, children, ...props }) => (
                          <ul className="my-3 pl-5 space-y-1" style={{ listStyleType: 'disc', listStylePosition: 'outside' }} {...props}>{children}</ul>
                        ),
                        ol: ({ node, children, ...props }) => (
                          <ol className="my-3 pl-5 space-y-1" style={{ listStyleType: 'decimal', listStylePosition: 'outside' }} {...props}>{children}</ol>
                        ),
                        li: ({ node, children, ...props }) => (
                          <li className="ml-0 text-base" style={{ display: 'list-item' }} {...props}>{children}</li>
                        ),
                        table: ({ node, children, ...props }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="min-w-full border-collapse border border-gray-300 text-sm" {...props}>{children}</table>
                          </div>
                        ),
                        thead: ({ node, children, ...props }) => (
                          <thead className="bg-gray-100" {...props}>{children}</thead>
                        ),
                        tbody: ({ node, children, ...props }) => (
                          <tbody {...props}>{children}</tbody>
                        ),
                        tr: ({ node, children, ...props }) => (
                          <tr className="border-b border-gray-200" {...props}>{children}</tr>
                        ),
                        th: ({ node, children, ...props }) => (
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold" {...props}>{children}</th>
                        ),
                        td: ({ node, children, ...props }) => (
                          <td className="border border-gray-300 px-3 py-2" {...props}>{children}</td>
                        ),
                        code: ({ node, children, className, ...props }) => {
                          const isBlock = className?.includes('language-');
                          if (isBlock) {
                            return <code className={`${className || ''} break-all`} {...props}>{children}</code>;
                          }
                          return <code className="bg-gray-800 text-gray-100 px-1.5 py-0.5 rounded text-sm break-all" {...props}>{children}</code>;
                        },
                        pre: ({ node, children, ...props }) => (
                          <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto max-w-full" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} {...props}>{children}</pre>
                        ),
                        a: ({ node, href, children }) => {
                          if (href?.startsWith('app://')) {
                            const appId = href.replace('app://', '');
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('[AgentChat] Button click - opening app:', appId);
                                  window.dispatchEvent(new CustomEvent('openApp', { detail: { appId } }));
                                }}
                                className={`inline-flex items-center gap-1 px-3 py-1 ${tw.button.primary} rounded-lg transition-colors text-xs font-medium mx-1`}
                                data-testid={`link-app-${appId}`}
                              >
                                {children}
                              </button>
                            );
                          }
                          return <a href={href} target="_blank" rel="noopener noreferrer" title={href} className="text-blue-600 hover:underline break-all">{children}</a>;
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {msg.content.map((chunk, chunkIdx) => (
                      <div key={chunkIdx}>
                        {chunk.type === 'text' && chunk.text && (
                          <div className="prose prose-base max-w-none text-base">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ node, children, ...props }) => (
                                  <p className="my-2 text-base" {...props}>{children}</p>
                                ),
                                ul: ({ node, children, ...props }) => (
                                  <ul className="my-3 pl-5 space-y-1" style={{ listStyleType: 'disc', listStylePosition: 'outside' }} {...props}>{children}</ul>
                                ),
                                ol: ({ node, children, ...props }) => (
                                  <ol className="my-3 pl-5 space-y-1" style={{ listStyleType: 'decimal', listStylePosition: 'outside' }} {...props}>{children}</ol>
                                ),
                                li: ({ node, children, ...props }) => (
                                  <li className="ml-0 text-base" style={{ display: 'list-item' }} {...props}>{children}</li>
                                ),
                                table: ({ node, children, ...props }) => (
                                  <div className="overflow-x-auto my-3">
                                    <table className="min-w-full border-collapse border border-gray-300 text-sm" {...props}>{children}</table>
                                  </div>
                                ),
                                thead: ({ node, children, ...props }) => (
                                  <thead className="bg-gray-100" {...props}>{children}</thead>
                                ),
                                tbody: ({ node, children, ...props }) => (
                                  <tbody {...props}>{children}</tbody>
                                ),
                                tr: ({ node, children, ...props }) => (
                                  <tr className="border-b border-gray-200" {...props}>{children}</tr>
                                ),
                                th: ({ node, children, ...props }) => (
                                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold" {...props}>{children}</th>
                                ),
                                td: ({ node, children, ...props }) => (
                                  <td className="border border-gray-300 px-3 py-2" {...props}>{children}</td>
                                ),
                                code: ({ node, children, className, ...props }) => {
                                  const isBlock = className?.includes('language-');
                                  if (isBlock) {
                                    return <code className={`${className || ''} break-all`} {...props}>{children}</code>;
                                  }
                                  return <code className="bg-gray-800 text-gray-100 px-1.5 py-0.5 rounded text-sm break-all" {...props}>{children}</code>;
                                },
                                pre: ({ node, children, ...props }) => (
                                  <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto max-w-full" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} {...props}>{children}</pre>
                                ),
                                a: ({ node, href, children }) => {
                                  if (href?.startsWith('app://')) {
                                    const appId = href.replace('app://', '');
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('[AgentChat] Button click - opening app:', appId);
                                          window.dispatchEvent(new CustomEvent('openApp', { detail: { appId } }));
                                        }}
                                        className={`inline-flex items-center gap-1 px-3 py-1 ${tw.button.primary} rounded-lg transition-colors text-xs font-medium mx-1`}
                                        data-testid={`link-app-${appId}`}
                                      >
                                        {children}
                                      </button>
                                    );
                                  }
                                  return <a href={href} target="_blank" rel="noopener noreferrer" title={href} className="text-blue-600 hover:underline break-all">{children}</a>;
                                }
                              }}
                            >
                              {chunk.text}
                            </ReactMarkdown>
                          </div>
                        )}
                        {chunk.type === 'tool_use' && (
                          <div className="border border-gray-300 rounded-lg overflow-hidden mt-2">
                            <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 flex-wrap">
                              {chunk.name === 'edit_file' ? (
                                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                              ) : chunk.name === 'read_file' ? (
                                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                              ) : chunk.name === 'write_file' ? (
                                <Save className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-gray-600" />
                              )}
                              <span className="text-xs font-semibold text-gray-700">
                                {chunk.name === 'read_file' ? 'Viewing' :
                                 chunk.name === 'write_file' ? 'Creating' :
                                 chunk.name === 'edit_file' ? 'Updating' :
                                 getFriendlyTerm(chunk.name || '', 'Tool Use')}
                              </span>
                              {chunk.input?.file_path && (
                                <span className="font-mono text-xs text-gray-600 break-all">
                                  {chunk.input.file_path}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && !streamingContent && <WorkingIndicator lastAction={lastAction} agentLabel={agentLabel} />}

        {streamingContent && (
          <div className={`${isBeaconSpace ? 'bg-white/90 border border-emerald-100 shadow-sm' : 'bg-gray-100'} mr-8 p-3 rounded-lg overflow-hidden min-w-0`}>
            <p className="text-sm font-medium mb-1">{isBeaconSpace ? 'Beacon' : 'Assistant'}</p>
            <div className="prose prose-base max-w-none text-base">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ node, children, ...props }) => (
                    <p className="my-2 text-base" {...props}>{children}</p>
                  ),
                  ul: ({ node, children, ...props }) => (
                    <ul className="my-3 pl-5 space-y-1" style={{ listStyleType: 'disc', listStylePosition: 'outside' }} {...props}>{children}</ul>
                  ),
                  ol: ({ node, children, ...props }) => (
                    <ol className="my-3 pl-5 space-y-1" style={{ listStyleType: 'decimal', listStylePosition: 'outside' }} {...props}>{children}</ol>
                  ),
                  li: ({ node, children, ...props }) => (
                    <li className="ml-0 text-base" style={{ display: 'list-item' }} {...props}>{children}</li>
                  ),
                  table: ({ node, children, ...props }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full border-collapse border border-gray-300 text-sm" {...props}>{children}</table>
                    </div>
                  ),
                  thead: ({ node, children, ...props }) => (
                    <thead className="bg-gray-100" {...props}>{children}</thead>
                  ),
                  tbody: ({ node, children, ...props }) => (
                    <tbody {...props}>{children}</tbody>
                  ),
                  tr: ({ node, children, ...props }) => (
                    <tr className="border-b border-gray-200" {...props}>{children}</tr>
                  ),
                  th: ({ node, children, ...props }) => (
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold" {...props}>{children}</th>
                  ),
                  td: ({ node, children, ...props }) => (
                    <td className="border border-gray-300 px-3 py-2" {...props}>{children}</td>
                  ),
                  code: ({ node, children, className, ...props }) => {
                    const isBlock = className?.includes('language-');
                    if (isBlock) {
                      return <code className={`${className || ''} break-all`} {...props}>{children}</code>;
                    }
                    return <code className="bg-gray-800 text-gray-100 px-1.5 py-0.5 rounded text-sm break-all" {...props}>{children}</code>;
                  },
                  pre: ({ node, children, ...props }) => (
                    <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto max-w-full" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} {...props}>{children}</pre>
                  ),
                  a: ({ node, href, children }) => {
                    if (href?.startsWith('app://')) {
                      const appId = href.replace('app://', '');
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('[AgentChat] Button click - opening app:', appId);
                            window.dispatchEvent(new CustomEvent('openApp', { detail: { appId } }));
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1 ${tw.button.primary} rounded-lg transition-colors text-xs font-medium mx-1`}
                          data-testid={`link-app-${appId}`}
                        >
                          {children}
                        </button>
                      );
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer" title={href} className="text-blue-600 hover:underline break-all">{children}</a>;
                  }
                }}
              >
                {streamingContent}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 ml-1 bg-gray-900 animate-pulse" />
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - ChatGPT style */}
      <div className="p-4 border-t bg-white/80 backdrop-blur-sm">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          data-testid="input-file-attachment"
        />

        {/* Unified input container with drag-drop support */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 transition-colors overflow-hidden ${
            isDraggingOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          {/* Drag overlay indicator */}
          {isDraggingOver && (
            <div className="flex items-center justify-center py-3 px-4 bg-blue-50 border-b border-blue-200">
              <FileImage className="w-4 h-4 text-blue-500 mr-2" />
              <span className="text-sm text-blue-600 font-medium">Drop files here</span>
            </div>
          )}

          {/* Attachment Previews - inside container */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-2">
              {pendingAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs border border-gray-200"
                  data-testid={`attachment-preview-${attachment.id}`}
                >
                  {attachment.contentType.startsWith("image/") ? (
                    <FileImage className="w-3 h-3 text-blue-500" />
                  ) : (
                    <File className="w-3 h-3 text-gray-500" />
                  )}
                  <span className="max-w-[100px] truncate text-gray-700">
                    {attachment.originalName}
                  </span>
                  <button
                    onClick={() => removeAttachment(attachment.id)}
                    className="ml-1 text-gray-400 hover:text-red-500"
                    data-testid={`button-remove-attachment-${attachment.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text area - starts as single line, expands to 2-3 lines */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={composerPlaceholder}
            className="w-full border-0 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-0 resize-none leading-5"
            rows={1}
            disabled={loading}
            data-testid="textarea-instruction"
          />

          {/* Buttons row - floating at bottom */}
          <div className="flex items-center justify-between px-2 pb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isUploadingAttachment || pendingAttachments.length >= 5}
              className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="button-attach-file"
              title="Attach files (images, PDFs)"
            >
              {isUploadingAttachment ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              ) : (
                <Plus className="w-5 h-5 text-gray-500" />
              )}
            </button>

            <button
              onClick={loading ? undefined : sendMessage}
              disabled={(!input.trim() && pendingAttachments.length === 0) && !loading}
              className={`h-8 w-8 flex items-center justify-center rounded-xl transition-colors ${
                loading
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : `${tw.button.primary} disabled:opacity-50 disabled:cursor-not-allowed`
              }`}
              data-testid="button-send-message"
            >
              {loading ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2 text-center">
          {isBeaconSpace
            ? `${shortcutPrefix}+Enter to send • Private, judgment-free support grounded in CRAFT`
            : `${shortcutPrefix}+Enter to send • Drag & drop or paste images`}
        </p>
      </div>
    </div>
  );
}
