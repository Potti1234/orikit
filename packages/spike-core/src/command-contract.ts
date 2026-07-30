import type { CommandContract, Tagged } from './program'

export class CommandContractError extends Error {
  readonly commandTag: string
  readonly messageTag: string

  constructor(commandTag: string, messageTag: string, allowed: ReadonlyArray<string>) {
    super(
      `Message "${messageTag}" cannot complete command "${commandTag}". Allowed: ${
        allowed.length === 0 ? '(none)' : allowed.join(', ')
      }`,
    )
    this.name = 'CommandContractError'
    this.commandTag = commandTag
    this.messageTag = messageTag
  }
}

export const defineCommandContract = <Command extends Tagged, Message extends Tagged>(
  contract: CommandContract<Command, Message>,
): CommandContract<Command, Message> => Object.freeze(contract)

export const assertCommandCompletion = <Command extends Tagged, Message extends Tagged>(
  contract: CommandContract<Command, Message>,
  command: NoInfer<Command>,
  message: NoInfer<Message>,
): void => {
  const allowed = contract[command._tag as keyof typeof contract] as
    | ReadonlyArray<string>
    | undefined
  if (allowed === undefined || !allowed.includes(message._tag)) {
    throw new CommandContractError(command._tag, message._tag, allowed ?? [])
  }
}
