import { ConnectionHandler } from '../ConnectionHandler'
import { v4 as uuidv4 } from 'uuid'
import { packet_command_output } from 'src/types/packets.i'

export class CommandManager {
  private _connection: ConnectionHandler
  private _requests = new Map<string, string>()
  private _commandCache = new Map<string, packet_command_output>()
  private _inv
  constructor(connection: ConnectionHandler) {
    this._connection = connection
    this._connection.on('command_output', (packet) => {
      if (!packet) return
      this._commandCache.set(packet.origin.uuid, packet)
    })
    this._inv = setInterval(() => {
      for (const [request, command] of this._requests) {
        this._connection.sendPacket('command_request', {
          command: command,
          interval: false,
          origin: {
            uuid: request,
            request_id: request,
            type: 'player',
          },
        })
        this._requests.delete(request)
      }
    })
  }
  private _findResponse(requestID: string): Promise<packet_command_output> {
    return new Promise((res) => {
      const inv = setInterval(() => {
        const cache = this._commandCache.get(requestID)
        if (!cache) return
        this._commandCache.delete(requestID)
        clearInterval(inv)

        return res(cache)
      })
    })
  }
  public async executeCommand(command: string): Promise<packet_command_output>
  public async executeCommand(command: string, callback: (err: any, res: packet_command_output) => void): Promise<void>
  public async executeCommand(command: string, callback?: (err: any, res: packet_command_output) => void): Promise<packet_command_output | void> {
    try {
      const requestID = uuidv4()
      this._requests.set(requestID, command)
      const response = await this._findResponse(requestID)
      if (callback) {
        return callback(undefined, response)
      } else {
        return new Promise((res) => {
          res(response)
        })
      }
    } catch (error) {
      if (callback) {
        return callback(error, undefined)
      } else {
        return new Promise((res, rej) => {
          rej(error)
        })
      }
    }
  }
  public close(): void {
    clearInterval(this._inv)
  }
}
