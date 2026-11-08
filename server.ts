import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import {
  applyGameAction,
  computeNextBotAction,
  createInitialGameRoom,
  GameRoomState,
  PlayerState,
} from './lib/monopoly-engine';
import {
  BOARD_SIZE_CONFIGS,
  BoardSizeId,
  HostConfig,
  PLAYER_PALETTE,
  TOKEN_ARCHETYPES,
} from './lib/monopoly-data';
import {
  buildHostSystemInstruction,
  getServerGeminiClient,
} from './lib/gemini-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Authoritative server-side room store for Online Multiplayer
interface ServerRoom {
  state: GameRoomState;
  clients: Map<WebSocket, string>; // ws -> playerId
  botTimer: NodeJS.Timeout | null;
}

const rooms = new Map<string, ServerRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcastRoomState(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const payload = JSON.stringify({
    type: 'room:state',
    state: room.state,
  });
  for (const [clientWs] of room.clients) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(payload);
    }
  }
}

function scheduleServerBotCheck(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
  const nextBotAction = computeNextBotAction(room.state);
  if (nextBotAction) {
    room.botTimer = setTimeout(() => {
      const currentRoom = rooms.get(roomCode);
      if (!currentRoom) return;
      const actionNow = computeNextBotAction(currentRoom.state);
      if (actionNow) {
        currentRoom.state = applyGameAction(currentRoom.state, actionNow);
        broadcastRoomState(roomCode);
        scheduleServerBotCheck(roomCode);
      }
    }, 900);
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const gameWss = new WebSocketServer({ noServer: true });
  const liveWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true);

    if (pathname === '/ws/game') {
      gameWss.handleUpgrade(request, socket, head, (ws) => {
        gameWss.emit('connection', ws, request);
      });
    } else if (pathname === '/ws/live') {
      liveWss.handleUpgrade(request, socket, head, (ws) => {
        liveWss.emit('connection', ws, request);
      });
    } else {
      // Allow Next.js internal upgrades if any, or destroy unknown sockets cleanly
      socket.destroy();
    }
  });

  // 1. Multiplayer Monopoly Game Room WebSocket Server
  gameWss.on('connection', (ws: WebSocket) => {
    let joinedRoomCode: string | null = null;
    let joinedPlayerId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'room:create') {
          let code = generateRoomCode();
          while (rooms.has(code)) {
            code = generateRoomCode();
          }
          const boardSize: BoardSizeId =
            msg.boardSize === 'MINI' ||
            msg.boardSize === 'CLASSIC' ||
            msg.boardSize === 'MEGA' ||
            msg.boardSize === 'CONTINENTAL' ||
            msg.boardSize === 'COLOSSAL'
              ? msg.boardSize
              : 'CLASSIC';
          const turnTimeLimitSeconds =
            typeof msg.turnTimeLimitSeconds === 'number'
              ? msg.turnTimeLimitSeconds
              : 60;
          const startingCash = BOARD_SIZE_CONFIGS[boardSize].startingCash;
          const hostPlayer: PlayerState = {
            ...msg.player,
            cash: startingCash,
          };
          const bots: PlayerState[] = Array.isArray(msg.bots)
            ? msg.bots.map((b: PlayerState) => ({ ...b, cash: startingCash }))
            : [];
          const hostConfig: HostConfig = msg.hostConfig;
          const initialPlayers = [hostPlayer, ...bots];

          const initialState = createInitialGameRoom(
            code,
            'ONLINE',
            initialPlayers,
            hostConfig,
            turnTimeLimitSeconds,
            boardSize
          );

          const serverRoom: ServerRoom = {
            state: initialState,
            clients: new Map([[ws, hostPlayer.id]]),
            botTimer: null,
          };
          rooms.set(code, serverRoom);
          joinedRoomCode = code;
          joinedPlayerId = hostPlayer.id;

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              roomCode: code,
              playerId: hostPlayer.id,
              state: initialState,
            })
          );
          scheduleServerBotCheck(code);
          return;
        }

        if (msg.type === 'room:join') {
          const code = String(msg.roomCode || '')
            .trim()
            .toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'room:error',
                message: `Room "${code}" was not found. Check the 6-character code or create a new room.`,
              })
            );
            return;
          }

          const incomingPlayer: PlayerState = msg.player;
          // Idempotent check: if player ID already exists in room, reconnect them
          const existing = room.state.players.find(
            (p) => p.id === incomingPlayer.id
          );
          if (existing) {
            existing.connected = true;
          } else {
            const usedTokens = new Set(room.state.players.map((p) => p.token));
            const availableArch =
              TOKEN_ARCHETYPES.find((t) => !usedTokens.has(t.id)) ||
              TOKEN_ARCHETYPES[
                room.state.players.length % TOKEN_ARCHETYPES.length
              ];
            const paletteColor =
              PLAYER_PALETTE[room.state.players.length % PLAYER_PALETTE.length];
            const startingCash =
              BOARD_SIZE_CONFIGS[room.state.boardSize]?.startingCash || 1500;
            const newPlayer: PlayerState = {
              ...incomingPlayer,
              token: usedTokens.has(incomingPlayer.token)
                ? availableArch.id
                : incomingPlayer.token,
              color: paletteColor,
              cash: startingCash,
              position: 0,
              inJail: false,
              jailTurns: 0,
              getOutOfJailCards: 0,
              bankrupt: false,
              connected: true,
            };
            room.state.players.push(newPlayer);
            room.state.logs.unshift({
              id: `log-${Date.now()}`,
              timestamp: Date.now(),
              text: `${newPlayer.name} joined Room #${code} at Grand Departure!`,
              type: 'SYSTEM',
              important: true,
            });
            room.state.lastHeadlineEvent = `${newPlayer.name} has joined the table in Room ${code}!`;
          }

          room.clients.set(ws, incomingPlayer.id);
          joinedRoomCode = code;
          joinedPlayerId = incomingPlayer.id;

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              roomCode: code,
              playerId: incomingPlayer.id,
              state: room.state,
            })
          );
          broadcastRoomState(code);
          return;
        }

        if (msg.type === 'room:action' && joinedRoomCode) {
          const room = rooms.get(joinedRoomCode);
          if (!room) return;
          room.state = applyGameAction(room.state, msg.action);
          broadcastRoomState(joinedRoomCode);
          scheduleServerBotCheck(joinedRoomCode);
          return;
        }
      } catch (err) {
        console.error('Game WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (joinedRoomCode && joinedPlayerId) {
        const room = rooms.get(joinedRoomCode);
        if (room) {
          room.clients.delete(ws);
          const p = room.state.players.find((pl) => pl.id === joinedPlayerId);
          if (p) {
            p.connected = false;
          }
          broadcastRoomState(joinedRoomCode);
        }
      }
    });
  });

  // 2. Gemini 3.8 Live Real-Time Voice Conversation WebSocket Server
  liveWss.on('connection', (clientWs: WebSocket) => {
    let sessionPromise: ReturnType<
      ReturnType<typeof getServerGeminiClient>['live']['connect']
    > | null = null;
    let isClosed = false;

    clientWs.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Initialize Live API session with hostConfig and boardContext
        if (msg.type === 'live:init' && !sessionPromise) {
          const hostConfig: HostConfig = msg.hostConfig;
          const boardContext: string = msg.boardContext || '';
          const ai = getServerGeminiClient();
          const { systemPrompt } = buildHostSystemInstruction(
            hostConfig,
            boardContext
          );

          sessionPromise = ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: hostConfig?.voiceName || 'Kore',
                  },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: `${systemPrompt}\nYou are in a live real-time voice conversation with the players at the Grand Estates 3D Monopoly table. Answer questions about rules, evaluate trades, roast or praise their real-estate strategy, and keep responses conversational, vivid, and concise.`,
            },
            callbacks: {
              onopen: () => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'live:ready' }));
                }
              },
              onmessage: (message: LiveServerMessage) => {
                if (clientWs.readyState !== WebSocket.OPEN) return;
                const content = message.serverContent;

                if (content?.inputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'live:input_transcript',
                      text: content.inputTranscription.text,
                    })
                  );
                }
                if (content?.outputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'live:output_transcript',
                      text: content.outputTranscription.text,
                    })
                  );
                }

                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'live:audio',
                        audio: part.inlineData.data,
                      })
                    );
                  }
                }

                if (content?.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'live:interrupted' }));
                }
              },
              onerror: (err: unknown) => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'live:error',
                      message:
                        err instanceof Error
                          ? err.message
                          : 'Gemini Live connection error',
                    })
                  );
                }
              },
              onclose: () => {
                if (clientWs.readyState === WebSocket.OPEN && !isClosed) {
                  clientWs.send(JSON.stringify({ type: 'live:closed' }));
                }
              },
            },
          });

          sessionPromise.catch((err: unknown) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'live:error',
                  message:
                    err instanceof Error
                      ? err.message
                      : 'Failed to connect to Gemini 3.8 Live API',
                })
              );
            }
          });
          return;
        }

        if (msg.type === 'live:audio' && sessionPromise && msg.audio) {
          sessionPromise
            .then((session) => {
              if (!isClosed) {
                session.sendRealtimeInput({
                  audio: {
                    data: msg.audio,
                    mimeType: 'audio/pcm;rate=16000',
                  },
                });
              }
            })
            .catch(() => {});
          return;
        }

        if (msg.type === 'live:text' && sessionPromise && msg.text) {
          sessionPromise
            .then((session) => {
              if (!isClosed) {
                session.sendRealtimeInput({
                  text: msg.text,
                });
              }
            })
            .catch(() => {});
          return;
        }
      } catch (err) {
        console.error('Live WS message error:', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      if (sessionPromise) {
        sessionPromise
          .then((session) => {
            session.close();
          })
          .catch(() => {});
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(
      `> Grand Estates 3D Server ready on http://${hostname}:${port} (env: ${
        dev ? 'development' : 'production'
      })`
    );
  });
});
